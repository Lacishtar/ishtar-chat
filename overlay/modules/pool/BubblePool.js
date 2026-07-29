// BubblePool — generic Object Pool engine.
//
// INDEPENDENT OF THE RENDERER: this file never imports state.js,
// message-renderer.js, render-queue.js, decoration.js, or anything else
// that knows about chat messages/themes/DOM slots. It only knows how to
// hand out and take back opaque `value`s, using two functions the CALLER
// provides:
//   - factory(): () => value            — how to create a brand-new value
//   - reset(value): (value) => void     — how to scrub a value back to a
//                                          neutral state before it's reused
//
// This is what lets PoolManager.js wire this engine up specifically for
// chat bubbles (DOM nodes cloned from the active theme template) while
// BubblePool itself stays reusable for any other kind of pooled object.
//
// Two states only (see PoolConfig.js): ACTIVE (handed out via acquire(),
// currently in use) and IDLE (sitting in the pool, available for reuse).
// There is no third "destroyed" state — an item that's evicted because
// the pool is already at capacity is simply dropped (not tracked at all),
// which for a DOM node means it becomes eligible for normal GC once
// nothing else references it.

import { PoolItem } from './PoolItem.js';
import {
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_WARMUP_SIZE,
  DEFAULT_MIN_POOL_SIZE,
  DEFAULT_EXPAND_STEP,
  DEFAULT_EXPAND_COOLDOWN_MS,
  DEFAULT_SHRINK_STEP,
  DEFAULT_SHRINK_IDLE_AFTER_MS,
  DEFAULT_SHRINK_COOLDOWN_AFTER_EXPAND_MS,
} from './PoolConfig.js';

export class BubblePool {
  /**
   * @param {Object} options
   * @param {() => any} options.factory - creates a brand-new value.
   * @param {(value: any) => void} [options.reset] - scrubs a value back to
   *   a reusable neutral state. Called by release() before the item is
   *   parked as IDLE. Optional — a pool with no reset just recycles the
   *   value as-is (useful for pooling plain data objects).
   * @param {(value: any) => void} [options.destroy] - called on a value
   *   that is being permanently dropped (evicted at capacity, or cleared).
   *   Optional hook for callers that need to do final cleanup (e.g. a
   *   DOM node that should still be detached even when it's not going
   *   back into the pool).
   * @param {number} [options.maxSize] - ACTIVE+IDLE ceiling this pool
   *   tries to respect. acquire() may transiently exceed it (a burst can
   *   always ask for more objects than the pool wants to keep long-term —
   *   see acquire()'s note) but release() never lets IDLE storage exceed it.
   * @param {number} [options.warmupSize] - default count for warmup()
   *   when called with no explicit argument.
   * @param {number} [options.minSize] - floor shrink() will not reduce
   *   IDLE storage below, regardless of how long the surplus has sat
   *   there. Overridable per-call (see shrink()).
   * @param {number} [options.expandStep] - default count for expand()
   *   when called with no explicit argument, and the size of the
   *   automatic top-up acquire() triggers when ACTIVE outgrows IDLE.
   * @param {number} [options.expandCooldownMs] - minimum time between two
   *   expand() calls that actually build something (see expand()).
   * @param {number} [options.shrinkStep] - default count for shrink()
   *   when called with no explicit argument — how many IDLE items a
   *   single call reclaims at most ("thu hồi dần").
   * @param {number} [options.shrinkIdleAfterMs] - how long an item must
   *   have sat continuously IDLE before shrink() treats it as reclaimable
   *   surplus rather than something about to be reused.
   * @param {number} [options.shrinkCooldownAfterExpandMs] - shrink()
   *   refuses to run within this long after the pool's last successful
   *   expand() (unless forced) — the other half of the hysteresis pair.
   */
  constructor({
    factory,
    reset = null,
    destroy = null,
    maxSize = DEFAULT_MAX_POOL_SIZE,
    warmupSize = DEFAULT_WARMUP_SIZE,
    minSize = DEFAULT_MIN_POOL_SIZE,
    expandStep = DEFAULT_EXPAND_STEP,
    expandCooldownMs = DEFAULT_EXPAND_COOLDOWN_MS,
    shrinkStep = DEFAULT_SHRINK_STEP,
    shrinkIdleAfterMs = DEFAULT_SHRINK_IDLE_AFTER_MS,
    shrinkCooldownAfterExpandMs = DEFAULT_SHRINK_COOLDOWN_AFTER_EXPAND_MS,
  } = {}) {
    if (typeof factory !== 'function') {
      throw new Error('BubblePool requires a factory() function');
    }
    this.factory = factory;
    this.resetFn = reset;
    this.destroyFn = destroy;
    this.maxSize = maxSize;
    this.warmupSize = warmupSize;
    this.minSize = minSize;
    this.expandStep = expandStep;
    this.expandCooldownMs = expandCooldownMs;
    this.shrinkStep = shrinkStep;
    this.shrinkIdleAfterMs = shrinkIdleAfterMs;
    this.shrinkCooldownAfterExpandMs = shrinkCooldownAfterExpandMs;

    // IDLE items, ready to hand out. Stack order (push/pop) so the most
    // recently released item is reused first — keeps whichever items are
    // actually being cycled warm, rather than round-robining through
    // every item the pool has ever held.
    this._idle = [];

    // ACTIVE items, keyed by their underlying value so release(value) can
    // find the PoolItem wrapper without the caller having to hold onto it
    // separately.
    this._active = new Map(); // value -> PoolItem

    // Dynamic Pool bookkeeping (see expand()/shrink()). 0 means "never
    // happened yet" — that's intentionally a value shrink()'s cooldown
    // check treats as "long enough ago", so a brand-new pool isn't
    // artificially blocked from shrinking before its first expand().
    this._lastExpandAt = 0;
    this._lastShrinkAt = 0;
  }

  // ===== acquire() =====================================================
  // Returns a ready-to-use `value` — either recycled from the IDLE list
  // (already reset by a prior release()) or freshly built via factory().
  // Marks it ACTIVE. `key` is optional caller bookkeeping (e.g. a message
  // id) stored on the PoolItem for diagnostics; the pool itself doesn't
  // need it.
  acquire(key = null) {
    let item = this._idle.pop();
    if (!item) {
      // Pool is empty — "Active Bubble > Available -> Pool tạo thêm
      // Bubble". Try growing via expand() FIRST (forced: this is a real
      // shortage, not a background top-up, so it must not be silently
      // skipped by expand()'s normal cooldown) so this growth is recorded
      // as a real expand() event — the same event shrink()'s hysteresis
      // checks against, which is what stops the pool from immediately
      // reclaiming a bubble it just had to build under pressure.
      //
      // expand(1, force) can still legitimately build 0 if the pool is
      // already at maxSize (no room) — in that case fall back to a bare,
      // untracked-by-maxSize factory() build, same as before this method
      // existed: capping *creation* would mean a message silently fails
      // to render just because the pool is momentarily exhausted, which
      // is worse than a temporary over-allocation. maxSize is enforced on
      // the way BACK IN (release()), which is what actually bounds
      // long-term memory use.
      this.expand(this.expandStep, { force: true });
      item = this._idle.pop() || new PoolItem(this.factory());
    }
    item.markActive(key);
    this._active.set(item.value, item);
    return item.value;
  }

  // ===== release() ======================================================
  // Returns a value to the pool. Runs reset(value) first (if configured)
  // so the value is neutral before anything else can acquire() it again.
  // If the pool is already at capacity, the item is dropped instead of
  // being kept IDLE (destroy(value) runs if configured) — this is what
  // keeps a long-running stream from growing the pool without bound.
  //
  // Safe to call with a value this pool doesn't recognize as ACTIVE (it's
  // a no-op) — callers don't need to track ACTIVE membership themselves.
  release(value) {
    if (value == null) return false;
    const item = this._active.get(value);
    if (!item) return false; // not ours / already released — no-op, not an error

    this._active.delete(value);

    if (typeof this.resetFn === 'function') {
      this.resetFn(value);
    }

    if (this._idle.length >= this.maxSize) {
      // At capacity — drop it for real instead of growing IDLE storage.
      if (typeof this.destroyFn === 'function') this.destroyFn(value);
      item.markIdle(); // still transitions the wrapper for consistency, then it's discarded
      return true;
    }

    item.markIdle();
    this._idle.push(item);
    return true;
  }

  // ===== warmup() ========================================================
  // Pre-builds `count` IDLE items (default DEFAULT_WARMUP_SIZE) so the
  // first burst of acquire() calls doesn't pay factory() cost inline.
  // Never exceeds maxSize. Idempotent — calling it again just tops the
  // IDLE list back up to `count` if it's currently short.
  warmup(count = this.warmupSize) {
    const target = Math.min(count, this.maxSize);
    let built = 0;
    while (this._idle.length < target) {
      const item = new PoolItem(this.factory());
      this._idle.push(item);
      built += 1;
    }
    return built;
  }

  // ===== expand() =========================================================
  // Dynamic Pool growth — pre-builds `count` (default expandStep) extra
  // IDLE items, on top of whatever's already IDLE, so the pool has a
  // buffer ready before the NEXT burst of acquire() calls needs it. This
  // is exactly what acquire() falls back to the moment IDLE actually runs
  // out (see acquire()'s exhausted-pool branch — "Active Bubble >
  // Available -> Pool tạo thêm Bubble"), building more than the single
  // item that acquire() itself needs so the following few acquire() calls
  // in the same burst can be satisfied from IDLE too. It's also exposed
  // directly for a caller that wants to grow the pool proactively (e.g.
  // before a known spike, like re-connecting after a stream had a large
  // backlog).
  //
  // Bounded by maxSize the same way warmup() is — never builds past the
  // ceiling even if `count` asks for more.
  //
  // Hysteresis: gated by expandCooldownMs so a burst that triggers this
  // from acquire() on every single call doesn't actually rebuild every
  // single call — only the first one in each cooldown window does
  // anything, the rest are quick no-ops. Pass `{ force: true }` to bypass
  // the cooldown (e.g. an explicit, deliberate warm-before-spike call).
  expand(count = this.expandStep, { force = false } = {}) {
    if (!Number.isFinite(count) || count <= 0) return 0;

    const now = Date.now();
    if (!force && now - this._lastExpandAt < this.expandCooldownMs) {
      return 0; // still cooling down from the last real expand() — no-op
    }

    const room = this.maxSize - this.size();
    const actual = Math.max(0, Math.min(count, room));
    if (actual === 0) return 0;

    for (let i = 0; i < actual; i++) {
      this._idle.push(new PoolItem(this.factory()));
    }
    this._lastExpandAt = now;
    return actual;
  }

  // ===== shrink() =========================================================
  // Dynamic Pool reclamation — "Pool dư Bubble quá lâu -> Pool thu hồi
  // dần". Only ever touches IDLE items (an ACTIVE item is never a shrink
  // candidate, full stop — it isn't even in this._idle to begin with).
  // Of the IDLE items, only ones that have sat continuously IDLE for at
  // least `idleAfterMs` (default shrinkIdleAfterMs) are eligible — a node
  // released a moment ago might be about to be reused, so genuine
  // long-idle surplus is what gets reclaimed, not everything IDLE.
  //
  // Reclaims at most `count` (default shrinkStep) items per call, oldest-
  // idle-first — gradual reclamation across repeated calls (e.g. from a
  // caller polling this on an interval), never the whole surplus at once.
  // Never reduces total IDLE storage below `minSize` (default this.minSize,
  // overridable per call so a caller like PoolManager.js can resolve a
  // live, user-configurable floor at call time instead of a value frozen
  // at construction).
  //
  // Hysteresis: refuses to run at all within shrinkCooldownAfterExpandMs
  // of the pool's last successful expand() (unless forced) — this is
  // what stops the pool from immediately undoing a growth spurt during a
  // brief lull between two bursts of the same stream. Combined with
  // expand()'s own cooldown, this pair is what keeps the pool from
  // growing and shrinking back to back on bursty traffic.
  shrink(count = this.shrinkStep, { minSize = this.minSize, idleAfterMs = this.shrinkIdleAfterMs, force = false } = {}) {
    if (!Number.isFinite(count) || count <= 0) return 0;

    const now = Date.now();
    if (!force && now - this._lastExpandAt < this.shrinkCooldownAfterExpandMs) {
      return 0; // too soon after a growth spurt — let the buffer get used first
    }

    const floor = Math.max(0, minSize);
    const budget = this._idle.length - floor;
    if (budget <= 0) return 0; // already at (or under) the floor — nothing to give back

    const eligibleIdx = [];
    for (let i = 0; i < this._idle.length; i++) {
      if (now - this._idle[i].lastTransitionAt >= idleAfterMs) eligibleIdx.push(i);
    }
    if (eligibleIdx.length === 0) return 0; // everything IDLE is still "fresh" — nothing stale to reclaim yet

    // Oldest-idle-first, capped by both `count` (this call's step) and
    // `budget` (the floor) — whichever is smaller wins.
    eligibleIdx.sort((a, b) => this._idle[a].lastTransitionAt - this._idle[b].lastTransitionAt);
    const take = Math.min(count, budget, eligibleIdx.length);
    // Remove highest indices first so removing one doesn't shift the
    // still-pending indices out from under the loop.
    const toRemove = eligibleIdx.slice(0, take).sort((a, b) => b - a);

    for (const idx of toRemove) {
      const [item] = this._idle.splice(idx, 1);
      if (typeof this.destroyFn === 'function') this.destroyFn(item.value);
    }

    this._lastShrinkAt = now;
    return toRemove.length;
  }

  // ===== clear() =========================================================
  // Drops every item the pool knows about — both IDLE and any still
  // ACTIVE (a caller clearing the pool, e.g. on a theme switch that
  // invalidates the template every pooled node was cloned from, is
  // expected to have already stopped using its ACTIVE handles). Runs
  // destroy(value) on everything if configured. Resets the pool to a
  // freshly-constructed, empty state.
  clear() {
    if (typeof this.destroyFn === 'function') {
      for (const item of this._idle) this.destroyFn(item.value);
      for (const item of this._active.values()) this.destroyFn(item.value);
    }
    this._idle = [];
    this._active = new Map();
    this._lastExpandAt = 0;
    this._lastShrinkAt = 0;
  }

  // ===== size() ===========================================================
  // Total items this pool currently tracks (ACTIVE + IDLE).
  size() {
    return this._idle.length + this._active.size;
  }

  // ===== available() ======================================================
  // IDLE items ready to be handed out by acquire() without a factory() call.
  available() {
    return this._idle.length;
  }

  // Diagnostics helper — not part of the required API, but cheap and
  // useful for debugging pool pressure without exposing internals.
  stats() {
    return {
      active: this._active.size,
      idle: this._idle.length,
      total: this.size(),
      maxSize: this.maxSize,
      minSize: this.minSize,
      lastExpandAt: this._lastExpandAt,
      lastShrinkAt: this._lastShrinkAt,
    };
  }
}

export default BubblePool;
