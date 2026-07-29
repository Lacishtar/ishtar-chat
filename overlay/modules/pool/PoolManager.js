// PoolManager — the integration seam between the generic BubblePool
// engine and this app's chat bubbles.
//
// This is the ONLY file under overlay/modules/pool/ that imports state.js.
// Everything else in this folder (BubblePool, PoolItem, PoolConfig,
// bubble-reset) is intentionally renderer-agnostic. This file exists
// specifically to plug the two renderer-specific pieces the generic engine
// needs — "how do I make a new one" and "how do I neutralize one" — into
// BubblePool, so render-queue.js never has to know either of those things
// itself. render-queue.js only ever calls acquire()/release()/etc. on the
// exported bubblePoolManager below.
//
// Ownership boundary: the Pool never appends/removes a bubble to/from
// #ovs-chat-list itself — that's still exclusively render-queue.js's job
// (per its own header comment). The Pool only ever hands back a value from
// acquire() and takes one back via release(); what the caller does with it
// in the visible DOM is entirely up to the caller.

import { state } from '../state.js';
import { BubblePool } from './BubblePool.js';
import { resetBubbleNode, detachBubbleNode, captureBubbleBaseline } from './bubble-reset.js';
import { DEFAULT_MAX_POOL_SIZE, DEFAULT_WARMUP_SIZE, DEFAULT_SHRINK_CHECK_INTERVAL_MS } from './PoolConfig.js';

// Bare clone of whatever the CURRENT theme's template looks like right
// now. Reads state.messageTemplate lazily (at call time, not at module-
// eval time) so a theme switch that swaps state.messageTemplate is picked
// up automatically the next time the pool needs to build something new —
// this module never caches the template reference itself.
//
// captureBubbleBaseline() runs immediately on the fresh clone, before
// createMessageNode() ever gets a chance to add a single role/event class
// to it — this is the only correct moment to record "what a clean row
// looked like", so resetBubbleNode() (bubble-reset.js) can restore exactly
// that later, no matter how many times this same node gets built and
// released in between.
function createBareBubbleNode() {
  const tpl = state.messageTemplate;
  if (!tpl || !tpl.content || !tpl.content.firstElementChild) {
    throw new Error('[BubblePool] no message template loaded yet — cannot build a bubble node');
  }
  const node = tpl.content.firstElementChild.cloneNode(true);
  captureBubbleBaseline(node);
  return node;
}

// destroy() hook for items dropped for real (pool at capacity, or an
// explicit clear()) — a released/dropped node isn't inserted anywhere by
// definition, but if some caller handed us a still-attached node (e.g.
// clear() being called on ACTIVE items), make sure it actually leaves the
// document rather than lingering as an orphaned-but-still-mounted node.
function destroyBubbleNode(node) {
  detachBubbleNode(node);
}

// The underlying generic engine, configured for this app's bubble nodes.
// A fresh template means old cloned nodes are structurally stale (built
// from the PREVIOUS theme's markup) — that's why loadTheme()/theme-loader
// calls resetPoolForThemeSwitch() below rather than just letting old IDLE
// nodes linger to be reused under a new theme.
const enginePool = new BubblePool({
  factory: createBareBubbleNode,
  reset: resetBubbleNode,
  destroy: destroyBubbleNode,
  maxSize: DEFAULT_MAX_POOL_SIZE,
  warmupSize: DEFAULT_WARMUP_SIZE,
});

// Resolves how many nodes a no-arg warmup() call should pre-build. Pool
// Size is user-configurable (shared/customize-config.js#poolWarmupSize,
// editable from the dashboard's Animation section same as maxMessages) —
// read from state.currentConfig LAZILY, at call time, rather than baked
// into the BubblePool constructor above, so a config that arrives/changes
// AFTER this module first evaluates (the normal case: currentConfig is
// only populated once the overlay's initial state / a theme payload
// lands) is still picked up correctly the next time warmup() runs, e.g.
// after a theme switch. An explicit `count` argument always wins.
function resolveWarmupCount(count) {
  if (Number.isFinite(count) && count >= 0) return Math.floor(count);
  const configured = Number(state.currentConfig?.poolWarmupSize);
  if (Number.isFinite(configured) && configured >= 0) return Math.floor(configured);
  return DEFAULT_WARMUP_SIZE;
}

// Handle for the Dynamic Pool's background reclamation timer (see
// startDynamicManagement()/stopDynamicManagement() below). Lives at
// module scope, not on enginePool, because owning a timer is a
// renderer/lifecycle concern — BubblePool itself stays fully
// synchronous/timer-free (see its header comment) so it keeps being
// trivially unit-testable without an open handle to worry about.
let reclaimTimer = null;

export const bubblePoolManager = {
  /**
   * Hands back a ready-to-build bubble node: DOM-detached, neutral
   * (already run through resetBubbleNode(), or brand-new from the
   * template), and marked ACTIVE. `messageId`, if given, is stored only
   * for diagnostics (PoolItem#key) — the pool itself doesn't index by it.
   */
  acquire(messageId = null) {
    return enginePool.acquire(messageId);
  },

  /**
   * Returns a bubble node to the pool: detaches it from the document (if
   * still mounted), scrubs every renderer-applied field (text/author/
   * badge/texture/decoration/animation state/transform/opacity/dataset/
   * inline style — see bubble-reset.js), and parks it IDLE for reuse.
   *
   * The detach here is a plain, reversible DOM operation (leaving the
   * visible list), NOT a destroy — the underlying node object is still
   * fully alive and owned by the Pool afterwards, ready to be handed back
   * out by acquire(). Nothing about release() ever discards the node
   * itself while the Pool is managing it; it's only actually dropped (see
   * BubblePool#release's capacity check) if the pool is already full.
   */
  release(node) {
    if (!node) return false;
    detachBubbleNode(node);
    return enginePool.release(node);
  },

  /**
   * Pre-builds IDLE nodes so the first burst of acquire() calls (app
   * startup, or right after a theme switch resets the pool) doesn't pay
   * factory() cost inline.
   *
   * `count`, if given, is used as-is. Otherwise the count comes from the
   * user-configurable Pool Size (state.currentConfig.poolWarmupSize),
   * falling back to DEFAULT_WARMUP_SIZE if that's unset. Never exceeds
   * maxSize (enforced by BubblePool#warmup) and never destroys anything
   * already ACTIVE — idempotent, safe to call more than once.
   */
  warmup(count) {
    return enginePool.warmup(resolveWarmupCount(count));
  },

  /**
   * Drops every node the pool knows about (ACTIVE and IDLE), detaching
   * any that are still mounted. Used when the currently-pooled nodes'
   * shape can no longer be trusted — right now that's exactly the theme-
   * switch case (a new template means old clones don't match anymore).
   */
  clear() {
    enginePool.clear();
  },

  /**
   * Dynamic Pool growth — "Active Bubble > Available -> Pool tạo thêm
   * Bubble". Pre-builds extra IDLE nodes beyond what's currently sitting
   * idle, up to the maxSize ceiling. acquire() already falls back to this
   * automatically the instant IDLE actually runs out (see BubblePool's
   * acquire()), so callers don't normally need this directly — it's
   * exposed for a caller that wants to warm the pool ahead of a known
   * spike (e.g. right before replaying a large chat history backlog).
   *
   * Gated by an internal cooldown (see PoolConfig.js#DEFAULT_EXPAND_COOLDOWN_MS)
   * so repeated calls in quick succession only actually build something
   * once per cooldown window — this half of the hysteresis pair is what
   * stops the pool from growing on every single message during a burst.
   */
  expand(count) {
    return enginePool.expand(count);
  },

  /**
   * Dynamic Pool reclamation — "Pool dư Bubble quá lâu -> Pool thu hồi
   * dần". Reclaims a few (see PoolConfig.js#DEFAULT_SHRINK_STEP) IDLE
   * nodes that have been sitting unused for a while, never touching
   * anything ACTIVE. The floor it won't shrink past is resolved the same
   * lazy way warmup()'s count is (state.currentConfig.poolWarmupSize at
   * CALL TIME) so a live Pool Size edit changes future shrink() calls
   * too, not just the next warmup().
   *
   * Also gated by an internal cooldown that refuses to run shortly after
   * the pool's last real expand() — the other half of the hysteresis
   * pair, so a brief lull between two bursts of the same stream doesn't
   * immediately undo the buffer that burst just needed.
   */
  shrink(count) {
    return enginePool.shrink(count, { minSize: resolveWarmupCount() });
  },

  /**
   * Starts background reclamation: calls shrink() once every
   * `intervalMs` (default DEFAULT_SHRINK_CHECK_INTERVAL_MS). Idempotent —
   * calling this again while already running is a no-op; call
   * stopDynamicManagement() first to change the interval.
   *
   * This owns the ONLY timer anywhere in the Pool stack. unref()'d where
   * available (Node — smoke tests, SSR) so it can never by itself keep a
   * process alive; a no-op in a browser/Electron overlay, which is where
   * this actually runs long-term.
   */
  startDynamicManagement(intervalMs = DEFAULT_SHRINK_CHECK_INTERVAL_MS) {
    if (reclaimTimer) return; // already running
    reclaimTimer = setInterval(() => {
      enginePool.shrink(undefined, { minSize: resolveWarmupCount() });
    }, intervalMs);
    if (typeof reclaimTimer.unref === 'function') reclaimTimer.unref();
  },

  /** Stops the background reclamation timer started by startDynamicManagement(), if running. */
  stopDynamicManagement() {
    if (!reclaimTimer) return;
    clearInterval(reclaimTimer);
    reclaimTimer = null;
  },

  /** Total nodes currently tracked (ACTIVE + IDLE). */
  size() {
    return enginePool.size();
  },

  /** IDLE nodes ready to be handed out without building a new one. */
  available() {
    return enginePool.available();
  },

  /** Diagnostics only — not part of the required Pool contract. */
  stats() {
    return enginePool.stats();
  },
};

export default bubblePoolManager;
