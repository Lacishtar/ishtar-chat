// NOTE: this module and message-renderer.js import from each other

import { state, listEl } from './state.js';
import { createMessageNode } from './message-renderer.js';

const DEFAULT_LANE_COUNT = 12;
const MIN_LANE_COUNT = 3;
const MAX_LANE_COUNT = 30;
const BASE_LANE_DURATION_SEC = [9, 11, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11];
const DEFAULT_LANE_EDGE_MARGIN_PCT = 4;
const MIN_FLYABLE_BAND_PCT = 10;

let danmakuLaneCursor = 0;

function laneCount() {
  const n = Number(state.currentConfig?.danmakuLanes);
  if (!Number.isFinite(n)) return DEFAULT_LANE_COUNT;
  return Math.min(MAX_LANE_COUNT, Math.max(MIN_LANE_COUNT, Math.round(n)));
}

function speedMultiplier() {
  const n = Number(state.currentConfig?.danmakuSpeed);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function marginPct(rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return DEFAULT_LANE_EDGE_MARGIN_PCT;
  return Math.min(Math.max(n, 0), 45);
}

function laneAreaMargins() {
  let top = marginPct(state.currentConfig?.danmakuAreaTopPct);
  let bottom = marginPct(state.currentConfig?.danmakuAreaBottomPct);
  const maxTotal = 100 - MIN_FLYABLE_BAND_PCT;
  const total = top + bottom;
  if (total > maxTotal) {
    const scale = maxTotal / total;
    top *= scale;
    bottom *= scale;
  }
  return { top, bottom };
}

function laneTopPercent(lane, total) {
  const { top, bottom } = laneAreaMargins();
  const usable = 100 - top - bottom;
  const step = total > 1 ? usable / (total - 1) : 0;
  return `${top + step * lane}%`;
}

function laneDurationSec(lane) {
  const base = BASE_LANE_DURATION_SEC[lane % BASE_LANE_DURATION_SEC.length];
  return base / speedMultiplier();
}

export function resetDanmaku() {
  danmakuLaneCursor = 0;
}

function pickDanmakuLane() {
  const total = laneCount();
  const lane = danmakuLaneCursor % total;
  danmakuLaneCursor += 1;
  return { lane, total };
}

function bindDanmakuRemoval(node) {
  const onEnd = (ev) => {
    if (ev.target === node && ev.animationName === 'ovs-danmaku-fly') {
      node.removeEventListener('animationend', onEnd);
      if (node.isConnected) node.remove();
    }
  };
  node.addEventListener('animationend', onEnd);
}

function trimDanmakuOverflow() {
  const max = state.currentConfig?.maxMessages || 40;
  while (listEl.children.length > max) {
    const oldest = listEl.firstElementChild;
    if (!oldest) break;
    oldest.remove();
  }
}

const MAX_DANMAKU_CONCURRENT_NODES = 8;

export function appendDanmakuMessage(msg) {
  if (listEl && listEl.children.length >= MAX_DANMAKU_CONCURRENT_NODES) {
    return;
  }
  const node = createMessageNode(msg, { skipEnterAnimation: true });
  const { lane, total } = pickDanmakuLane();
  const durationSec = laneDurationSec(lane);

  node.dataset.danmakuLane = String(lane);
  node.style.top = laneTopPercent(lane, total);
  node.style.animationDuration = `${durationSec}s`;
  bindDanmakuRemoval(node);

  listEl.appendChild(node);
  trimDanmakuOverflow();
}

const MAX_DANMAKU_REPLAY_HISTORY = 5;

export function renderDanmakuHistory(history) {
  resetDanmaku();
  listEl.innerHTML = '';
  if (!Array.isArray(history) || history.length === 0) return;
  const ordered = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  const recent = ordered.slice(-MAX_DANMAKU_REPLAY_HISTORY);
  recent.forEach((msg) => appendDanmakuMessage(msg));
}

// ============================================================================
// ============================================================================

const BASE_TICKER_SPEED_PX_PER_SEC = 120;
let tickerQueue = [];
let tickerActiveNodes = [];
let tickerRafId = null;
let lastTickerTimestamp = null;

function tickerSpeedMultiplier() {
  const n = Number(state.currentConfig?.tickerSpeed);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function tickerGapPx() {
  const n = Number(state.currentConfig?.tickerGap);
  return Number.isFinite(n) && n >= 0 ? n : 32;
}

function syncTickerPositionAttr() {
  if (!listEl) return;
  const pos = state.currentConfig?.tickerPosition === 'top' ? 'top' : 'bottom';
  listEl.dataset.ovsTickerPosition = pos;
}

export function resetTicker() {
  if (tickerRafId) {
    cancelAnimationFrame(tickerRafId);
    tickerRafId = null;
  }
  tickerQueue = [];
  tickerActiveNodes = [];
  lastTickerTimestamp = null;
  if (listEl) listEl.innerHTML = '';
}

function stepTicker(timestamp) {
  if (!lastTickerTimestamp) lastTickerTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTickerTimestamp) / 1000, 0.1);
  lastTickerTimestamp = timestamp;

  const speed = BASE_TICKER_SPEED_PX_PER_SEC * tickerSpeedMultiplier();
  const dx = speed * dt;
  const gap = tickerGapPx();
  const containerWidth = listEl ? (listEl.clientWidth || window.innerWidth) : window.innerWidth;
  const rightMargin = 24; // Padding from screen right edge for the resting message

  syncTickerPositionAttr();

  // Move active nodes leftward
  for (let i = 0; i < tickerActiveNodes.length; i += 1) {
    const item = tickerActiveNodes[i];
    item.positionX -= dx;
  }

  // Spawn queued messages onto the trailing edge if space is available
  while (tickerQueue.length > 0) {
    let spawnX = containerWidth;
    if (tickerActiveNodes.length > 0) {
      const trailing = tickerActiveNodes[tickerActiveNodes.length - 1];
      const trailingRight = trailing.positionX + trailing.width;
      if (trailingRight + gap > containerWidth) {
        // Trailing message has not cleared enough room yet
        break;
      }
      spawnX = Math.max(containerWidth, trailingRight + gap);
    }

    const msg = tickerQueue.shift();
    const el = createMessageNode(msg, { skipEnterAnimation: true });
    el.style.transform = `translate3d(${spawnX}px, -50%, 0)`;
    listEl.appendChild(el);

    // Measure node width
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width || 0, 100);

    tickerActiveNodes.push({ el, width, positionX: spawnX });
  }

  const latestFitsScreen = tickerActiveNodes.length > 0
    && tickerActiveNodes[tickerActiveNodes.length - 1].width + rightMargin <= containerWidth;

  if (tickerQueue.length === 0 && latestFitsScreen) {
    const latest = tickerActiveNodes[tickerActiveNodes.length - 1];
    const targetX = Math.max(0, containerWidth - latest.width - rightMargin);

    if (latest.positionX <= targetX) {
      // Snap latest node to target resting position and adjust all preceding nodes
      const correction = targetX - latest.positionX;
      for (let i = 0; i < tickerActiveNodes.length; i += 1) {
        const item = tickerActiveNodes[i];
        item.positionX += correction;
        item.el.style.transform = `translate3d(${item.positionX}px, -50%, 0)`;
      }

      // Cleanup any off-screen nodes
      while (tickerActiveNodes.length > 0) {
        const first = tickerActiveNodes[0];
        if (first.positionX + first.width <= 0) {
          if (first.el.isConnected) first.el.remove();
          tickerActiveNodes.shift();
        } else {
          break;
        }
      }

      // Stop loop until new message arrives
      tickerRafId = null;
      lastTickerTimestamp = null;
      return;
    }
  }

  // Update DOM transform positions for active nodes
  for (let i = 0; i < tickerActiveNodes.length; i += 1) {
    const item = tickerActiveNodes[i];
    item.el.style.transform = `translate3d(${item.positionX}px, -50%, 0)`;
  }

  // Remove nodes that scrolled off-screen to the left
  while (tickerActiveNodes.length > 0) {
    const first = tickerActiveNodes[0];
    if (first.positionX + first.width <= 0) {
      if (first.el.isConnected) first.el.remove();
      tickerActiveNodes.shift();
    } else {
      break;
    }
  }

  // Continue rAF loop if there are active or queued messages
  if (tickerActiveNodes.length > 0 || tickerQueue.length > 0) {
    tickerRafId = requestAnimationFrame(stepTicker);
  } else {
    tickerRafId = null;
    lastTickerTimestamp = null;
  }
}

function ensureTickerLoopRunning() {
  if (!tickerRafId) {
    lastTickerTimestamp = null;
    tickerRafId = requestAnimationFrame(stepTicker);
  }
}

const MAX_TICKER_QUEUE_SIZE = 3;

export function appendTickerMessage(msg) {
  tickerQueue.push(msg);
  if (tickerQueue.length > MAX_TICKER_QUEUE_SIZE) {
    tickerQueue = tickerQueue.slice(-MAX_TICKER_QUEUE_SIZE);
  }
  ensureTickerLoopRunning();
}

const MAX_TICKER_REPLAY_HISTORY = 3;

export function renderTickerHistory(history) {
  resetTicker();
  if (!Array.isArray(history) || history.length === 0) return;
  const ordered = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  const recent = ordered.slice(-MAX_TICKER_REPLAY_HISTORY);
  recent.forEach((msg) => tickerQueue.push(msg));
  ensureTickerLoopRunning();
}

