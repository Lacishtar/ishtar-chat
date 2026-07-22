// Danmaku (flying-bullet) rendering mode — an alternative to the normal
// stacked chat feed. Each message becomes one absolutely-positioned node
// that flies once across the screen on a CSS animation (see
// overlay/danmaku.css for the `ovs-danmaku-fly` keyframe + container
// styles, both scoped to `#ovs-chat-list[data-ovs-theme-mode='danmaku']`)
// and removes itself when the animation ends.
//
// NOTE: this module and message-renderer.js import from each other
// (special-modes needs createMessageNode; message-renderer needs
// appendDanmakuMessage/renderDanmakuHistory to dispatch by display mode).
// That's a circular ES module import, which is safe here because every
// cross-use happens *inside* a function body, never at module-evaluation
// time.

import { state, listEl } from './state.js';
import { createMessageNode } from './message-renderer.js';

const DEFAULT_LANE_COUNT = 12;
const MIN_LANE_COUNT = 3;
const MAX_LANE_COUNT = 30;
// Base flight durations (seconds) per lane index before the user's speed
// multiplier is applied. Slightly varied per lane (rather than one flat
// number) so bullets in different lanes don't all move in visual lockstep.
// Cycled with `% length` for lane counts other than this array's own size.
const BASE_LANE_DURATION_SEC = [9, 11, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11];
// Keep lanes off the very top/bottom edge of the screen. Defaults mirror
// the old hardcoded margin; user-configurable via danmakuAreaTopPct /
// danmakuAreaBottomPct so streamers can carve out extra clearance where
// another overlay element (webcam, alert box, ticker, ...) sits, or just
// stop bullets from reading as jammed together right at the edges.
const DEFAULT_LANE_EDGE_MARGIN_PCT = 4;
// However this is configured, always leave at least this much of the
// screen height flyable — otherwise a bad combination of top+bottom
// margins could collapse the band to nothing (or invert it).
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

// Resolves the configured top/bottom margins together, clamping their sum
// so at least MIN_FLYABLE_BAND_PCT of the screen height stays flyable. If
// the user's two values leave too little room, both are scaled down
// proportionally rather than picking one to "win" arbitrarily.
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
  // Do NOT use { once: true } here. `animationend` bubbles, so a child
  // element firing its own animation (e.g. from theme CSS) would consume
  // the { once: true } listener before `ovs-danmaku-fly` fires — leaving
  // the bullet in the DOM forever. We instead keep the listener alive and
  // self-remove it once the correct animation/target pair is matched.
  const onEnd = (ev) => {
    if (ev.target === node && ev.animationName === 'ovs-danmaku-fly') {
      node.removeEventListener('animationend', onEnd);
      if (node.isConnected) node.remove();
    }
  };
  node.addEventListener('animationend', onEnd);
}

// Safety net: bullets normally remove themselves on animationend, but if
// messages arrive faster than they can fly off-screen (or the tab was
// backgrounded and rAF/animation timers stalled), cap how many concurrent
// nodes we keep so the DOM can't grow without bound.
function trimDanmakuOverflow() {
  const max = state.currentConfig?.maxMessages || 40;
  while (listEl.children.length > max) {
    const oldest = listEl.firstElementChild;
    if (!oldest) break;
    oldest.remove();
  }
}

export function appendDanmakuMessage(msg) {
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

// Rebuilds the danmaku playback from a full history array (used on initial
// load, on theme switch, and whenever displayMode flips to 'danmaku').
// Ordered oldest-first so replayed history flies past in the order the
// messages actually arrived, mirroring how renderHistory() feeds the stack
// mode's renderMessage() loop.
export function renderDanmakuHistory(history) {
  resetDanmaku();
  listEl.innerHTML = '';
  const ordered = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  ordered.forEach((msg) => appendDanmakuMessage(msg));
}
