// ==UserScript==
// @name         Smart Floating Downloader FINAL
// @namespace    https://hidden-tarun-sfd-final
// @version      2.2.0
// @description  Only 5 Sites | Vidssave Hide | React Safe | 4s Hover Tooltip | Hotkeys | All Browsers
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
'use strict';

/* =====================================================
   🔐 ALLOWED SITES (STRICT)
===================================================== */

const ALLOWED_SITES = [
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'facebook.com',
    'fb.watch',
    'tiktok.com',
    'pinterest.com'
];

/* =====================================================
   🔑 GLOBAL KEYS & IDS
===================================================== */

const BTN_ID      = 'sfd-final-btn';
const TOOLTIP_ID  = 'sfd-final-tooltip';

const KEY_POS     = 'sfd_btn_pos';
const KEY_VISIBLE = 'sfd_btn_visible';
const KEY_URL     = 'sfd_saved_url';

const HOLD_TIME   = 4000;
const SPA_DELAY   = 800;

/* =====================================================
   🧠 STATE
===================================================== */

let btn        = null;
let tooltip    = null;
let hoverTimer = null;

let isDragging = false;
let dragMoved  = false;

let offsetX    = 0;
let offsetY    = 0;

let visible    = GM_getValue(KEY_VISIBLE, true);
let lastURL    = location.href;

/* =====================================================
   🛠️ UTILS
===================================================== */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function isAllowedSite() {
    const host = location.hostname;
    return ALLOWED_SITES.some(site => host.includes(site));
}

function isVidssave() {
    return location.hostname.includes('vidssave.com');
}

function currentURL() {
    return location.href;
}

/* =====================================================
   🌍 PLATFORM DETECT
===================================================== */

function detectPlatform() {
    const h = location.hostname;
    if (h.includes('youtube')) return 'YouTube';
    if (h.includes('instagram')) return 'Instagram';
    if (h.includes('facebook') || h.includes('fb.watch')) return 'Facebook';
    if (h.includes('tiktok')) return 'TikTok';
    if (h.includes('pinterest')) return 'Pinterest';
    return 'Download';
}

function detectType() {
    const u = location.href;
    if (u.includes('/shorts/')) return 'Short';
    if (u.includes('/reel/')) return 'Reel';
    if (u.includes('watch')) return 'Video';
    return '';
}

/* =====================================================
   🎨 STYLES (ALL BROWSERS SAFE)
===================================================== */

GM_addStyle(`
#${BTN_ID}{
    position:fixed;
    right:30px;
    bottom:140px;
    padding:14px 26px;
    border-radius:999px;
    background:linear-gradient(135deg,#ff0055,#ff9900,#7b2cff);
    color:#fff;
    font-weight:800;
    font-size:14px;
    cursor:pointer;
    z-index:999999;
    user-select:none;
    box-shadow:0 15px 40px rgba(0,0,0,.45);
    transition:transform .2s,opacity .2s;
}
#${BTN_ID}:active{transform:scale(.96);}
#${BTN_ID}.hide{opacity:0;pointer-events:none;}

#${TOOLTIP_ID}{
    position:fixed;
    background:#111;
    color:#fff;
    padding:16px 18px;
    border-radius:14px;
    font-size:13px;
    line-height:1.6;
    max-width:280px;
    z-index:9999999;
    box-shadow:0 15px 35px rgba(0,0,0,.7);
    pointer-events:none;
}
`);

/* =====================================================
   🔘 CREATE BUTTON
===================================================== */

function createButton() {
    if (!visible) return;
    if (!isAllowedSite()) return;
    if (isVidssave()) return;
    if (document.getElementById(BTN_ID)) return;

    btn = document.createElement('div');
    btn.id = BTN_ID;
    updateButtonText();

    document.body.appendChild(btn);

    restorePosition();
    attachDrag();
    attachClick();
    attachHoverTooltip();
}

/* =====================================================
   ✏️ BUTTON TEXT
===================================================== */

function updateButtonText() {
    if (!btn) return;
    btn.textContent = `${detectPlatform()} ${detectType()}`.trim();
}

/* =====================================================
   📍 POSITION SAVE / RESTORE
===================================================== */

function savePosition() {
    const r = btn.getBoundingClientRect();
    GM_setValue(KEY_POS, { x: r.left, y: r.top });
}

function restorePosition() {
    const p = GM_getValue(KEY_POS, null);
    if (!p) return;
    btn.style.left = p.x + 'px';
    btn.style.top = p.y + 'px';
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
}

/* =====================================================
   🖱️ DRAG
===================================================== */

function attachDrag() {
    btn.addEventListener('mousedown', e => {
        isDragging = true;
        dragMoved = false;
        offsetX = e.clientX - btn.getBoundingClientRect().left;
        offsetY = e.clientY - btn.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        dragMoved = true;
        btn.style.left = (e.clientX - offsetX) + 'px';
        btn.style.top = (e.clientY - offsetY) + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        if (dragMoved) savePosition();
    });
}

/* =====================================================
   📥 CLICK → DOWNLOAD
===================================================== */

function attachClick() {
    btn.addEventListener('click', () => {
        if (dragMoved) return;
        startDownload();
    });
}

function startDownload() {
    GM_setValue(KEY_URL, currentURL());
    window.open('https://vidssave.com/home', '_blank');
}

/* =====================================================
   🕒 4 SEC CURSOR HOLD TOOLTIP (FIXED)
===================================================== */

function attachHoverTooltip() {
    btn.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(showTooltip, HOLD_TIME);
    });

    btn.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        removeTooltip();
    });
}

function showTooltip() {
    removeTooltip();

    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;

    tooltip.innerHTML = `
<b>📥 Smart Downloader</b><br><br>
• Click → Download video<br>
• Drag → Move button<br><br>
<b>⌨️ Controls</b><br>
ALT + SHIFT + D → Direct Download<br>
ALT + SHIFT + N → Show / Hide Button
`;

    document.body.appendChild(tooltip);

    const r = btn.getBoundingClientRect();
    tooltip.style.left = r.left + 'px';
    tooltip.style.top = (r.top - tooltip.offsetHeight - 12) + 'px';
}

function removeTooltip() {
    tooltip?.remove();
    tooltip = null;
}

/* =====================================================
   ⌨️ HOTKEYS (ALL BROWSERS)
===================================================== */

document.addEventListener('keydown', e => {
    if (e.altKey && e.shiftKey && e.code === 'KeyN') {
        visible = !visible;
        GM_setValue(KEY_VISIBLE, visible);
        btn?.classList.toggle('hide', !visible);
    }

    if (e.altKey && e.shiftKey && e.code === 'KeyD') {
        if (isAllowedSite() && !isVidssave()) startDownload();
    }
});

/* =====================================================
   🧠 REACT SAFE INPUT SETTER
===================================================== */

function reactSetValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
    ).set;

    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/* =====================================================
   🔗 VIDSSAVE AUTO PASTE (BACKGROUND MODE)
===================================================== */

async function handleVidssave() {
    const url = GM_getValue(KEY_URL);
    if (!url) return;

    for (let i = 0; i < 30; i++) {
        const input = document.querySelector('#url-input-wrapper');
        const btn = document.querySelector('button');

        if (input && btn) {
            input.focus();
            reactSetValue(input, '');
            await sleep(150);
            reactSetValue(input, url);
            await sleep(400);
            btn.click();
            GM_setValue(KEY_URL, '');
            break;
        }
        await sleep(400);
    }
}

/* =====================================================
   🔄 SPA WATCHER
===================================================== */

setInterval(() => {
    if (location.href !== lastURL) {
        lastURL = location.href;

        setTimeout(() => {

            if (isVidssave()) {
                document.getElementById(BTN_ID)?.remove();
                handleVidssave();
                return;
            }

            if (!isAllowedSite()) {
                document.getElementById(BTN_ID)?.remove();
                return;
            }

            createButton();
            updateButtonText();

        }, 800);
    }
}, SPA_DELAY);

/* =====================================================
   🚀 INIT
===================================================== */

function init() {
    if (isVidssave()) {
        handleVidssave();
        return;
    }
    if (isAllowedSite()) createButton();
}

setTimeout(init, 1200);

})();
