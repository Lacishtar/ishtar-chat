
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
  // a reusable neutral state. Called by release() before the item is
  // see acquire()'s note) but release() never lets IDLE storage exceed it.
  // single call reclaims at most ("thu hồi dần").
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

    this._idle = [];

    this._active = new Map(); // value -> PoolItem

    this._lastExpandAt = 0;
    this._lastShrinkAt = 0;
  }

  // ===== acquire() =====================================================
  acquire(key = null) {
    let item = this._idle.pop();
    if (!item) {
      // Pool is empty — "Active Bubble > Available -> Pool tạo thêm
      this.expand(this.expandStep, { force: true });
      item = this._idle.pop() || new PoolItem(this.factory());
    }
    item.markActive(key);
    this._active.set(item.value, item);
    return item.value;
  }

  // ===== release() ======================================================
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
  // Available -> Pool tạo thêm Bubble"), building more than the single
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
