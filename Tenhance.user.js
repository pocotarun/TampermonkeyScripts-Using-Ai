// ==UserScript==
// @name         Tenhance
// @namespace    http://tampermonkey.net/
// @version      2026-06-17
// @description  Universal Web Enhancer core UI engine
// @match        *://*.youtube.com/*
// @match        *://*.youtu.be/*
// @match        *://*.instagram.com/*
// @match        *://*.facebook.com/*
// @match        *://fb.watch/*
// @match        *://*.tiktok.com/*
// @match        *://*.pinterest.com/*
// @match        https://vidssave.com/*
// @match        https://*.vidssave.com/*
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // Strict frame guard: only run in top-level window
    if (window !== window.top) {
        return;
    }

    // Unique host wrapper ID for idempotent injection
    const TENHANCE_HOST_ID = 'tenhance-host-wrapper';

    // Persistent keys for state storage
    const STATE_KEYS = {
        WIDGET: 'tenhance_widget_state',
        UI: 'tenhance_ui_state'
    };

    const SAVED_URL_KEY = 'tenhance_saved_url';

    // Default serializable state objects
    const defaultWidgetState = {
        x: null,
        y: null,
        visible: true,
        minimized: false,
        dockedEdge: null,
        skipEnabled: false,
        themeDark: false
    };

    const defaultUIState = {
        activeMode: 'default',
        edge: null
    };

    const ALLOWED_SITES = [
        'youtube.com',
        'youtu.be',
        'instagram.com',
        'facebook.com',
        'fb.watch',
        'tiktok.com',
        'pinterest.com'
    ];

    const BACKGROUND_SITE = 'vidssave.com';

    // Safe store wrappers for Tampermonkey
    function getStoredValue(key, fallback) {
        try {
            return GM_getValue(key, fallback);
        } catch (error) {
            return fallback;
        }
    }

    function saveStoredValue(key, value) {
        try {
            GM_setValue(key, value);
        } catch (error) {
            // Ignore storage failures in phase-1 skeleton
        }
    }

    function reactSetValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setter) {
            input.value = value;
        } else {
            setter.call(input, value);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function handleVidssaveBackground() {
        const storedUrl = getStoredValue(SAVED_URL_KEY, '');
        if (!storedUrl) {
            return;
        }

        for (let attempt = 0; attempt < 30; attempt += 1) {
            const urlWrapper = document.querySelector('#url-input-wrapper');
            const input = urlWrapper?.querySelector('input') || document.querySelector('input[type="url"], input[type="text"], input');
            const submit = document.querySelector('button[type="submit"], button');

            if (input && submit) {
                input.focus();
                reactSetValue(input, storedUrl);
                await new Promise(resolve => setTimeout(resolve, 150));
                submit.click();
                saveStoredValue(SAVED_URL_KEY, '');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // Initialize state from persisted storage or fallback coordinates
    const savedWidgetState = getStoredValue(STATE_KEYS.WIDGET, null);
    const savedUIState = getStoredValue(STATE_KEYS.UI, null);

    const widgetState = Object.assign({}, defaultWidgetState, savedWidgetState || {});
    const uiState = Object.assign({}, defaultUIState, savedUIState || {});

    // Corrupt state detected - wipe and start fresh
    if (savedWidgetState && (savedWidgetState.x === undefined || typeof savedWidgetState.x !== 'number')) {
        widgetState.x = null;
        widgetState.y = null;
        saveStoredValue(STATE_KEYS.WIDGET, widgetState);
    }

    function validateAndResetCoordinates() {
        const SAFE_X = 40;
        const SAFE_Y = 140;
        const panelWidth = 360;
        const panelHeight = 120;

        const isXOutOfBounds = widgetState.x === null || widgetState.x < 0 || widgetState.x > document.documentElement.clientWidth - panelWidth;
        const isYOutOfBounds = widgetState.y === null || widgetState.y < 0 || widgetState.y > document.documentElement.clientHeight - panelHeight;

        if (isXOutOfBounds || isYOutOfBounds || widgetState.x === undefined || widgetState.y === undefined) {
            widgetState.x = SAFE_X;
            widgetState.y = SAFE_Y;
            saveStoredValue(STATE_KEYS.WIDGET, widgetState);
        }
    }

    validateAndResetCoordinates();

    function getPlatformDetails() {
        const hostname = location.hostname.toLowerCase();
        const href = location.href.toLowerCase();

        if (hostname.includes(BACKGROUND_SITE)) {
            return { platformName: 'Background', contentType: '', renderPanel: false };
        }

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            let type = 'Video';
            if (href.includes('/shorts/')) type = 'Short';
            return { platformName: 'YouTube', contentType: type, renderPanel: true };
        }

        if (hostname.includes('instagram.com')) {
            const type = href.includes('/reel/') ? 'Reel' : 'Video';
            return { platformName: 'Instagram', contentType: type, renderPanel: true };
        }

        if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
            return { platformName: 'Facebook', contentType: 'Video', renderPanel: true };
        }

        if (hostname.includes('tiktok.com')) {
            return { platformName: 'TikTok', contentType: 'Video', renderPanel: true };
        }

        if (hostname.includes('pinterest.com')) {
            return { platformName: 'Pinterest', contentType: 'Video', renderPanel: true };
        }

        return { platformName: 'Web', contentType: '', renderPanel: ALLOWED_SITES.some(site => hostname.includes(site)) };
    }

    function isBackgroundMode() {
        return location.hostname.toLowerCase().includes(BACKGROUND_SITE);
    }

    function tryAppendHost(host) {
        const targets = [document.body, document.documentElement, document.head];
        for (const target of targets) {
            if (!target) {
                continue;
            }

            try {
                target.appendChild(host);
                if (document.getElementById(TENHANCE_HOST_ID)) {
                    return true;
                }
            } catch (error) {
                // Continue to the next fallback target.
            }
        }
        return false;
    }

    function createTenhanceShell() {
        if (document.getElementById(TENHANCE_HOST_ID)) {
            return;
        }

        const host = document.createElement('div');
        host.id = TENHANCE_HOST_ID;
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '0';
        host.style.width = '100%';
        host.style.height = '100%';
        host.style.zIndex = '2147483647';
        host.style.pointerEvents = 'none';
        host.style.margin = '0';
        host.style.padding = '0';

        const panelElement = document.createElement('tenhance-panel');
        host.appendChild(panelElement);

        if (!tryAppendHost(host)) {
            requestAnimationFrame(() => tryAppendHost(host));
            setTimeout(() => tryAppendHost(host), 150);
            setTimeout(() => tryAppendHost(host), 500);
        }
    }

    function ensureTenhanceShell() {
        if (isBackgroundMode()) {
            return;
        }

        if (!document.body && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', ensureTenhanceShell, { once: true });
            return;
        }

        if (!document.getElementById(TENHANCE_HOST_ID)) {
            createTenhanceShell();
        }
    }

    function installFallbackShellWatcher() {
        const retryInterval = setInterval(() => {
            if (isBackgroundMode()) {
                clearInterval(retryInterval);
                return;
            }
            ensureTenhanceShell();
        }, 900);
    }

    function toggleTenhanceVisibility(forceState = null) {
        if (forceState === null) {
            widgetState.visible = !widgetState.visible;
        } else {
            widgetState.visible = !!forceState;
        }

        saveStoredValue(STATE_KEYS.WIDGET, widgetState);
        const panelEl = document.querySelector('tenhance-panel');
        if (panelEl instanceof TenhancePanel) {
            panelEl.wrapper.style.display = widgetState.visible ? 'block' : 'none';
        }
    }

    function openTenhanceMenu() {
        ensureTenhanceShell();
        toggleTenhanceVisibility(true);
        const panelEl = document.querySelector('tenhance-panel');
        if (panelEl instanceof TenhancePanel) {
            panelEl.updatePlatformTitle();
            panelEl.renderActions();
        }
    }

    function installGlobalHotkeys() {
        window.addEventListener('keydown', (event) => {
            if (!event.altKey || !event.shiftKey) {
                return;
            }

            const tag = event.target?.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable) {
                return;
            }

            if (event.code === 'KeyM' || event.key?.toLowerCase() === 'm') {
                event.preventDefault();
                event.stopPropagation();
                openTenhanceMenu();
            }

            if (event.code === 'KeyH' || event.key?.toLowerCase() === 'h') {
                event.preventDefault();
                event.stopPropagation();
                ensureTenhanceShell();
                toggleTenhanceVisibility();
            }
        }, true);
    }

    class TenhancePanel extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });

            this.isDragging = false;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
            this.activePointerId = null;
            this.skipInterval = null;
            this.watchCounter = null;

            const wrapper = document.createElement('div');
            wrapper.id = 'tenhance-root';
            wrapper.style.position = 'fixed';
            wrapper.style.zIndex = '2147483647';
            wrapper.style.left = `${widgetState.x}px`;
            wrapper.style.top = `${widgetState.y}px`;
            wrapper.style.pointerEvents = 'auto';
            wrapper.style.display = widgetState.visible ? 'block' : 'none';
            wrapper.style.touchAction = 'none';
            wrapper.setAttribute('aria-label', 'Tenhance floating control panel');
            this.wrapper = wrapper;

            const panel = document.createElement('section');
            panel.className = 'tenhance-panel';
            if (widgetState.minimized) {
                panel.classList.add('minimized');
            }

            const header = document.createElement('div');
            header.className = 'tenhance-header';

            const title = document.createElement('span');
            title.className = 'tenhance-title';
            title.textContent = 'Tenhance';
            title.style.cursor = 'grab';
            title.style.userSelect = 'none';

            const headerControls = document.createElement('div');
            headerControls.className = 'tenhance-header-controls';

            const helpWrapper = document.createElement('div');
            helpWrapper.className = 'help-wrapper';

            const helpButton = document.createElement('button');
            helpButton.type = 'button';
            helpButton.className = 'tenhance-icon-btn';
            helpButton.textContent = '?';
            helpButton.title = 'Help Guide';

            const tooltip = document.createElement('div');
            tooltip.className = 'tenhance-tooltip';

            const tTitle = document.createElement('div');
            tTitle.style.cssText = 'font-weight:600; margin-bottom:10px; font-size:0.95rem; display:flex; align-items:center; gap:6px;';
            tTitle.textContent = '💡 Tenhance Guide';

            const tDrag = document.createElement('div');
            tDrag.style.cssText = 'margin-bottom:6px; line-height:1.4;';
            tDrag.textContent = '🖱️ Drag Title to move the panel anywhere.';

            const tMin = document.createElement('div');
            tMin.style.cssText = 'margin-bottom:6px; line-height:1.4;';
            tMin.textContent = '🔽 Click ▾ to minimize and hide actions.';

            this.dynamicHintsContainer = document.createElement('div');

            tooltip.appendChild(tTitle);
            tooltip.appendChild(tDrag);
            tooltip.appendChild(tMin);
            tooltip.appendChild(this.dynamicHintsContainer);

            helpWrapper.appendChild(helpButton);
            helpWrapper.appendChild(tooltip);

            const minimizeButton = document.createElement('button');
            minimizeButton.type = 'button';
            minimizeButton.className = 'tenhance-icon-btn';
            minimizeButton.textContent = widgetState.minimized ? '▸' : '▾';
            minimizeButton.title = 'Minimize panel';
            minimizeButton.addEventListener('click', this.toggleMinimize.bind(this));

            headerControls.appendChild(helpWrapper);
            headerControls.appendChild(minimizeButton);

            header.appendChild(title);
            header.appendChild(headerControls);

            const actions = document.createElement('div');
            actions.className = 'tenhance-actions';
            this.actionsContainer = actions;

            const status = document.createElement('div');
            status.className = 'tenhance-status';
            status.textContent = 'Ready';
            this.statusElement = status;

            panel.appendChild(header);
            panel.appendChild(actions);
            panel.appendChild(status);
            wrapper.appendChild(panel);
            shadow.appendChild(wrapper);
            shadow.appendChild(createStyles());

            this.titleElement = title;
            this.minimizeButton = minimizeButton;
            this.panelElement = panel;
            this.renderActions();
            this.updatePlatformTitle();

            if (widgetState.skipEnabled) {
                this.startSkipRunner();
            }

            title.addEventListener('pointerdown', this.onPointerDown.bind(this));
            this.wrapper.addEventListener('pointermove', this.onPointerMove.bind(this));
            this.wrapper.addEventListener('pointerup', this.onPointerUp.bind(this));
            this.wrapper.addEventListener('pointercancel', this.onPointerCancel.bind(this));
        }

        onPointerDown(event) {
            if (event.button !== 0 && event.pointerType === 'mouse') {
                return;
            }

            this.isDragging = true;
            this.activePointerId = event.pointerId;
            this.wrapper.classList.add('dragging');
            const rect = this.wrapper.getBoundingClientRect();
            this.dragOffsetX = event.clientX - rect.left;
            this.dragOffsetY = event.clientY - rect.top;
            this.wrapper.setPointerCapture(event.pointerId);
            event.preventDefault();
        }

        onPointerMove(event) {
            if (!this.isDragging || event.pointerId !== this.activePointerId) {
                return;
            }

            const nextX = event.clientX - this.dragOffsetX;
            const nextY = event.clientY - this.dragOffsetY;
            const clamped = this.clampToBounds(nextX, nextY);

            this.wrapper.style.left = `${clamped.x}px`;
            this.wrapper.style.top = `${clamped.y}px`;
        }

        onPointerUp(event) {
            if (!this.isDragging || event.pointerId !== this.activePointerId) {
                return;
            }

            this.isDragging = false;
            this.wrapper.classList.remove('dragging');
            this.wrapper.releasePointerCapture(event.pointerId);
            this.activePointerId = null;
            this.persistPosition();
        }

        onPointerCancel(event) {
            if (!this.isDragging || event.pointerId !== this.activePointerId) {
                return;
            }

            this.isDragging = false;
            this.wrapper.classList.remove('dragging');
            this.activePointerId = null;
            this.persistPosition();
        }

        clampToBounds(x, y) {
            const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
            const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
            const rect = this.wrapper.getBoundingClientRect();
            const margin = 12;

            const maxX = Math.max(margin, viewportWidth - rect.width - margin);
            const maxY = Math.max(margin, viewportHeight - rect.height - margin);

            return {
                x: Math.min(Math.max(margin, x), maxX),
                y: Math.min(Math.max(margin, y), maxY)
            };
        }

        persistPosition() {
            const rect = this.wrapper.getBoundingClientRect();
            const clamped = this.clampToBounds(rect.left, rect.top);
            widgetState.x = clamped.x;
            widgetState.y = clamped.y;
            saveStoredValue(STATE_KEYS.WIDGET, widgetState);
            this.wrapper.style.left = `${clamped.x}px`;
            this.wrapper.style.top = `${clamped.y}px`;
        }

        createActionButton(label, action, options = {}) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tenhance-button';
            if (options.circle) {
                button.classList.add('counter-button');
            }
            button.textContent = label;
            button.addEventListener('click', () => this.handleActionClick(action));
            return button;
        }

        handleActionClick(action) {
            const pageUrl = location.href;
            if (['sosDownload', 'hdDownload', 'downloadContent'].includes(action)) {
                saveStoredValue(SAVED_URL_KEY, pageUrl);
            }

            switch (action) {
                case 'toggleSkip':
                    this.toggleSkip();
                    break;
                case 'sosDownload':
                    this.openDownload(`https://sosyoutube.com/?url=${encodeURIComponent(pageUrl)}`);
                    break;
                case 'hdDownload':
                    this.openDownload(`https://genyt.xyz/?url=${encodeURIComponent(pageUrl)}`);
                    break;
                case 'downloadContent':
                    this.openDownload(`https://vidssave.com/?url=${encodeURIComponent(pageUrl)}`);
                    break;
                case 'toggleTheme':
                    this.toggleThemeMode();
                    break;
                default:
                    break;
            }
        }

        openDownload(targetUrl) {
            window.open(targetUrl, '_blank');
        }

        toggleSkip() {
            widgetState.skipEnabled = !widgetState.skipEnabled;
            saveStoredValue(STATE_KEYS.WIDGET, widgetState);
            if (widgetState.skipEnabled) {
                this.startSkipRunner();
            } else {
                this.stopSkipRunner();
            }
            this.renderActions();
        }

        startSkipRunner() {
            if (this.skipInterval) {
                return;
            }

            this.skipInterval = setInterval(() => {
                const video = document.querySelector('video');
                if (!video || !widgetState.skipEnabled) {
                    return;
                }

                const isPlaylist = new URL(location.href).searchParams.has('list');
                if (isPlaylist && video.currentTime < 14) {
                    video.currentTime = 14;
                }
            }, 1000);
        }

        stopSkipRunner() {
            if (!this.skipInterval) {
                return;
            }
            clearInterval(this.skipInterval);
            this.skipInterval = null;
        }

        toggleThemeMode() {
            // Directly interact with YouTube's theme attribute on the <html> tag
            const isCurrentlyDark = document.documentElement.hasAttribute('dark');
            if (isCurrentlyDark) {
                document.documentElement.removeAttribute('dark');
            } else {
                document.documentElement.setAttribute('dark', '');
            }
            widgetState.themeDark = !isCurrentlyDark;
            saveStoredValue(STATE_KEYS.WIDGET, widgetState);
            this.renderActions();
        }

        updateWatchCounter() {
            if (!this.watchCounter) {
                return;
            }

            const href = location.href.toLowerCase();
            const isPlaylist = href.includes('list=');
            let text = 'Watch';
            if (isPlaylist) {
                const entries = document.querySelectorAll('ytd-playlist-video-renderer').length;
                text = entries > 0 ? String(entries) : 'Playlist';
            }

            this.watchCounter.textContent = text;
        }

        updateTooltip(details) {
            if (!this.dynamicHintsContainer) return;

            while (this.dynamicHintsContainer.firstChild) {
                this.dynamicHintsContainer.removeChild(this.dynamicHintsContainer.firstChild);
            }

            const addHint = (text) => {
                const hint = document.createElement('div');
                hint.style.cssText = 'margin-bottom:6px; line-height:1.4;';
                hint.textContent = text;
                this.dynamicHintsContainer.appendChild(hint);
            };

            if (details.platformName === 'YouTube') {
                addHint('⏭️ Skip 14s auto-skips YouTube intros.');
                addHint('🌓 Toggle Dark/Light theme directly.');
                addHint('📥 Use SOS or HD to download videos.');
            } else if (details.renderPanel && details.platformName !== 'Web') {
                addHint(`📥 Download Content saves this ${details.platformName} ${details.contentType}.`);
            } else {
                addHint('🌐 Tenhance features are limited on this site.');
            }

            addHint('⌨️ Shift + Alt + M or Alt + Shift + H to open/hide Tenhance immediately.');
            addHint('⚙️ All features, controls, and fallback injection paths are active.');
        }

        renderActions() {
            const details = getPlatformDetails();
            this.updateTooltip(details);

            while (this.actionsContainer.firstChild) {
                this.actionsContainer.removeChild(this.actionsContainer.firstChild);
            }

            if (!details.renderPanel) {
                return;
            }

            if (details.platformName === 'YouTube') {
                this.watchCounter = this.createActionButton('0', 'watchCounter', { circle: true });
                this.watchCounter.disabled = true;
                this.actionsContainer.appendChild(this.watchCounter);
                this.updateWatchCounter();

                const skipLabel = widgetState.skipEnabled ? 'Skip 14s ON' : 'Skip 14s';
                this.actionsContainer.appendChild(this.createActionButton(skipLabel, 'toggleSkip'));
                this.actionsContainer.appendChild(this.createActionButton('SOS Download', 'sosDownload'));
                this.actionsContainer.appendChild(this.createActionButton('HD Download', 'hdDownload'));
                this.actionsContainer.appendChild(this.createActionButton(widgetState.themeDark ? 'Light Theme' : 'Dark Theme', 'toggleTheme'));
            } else {
                this.actionsContainer.appendChild(this.createActionButton('Download Content', 'downloadContent'));
            }
        }

        updatePlatformTitle() {
            const details = getPlatformDetails();
            const titleText = details.renderPanel && details.contentType
                ? `Tenhance - ${details.platformName} ${details.contentType}`
                : `Tenhance${details.platformName !== 'Web' ? ` - ${details.platformName}` : ''}`;
            this.titleElement.textContent = titleText;

            if (details.platformName === 'YouTube' && details.contentType === 'Short') {
                this.panelElement.classList.add('shorts-mode');
            } else {
                this.panelElement.classList.remove('shorts-mode');
            }

            this.renderActions();
        }

        toggleMinimize(event) {
            event.stopPropagation();
            widgetState.minimized = !widgetState.minimized;
            saveStoredValue(STATE_KEYS.WIDGET, widgetState);
            this.panelElement.classList.toggle('minimized', widgetState.minimized);
            this.minimizeButton.textContent = widgetState.minimized ? '▸' : '▾';
        }
    }

    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
      :host {
        all: initial;
        display: block !important;
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      #tenhance-root {
        min-width: max-content;
        touch-action: none;
        will-change: transform, left, top;
      }

      #tenhance-root.dragging .tenhance-title {
        cursor: grabbing !important;
      }

      .tenhance-panel {
        box-sizing: border-box;
        width: 100%;
        min-width: 320px;
        max-width: 420px;
        border-radius: 24px;
        padding: 20px;
        background: rgba(15, 23, 42, 0.7);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow: hidden;
      }

      .tenhance-panel.minimized {
        min-width: unset;
        max-width: fit-content;
        padding: 10px 20px;
        border-radius: 40px;
        background: rgba(15, 23, 42, 0.85);
      }

      .tenhance-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .tenhance-title {
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        margin-bottom: 16px;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        flex-grow: 1;
        transition: margin 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      }

      .minimized .tenhance-title {
        margin-bottom: 0;
        margin-right: 16px;
        font-size: 0.95rem;
      }

      .tenhance-header-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .minimized .tenhance-header-controls {
        margin-bottom: 0;
      }

      .tenhance-icon-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }

      .tenhance-icon-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .help-wrapper {
        position: relative;
        display: inline-flex;
      }

      .tenhance-tooltip {
        visibility: hidden;
        opacity: 0;
        position: absolute;
        bottom: 130%;
        right: -14px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 16px;
        border-radius: 16px;
        width: 240px;
        font-size: 0.85rem;
        color: #f8fafc;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        pointer-events: none;
        z-index: 100;
        transform: translateY(10px);
      }

      .help-wrapper:hover .tenhance-tooltip {
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
      }

      .tenhance-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        max-height: 500px;
        opacity: 1;
        transition: max-height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease, margin 0.3s;
      }

      .tenhance-status {
        margin-top: 12px;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.6);
        max-height: 50px;
        opacity: 1;
        transition: max-height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease, margin 0.3s;
      }

      .minimized .tenhance-actions,
      .minimized .tenhance-status {
        max-height: 0;
        opacity: 0;
        margin: 0;
        margin-top: 0;
      }

      .tenhance-button {
        flex: 1 1 140px;
        min-width: 120px;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      }

      .tenhance-button.counter-button {
        flex: 0 0 auto;
        min-width: unset;
        width: 44px;
        height: 44px;
        padding: 0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
      }

      .tenhance-button:hover:not(:disabled) {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        border-color: rgba(255,255,255,0.15);
      }
      
      .tenhance-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .tenhance-button:disabled {
        opacity: 0.5;
        cursor: default;
      }

      /* Compact overrides for YouTube Shorts */
      .tenhance-panel.shorts-mode:not(.minimized) {
        min-width: 220px;
        max-width: 260px;
        padding: 14px;
      }

      .shorts-mode .tenhance-title {
        font-size: 0.9rem;
        margin-bottom: 12px;
      }

      .shorts-mode .tenhance-actions {
        gap: 8px;
      }

      .shorts-mode .tenhance-button {
        flex: 1 1 90px;
        min-width: 90px;
        padding: 8px 12px;
        font-size: 0.8rem;
        border-radius: 12px;
      }
    `;
        return style;
    }

    if (!customElements.get('tenhance-panel')) {
        customElements.define('tenhance-panel', TenhancePanel);
    }

    let lastObservedUrl = location.href;
    let routeObserver = null;
    let debounceTimer = null;

    function handleRouteUpdate() {
        const currentUrl = location.href;
        const panelWrapper = document.getElementById(TENHANCE_HOST_ID);

        if (currentUrl === lastObservedUrl && panelWrapper) {
            return;
        }

        lastObservedUrl = currentUrl;

        if (isBackgroundMode()) {
            panelWrapper?.remove();
            return;
        }

        if (!panelWrapper) {
            createTenhanceShell();
        }

        const panelEl = document.querySelector('tenhance-panel');
        if (panelEl instanceof TenhancePanel) {
            panelEl.updatePlatformTitle();
            panelEl.renderActions();
        }
    }

    function installRouteObserver() {
        if (!document.body || routeObserver) {
            return;
        }

        // Debounce the observer to prevent massive CPU usage on dynamic pages
        const observerCallback = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                window.requestAnimationFrame(handleRouteUpdate);
            }, 150); // Waits for DOM changes to settle for 150ms before updating
        };

        routeObserver = new MutationObserver(observerCallback);
        routeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        function wrapHistoryMethod(original) {
            return function (...args) {
                const result = original.apply(this, args);
                handleRouteUpdate();
                return result;
            };
        }

        history.pushState = wrapHistoryMethod(originalPushState);
        history.replaceState = wrapHistoryMethod(originalReplaceState);
        window.addEventListener('popstate', handleRouteUpdate);
    }

    function showWelcomeToast() {
        const toastId = 'tenhance-welcome-toast';
        if (document.getElementById(toastId)) return;

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.innerHTML = 'Tenhance Activated<br><span style="font-size: 12px; font-weight: normal; opacity: 0.8;">Hint: Shift + Alt + M to open</span>';

        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%) translateY(-20px)',
            opacity: '0',
            zIndex: '2147483647',
            padding: '12px 24px',
            borderRadius: '50px',
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(63, 84, 255, 0.4)',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '15px',
            fontWeight: '600',
            textAlign: 'center',
            letterSpacing: '1px',
            textShadow: '0 0 8px rgba(255, 255, 255, 0.8), 0 0 12px rgba(63, 84, 255, 0.8)',
            pointerEvents: 'none',
            transition: 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease'
        });

        document.body.appendChild(toast);

        // Trigger intro animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });

        // Extended lifecycle so the user can actually read the hint
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400); // matches CSS transition duration
        }, 2500);
    }

    function init() {
        if (!document.body) {
            return;
        }

        if (isBackgroundMode()) {
            handleVidssaveBackground();
            return;
        }

        createTenhanceShell();
        installFallbackShellWatcher();
        installGlobalHotkeys();
        showWelcomeToast();
        installRouteObserver();

        // Perform an initial update since the panel is now in the DOM.
        const panelEl = document.querySelector('tenhance-panel');
        if (panelEl instanceof TenhancePanel) {
            panelEl.updatePlatformTitle();
            panelEl.renderActions();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
