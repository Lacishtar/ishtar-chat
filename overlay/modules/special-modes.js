// Danmaku (flying-lane) and Ticker (horizontal-scroll) rendering modes.
//
// NOTE: this module and message-renderer.js import from each other
// (special-modes needs createMessageNode; message-renderer needs
// appendTickerMessage/appendDanmakuMessage/resetTickerPlayback/resetDanmaku
// to dispatch renderMessage()/renderHistory() by theme mode). That's a
// circular ES module import, which is safe here because every cross-use
// happens *inside* a function body, never at module-evaluation time.

import { state, listEl, TICKER_THEMES } from './state.js';
import { createMessageNode } from './message-renderer.js';

// ── Danmaku ────────────────────────────────────────────────────────────

const DANMAKU_LANE_COUNT = 12;
const DANMAKU_LANE_TOP = ['4%', '12%', '20%', '28%', '36%', '44%', '52%', '60%', '68%', '76%', '84%', '92%'];
const DANMAKU_LANE_BASE_DURATION_SEC = [9, 11, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11];
const DANMAKU_SPEED = 3;
let danmakuLaneCursor = 0;

function danmakuLaneDurationSec(lane) {
  return DANMAKU_LANE_BASE_DURATION_SEC[lane] / DANMAKU_SPEED;
}

export function resetDanmaku() {
  danmakuLaneCursor = 0;
}

function pickDanmakuLane() {
  const lane = danmakuLaneCursor % DANMAKU_LANE_COUNT;
  danmakuLaneCursor += 1;
  return lane;
}

function bindDanmakuRemoval(node) {
  node.addEventListener(
    'animationend',
    (ev) => {
      if (ev.target === node && ev.animationName === 'ovs-danmaku-fly' && node.isConnected) {
        node.remove();
      }
    },
    { once: true }
  );
}

export function appendDanmakuMessage(msg) {
  const node = createMessageNode(msg);
  const lane = pickDanmakuLane();
  const durationSec = danmakuLaneDurationSec(lane);

  node.dataset.danmakuLane = String(lane);
  node.style.top = DANMAKU_LANE_TOP[lane];
  node.style.animationDuration = `${durationSec}s`;
  bindDanmakuRemoval(node);

  listEl.appendChild(node);
}

// ── Ticker ─────────────────────────────────────────────────────────────

const TICKER_SCROLL_PX_PER_SEC = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 260;

let tickerTrackEl = null;
let tickerOffset = 0;
let tickerTargetOffset = 0;
let tickerRafId = null;
let tickerLastFrameTs = 0;

export function getTickerTrackEl() {
  return tickerTrackEl;
}

export function resetTickerPlayback() {
  if (tickerRafId) {
    cancelAnimationFrame(tickerRafId);
    tickerRafId = null;
  }
  tickerLastFrameTs = 0;
  tickerOffset = 0;
  tickerTargetOffset = 0;
  tickerTrackEl = null;
}

function ensureTickerTrack() {
  if (!tickerTrackEl || !tickerTrackEl.isConnected) {
    tickerTrackEl = document.createElement('div');
    tickerTrackEl.className = 'ovs-ticker-track';
    tickerTrackEl.setAttribute('aria-live', 'polite');
    listEl.appendChild(tickerTrackEl);
  }
  return tickerTrackEl;
}

function getTickerViewportWidth() {
  const style = getComputedStyle(listEl);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  return Math.max(0, listEl.clientWidth - paddingLeft - paddingRight);
}

function recalcTickerTarget() {
  if (!tickerTrackEl) return 0;
  const viewportW = getTickerViewportWidth();
  const trackW = tickerTrackEl.scrollWidth;
  return Math.max(0, trackW - viewportW);
}

function measureLeadingTickerItemWidth(first) {
  if (!first) return 0;
  const second = first.nextElementSibling;
  return second ? second.offsetLeft : first.offsetWidth;
}

function applyTickerTransform() {
  if (!tickerTrackEl) return;
  tickerTrackEl.style.transform = `translate3d(${-tickerOffset}px, -50%, 0)`;
}

function pruneLeftmostTickerMessages() {
  if (!tickerTrackEl) return;
  while (tickerTrackEl.firstElementChild) {
    const first = tickerTrackEl.firstElementChild;
    const pruneWidth = measureLeadingTickerItemWidth(first);
    if (pruneWidth <= 0) break;
    if (tickerOffset < pruneWidth - 0.5) break;
    first.remove();
    tickerOffset -= pruneWidth;
    tickerTargetOffset = Math.max(0, tickerTargetOffset - pruneWidth);
  }
}

function trimTickerDom() {
  if (!tickerTrackEl) return;
  const max = state.currentConfig.maxMessages || 40;
  while (tickerTrackEl.children.length > max) {
    const first = tickerTrackEl.firstElementChild;
    const pruneWidth = measureLeadingTickerItemWidth(first);
    first.remove();
    tickerOffset = Math.max(0, tickerOffset - pruneWidth);
    tickerTargetOffset = Math.max(0, tickerTargetOffset - pruneWidth);
  }
  tickerTargetOffset = recalcTickerTarget();
  tickerOffset = Math.min(tickerOffset, tickerTargetOffset);
  applyTickerTransform();
}

function tickerScrollLoop(ts) {
  if (!tickerTrackEl) {
    tickerRafId = null;
    tickerLastFrameTs = 0;
    return;
  }

  if (!tickerLastFrameTs) tickerLastFrameTs = ts;
  const dt = Math.min((ts - tickerLastFrameTs) / 1000, 0.05);
  tickerLastFrameTs = ts;

  if (tickerOffset < tickerTargetOffset) {
    tickerOffset = Math.min(tickerTargetOffset, tickerOffset + TICKER_SCROLL_PX_PER_SEC * dt);
    pruneLeftmostTickerMessages();
    applyTickerTransform();
    tickerRafId = requestAnimationFrame(tickerScrollLoop);
    return;
  }

  tickerLastFrameTs = 0;
  tickerRafId = null;
}

function startTickerScrollLoop() {
  tickerTargetOffset = recalcTickerTarget();
  if (tickerRafId || tickerOffset >= tickerTargetOffset) return;
  tickerRafId = requestAnimationFrame(tickerScrollLoop);
}

export function appendTickerMessage(msg) {
  const track = ensureTickerTrack();
  track.appendChild(createMessageNode(msg));
  trimTickerDom();
  startTickerScrollLoop();
}

// Rebuilds the ticker track from a full history array (used on initial
// load and on theme switch). `msg -> node` creation order follows
// `currentConfig.position` the same way trimToMax()/renderMessage() do
// for the stack modes.
export function renderTickerHistory(history) {
  resetTickerPlayback();
  listEl.innerHTML = '';
  const track = ensureTickerTrack();
  const ordered = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  ordered.forEach((msg) => track.appendChild(createMessageNode(msg)));
  trimTickerDom();
  tickerOffset = tickerTargetOffset;
  applyTickerTransform();
}

export function renderDanmakuHistory(history) {
  resetDanmaku();
  listEl.innerHTML = '';
  const ordered = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  ordered.forEach((msg) => appendDanmakuMessage(msg));
}

// Called from the entry file's window "resize" listener.
export function handleTickerResize() {
  if (!TICKER_THEMES.has(state.currentTheme) || !tickerTrackEl) return;
  tickerTargetOffset = recalcTickerTarget();
  tickerOffset = Math.min(tickerOffset, tickerTargetOffset);
  applyTickerTransform();
  startTickerScrollLoop();
}
