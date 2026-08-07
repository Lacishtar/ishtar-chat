// NOTE: this module and message-renderer.js import from each other

import { state, listEl } from './state.js';
import { createMessageNode } from './message-renderer.js';

const DEFAULT_LANE_COUNT = 12;
const MIN_LANE_COUNT = 3;
const MAX_LANE_COUNT = 30;
const BASE_LANE_DURATION_SEC = [9, 11, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11];
const DEFAULT_LANE_EDGE_MARGIN_PCT = 4;
const MIN_FLYABLE_BAND_PCT = 10;

// How many bullets are allowed to fly in the SAME lane at the same time.
// >1 is what makes a lane feel "busy" during chat bursts instead of every
// message queueing up one lane apart; 3 keeps a lane readable (bullets in
// the same lane still start at staggered times/x-positions, they just no
// longer have to wait for the lane to be completely empty first).
const LANE_MAX_CONCURRENT = 3;

// Minimum horizontal gap (px) enforced between the trailing edge of a
// just-spawned bullet and the next bullet allowed to spawn in the same
// lane. Bullets always start at the same x (left:100%), so without this,
// two messages assigned to the same lane in quick succession (a chat
// burst) would spawn almost on top of each other and stay visually
// overlapped for their entire flight, since same-lane bullets move at
// identical speed and never close the gap they spawned with.
const DANMAKU_LANE_SPAWN_GAP_PX = 24;

// Per-lane bookkeeping (indexed by lane number) of when that lane will
// next have enough clearance for another bullet, derived from the width
// of the most recently spawned bullet in that lane and the lane's speed.
// This is separate from countLaneOccupancy() (which only limits *how
// many* bullets share a lane) — this prevents them from overlapping
// regardless of the count cap.
const laneClearAt = new Array(MAX_LANE_COUNT).fill(0);

// Total on-screen bullets across ALL lanes — a flat perf/readability cap
// regardless of the lane-count setting. Scaled off laneCount() (with a
// floor) so raising "Số làn" also raises how many bullets can be in
// flight at once; otherwise a high lane count would rarely let any lane
// reach LANE_MAX_CONCURRENT and the multi-bullet-per-lane behavior above
// would almost never actually show up.
const MIN_DANMAKU_CONCURRENT_NODES = 8;
const DANMAKU_CONCURRENT_NODES_PER_LANE = 1.5;

function maxConcurrentNodes() {
  const total = laneCount();
  return Math.max(MIN_DANMAKU_CONCURRENT_NODES, Math.round(total * DANMAKU_CONCURRENT_NODES_PER_LANE));
}

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

// Bullets travel 200vw over laneDurationSec(lane) seconds (see
// danmaku.css), so this converts that into a px/sec rate for the given
// lane, used to translate a pixel gap into a "wait this long" duration.
function laneSpeedPxPerSec(lane) {
  const viewportWidth = (listEl && listEl.clientWidth) || window.innerWidth || 1;
  const distancePx = viewportWidth * 2; // matches translateX(-200vw)
  return distancePx / laneDurationSec(lane);
}

export function resetDanmaku() {
  // Lane occupancy is derived live from the DOM (see countLaneOccupancy())
  // rather than kept in a running counter, so there is nothing to reset
  // here beyond the DOM itself — callers (clearAllMessages/
  // renderDanmakuHistory) already clear listEl separately. Kept as a
  // no-op export so those call sites don't need to change.
  //
  // laneClearAt IS reset here though: it holds absolute performance.now()
  // timestamps, and stale future timestamps from before a clear (e.g. a
  // theme/config change) must not block lanes once the DOM is empty.
  laneClearAt.fill(0);
}

// Counts how many bullets currently in the DOM are in each lane.
function countLaneOccupancy(total) {
  const counts = new Array(total).fill(0);
  if (!listEl) return counts;
  for (const child of listEl.children) {
    const laneAttr = child.dataset ? child.dataset.danmakuLane : undefined;
    if (laneAttr === undefined) continue;
    const lane = Number(laneAttr);
    if (Number.isInteger(lane) && lane >= 0 && lane < total) counts[lane] += 1;
  }
  return counts;
}

// Randomly picks a lane that still has room (< LANE_MAX_CONCURRENT active
// bullets) instead of always advancing to "the next lane" — every new
// message gets an unpredictable lane, and lanes are freely reused while
// they still have a free slot, letting 2-3 bullets share a lane at once.
// Falls back to the least-occupied lane on the rare chance every lane is
// already full (appendDanmakuMessage's maxConcurrentNodes() cap makes
// this essentially unreachable in practice).
function pickDanmakuLane() {
  const total = laneCount();
  const counts = countLaneOccupancy(total);
  const now = performance.now();

  // Lanes with room (< LANE_MAX_CONCURRENT) AND enough spawn clearance
  // (see laneClearAt) — i.e. actually safe to reuse without overlapping
  // the last bullet spawned there.
  const clearCandidates = [];
  // Lanes with room but not yet clear — used as a fallback so a lane
  // isn't rejected outright just for being momentarily too close; better
  // than colliding, but still preferred over reusing a full lane.
  const roomyCandidates = [];
  let leastLane = 0;
  let leastCount = Infinity;
  for (let i = 0; i < total; i += 1) {
    const count = counts[i];
    if (count < leastCount) {
      leastCount = count;
      leastLane = i;
    }
    if (count < LANE_MAX_CONCURRENT) {
      roomyCandidates.push(i);
      if (now >= laneClearAt[i]) clearCandidates.push(i);
    }
  }

  const pool = clearCandidates.length > 0
    ? clearCandidates
    : (roomyCandidates.length > 0 ? roomyCandidates : null);

  const lane = pool
    ? pool[Math.floor(Math.random() * pool.length)]
    : leastLane;
  return { lane, total };
}

// Records when `lane` will next have enough clearance for another
// bullet, based on the just-spawned node's actual rendered width (must
// be called after the node is in the DOM) and the lane's speed.
function markLaneSpawn(lane, node) {
  const width = node.offsetWidth || 0;
  const speed = laneSpeedPxPerSec(lane);
  const gapMs = ((width + DANMAKU_LANE_SPAWN_GAP_PX) / speed) * 1000;
  laneClearAt[lane] = performance.now() + gapMs;
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

export function appendDanmakuMessage(msg) {
  if (listEl && listEl.children.length >= maxConcurrentNodes()) {
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
  markLaneSpawn(lane, node);
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

