// ==UserScript==
// @name        5 Button X GENYT (FINAL STABLE)
// @namespace   http://tampermonkey.net/
// @version     2026-03-03
// @description Panel Fix + Auto Theme Detect + All Working
// @match       https://www.youtube.com/*
// @grant       none
// ==/UserScript==

(function () {
'use strict';

/* ================= WAIT FOR FULL LOAD (PANEL FIX) ================= */

function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(init);

function init() {

/* ================= STATE ================= */

let skipEnabled = false;
let videoCount = 0;
let lastUrl = location.href;

const stateKey = '__yt_enhancer_state';
const savedState = JSON.parse(sessionStorage.getItem(stateKey) || '{}');

skipEnabled = savedState.skipEnabled || false;
videoCount = savedState.videoCount || 0;

function saveState() {
  sessionStorage.setItem(stateKey, JSON.stringify({
    skipEnabled,
    videoCount
  }));
}

/* ================= CREATE PANEL ================= */

const panel = document.createElement('div');
panel.id = "yt-enhancer-panel";
panel.style.cssText = `
position: fixed;
top: 100px;
left: 100px;
z-index: 9999999999;
display: flex;
gap: 12px;
padding: 10px;
background: rgba(0,0,0,0.6);
border-radius: 14px;
box-shadow: 0 0 10px rgba(0,0,0,0.4);
cursor: move;
user-select: none;
`;

/* Prevent duplicate panel */
if (document.getElementById("yt-enhancer-panel")) return;

/* ================= COUNTER ================= */

const counter = createCircle(videoCount);
panel.appendChild(counter);

function updateCounter() {
  counter.textContent = videoCount;
  saveState();
}

/* ================= SKIP 14s ================= */

const skipBtn = createCircle('14s');
panel.appendChild(skipBtn);

let skipInterval = null;

function activateSkip() {
  skipBtn.style.background = '#006600';
  skipInterval = setInterval(skipTo14s, 1000);
}

function deactivateSkip() {
  skipBtn.style.background = 'black';
  clearInterval(skipInterval);
}

skipBtn.onclick = () => {
  skipEnabled = !skipEnabled;
  skipEnabled ? activateSkip() : deactivateSkip();
  saveState();
};

if (skipEnabled) activateSkip();

function skipTo14s() {
  const video = document.querySelector('video');
  const isPlaylist = new URL(location.href).searchParams.has('list');
  if (video && skipEnabled && isPlaylist && video.currentTime < 14) {
    video.currentTime = 14;
  }
}

/* ================= DOWNLOAD ================= */

const downloadBtn = createCircle('⬇');
panel.appendChild(downloadBtn);

downloadBtn.onclick = () => {
  const url = location.href.replace('youtube.com', 'sosyoutube.com');
  window.open(url, '_blank');
};

/* ================= HD GENYT ================= */

const hdBtn = createCircle('HD');
panel.appendChild(hdBtn);

function getVideoID(url) {
  const match = url.match(/[?&]v=([^&]{11})/);
  return match ? match[1] : null;
}

hdBtn.onclick = () => {
  const vid = getVideoID(location.href);
  if (!vid) return;
  window.open(`https://video.genyt.net/${vid}#download`, '_blank');
};

/* ================= SMART THEME BUTTON ================= */

const themeBtn = createCircle('🌗');
panel.appendChild(themeBtn);

function isDarkMode() {
  return document.documentElement.hasAttribute('dark');
}

function enableDark() {
  document.documentElement.setAttribute('dark', '');
}

function disableDark() {
  document.documentElement.removeAttribute('dark');
}

themeBtn.onclick = () => {
  if (isDarkMode()) {
    disableDark();   // black → white
  } else {
    enableDark();    // white → black
  }
};

/* ================= URL WATCH ================= */

setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (new URL(lastUrl).searchParams.has('list')) {
      videoCount++;
      updateCounter();
    }
  }
}, 1000);

/* ================= DRAG ================= */

let offsetX = 0, offsetY = 0, dragging = false;

panel.addEventListener('mousedown', e => {
  dragging = true;
  offsetX = e.clientX - panel.offsetLeft;
  offsetY = e.clientY - panel.offsetTop;
});

document.addEventListener('mousemove', e => {
  if (!dragging) return;
  panel.style.left = e.clientX - offsetX + 'px';
  panel.style.top = e.clientY - offsetY + 'px';
});

document.addEventListener('mouseup', () => dragging = false);

/* ================= ADD PANEL SAFELY ================= */

document.body.appendChild(panel);

/* ================= HELPER ================= */

function createCircle(text) {
  const btn = document.createElement('div');
  btn.textContent = text;
  btn.style.cssText = `
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: black;
  color: white;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  `;
  return btn;
}

}

})();