// PoolConfig — pure constants for the generic Object Pool engine.
//
// This file has ZERO imports on purpose: BubblePool/PoolItem must stay
// independent of the renderer (message-renderer.js, render-queue.js,
// state.js, ...). Anything renderer-specific (how to build/reset a
// bubble node) is injected from the outside (see PoolManager.js), never
// hardcoded in here.

// The only two states a pooled item may be in. A PoolItem never has a
// third state — "being destroyed" doesn't exist as a state because
// items released to a full pool are destroyed synchronously, not queued.
export const POOL_STATE = Object.freeze({
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
});

// Default ceiling on how many DOM nodes a single BubblePool keeps alive
// (ACTIVE + IDLE combined is allowed to exceed this only transiently —
// see BubblePool.acquire()'s overflow note). Sized against maxMessages'
// own typical range (shared/bubble-config.js) with headroom for a burst.
export const DEFAULT_MAX_POOL_SIZE = 60;

// How many idle items warmup() pre-builds by default when a caller asks
// for warmup() with no explicit count.
export const DEFAULT_WARMUP_SIZE = 8;

// ===== Dynamic Pool (expand()/shrink()) ====================================
// See BubblePool.js#expand()/#shrink() for the full behavior. Constants
// below are the knobs that make growth/shrink respond to real pressure
// instead of oscillating on every single acquire()/release():
//   - a floor shrink() will never eat into (minSize)
//   - how much each expand()/shrink() call moves the needle at once (…Step)
//   - cooldowns that space consecutive expand() calls apart, and that
//     hold off any shrink() for a while right after a growth spurt — this
//     pair is the "hysteresis" that stops grow/shrink from chasing a
//     bursty stream back and forth every frame.
//   - how long an item must have sat IDLE, untouched, before shrink()
//     considers it genuine surplus rather than something about to be
//     reused a moment later.

// shrink() never reduces IDLE storage below this floor, regardless of how
// long the surplus has been sitting there. PoolManager.js overrides this
// per-call with the live, user-configurable Pool Size
// (state.currentConfig.poolWarmupSize) — this constant is only the
// fallback for a bare BubblePool used outside that wiring.
export const DEFAULT_MIN_POOL_SIZE = 4;

// How many IDLE items a single expand() call builds by default.
export const DEFAULT_EXPAND_STEP = 4;

// Minimum time between two expand() calls that actually build something.
// A pressure check that fires on every acquire() during a burst would
// otherwise call expand() dozens of times a second; this cooldown makes
// each growth spurt count for something before the pool considers
// growing again.
export const DEFAULT_EXPAND_COOLDOWN_MS = 4000;

// How many IDLE items a single shrink() call reclaims at most — "thu hồi
// dần" (gradual reclamation), never the whole surplus in one pass.
export const DEFAULT_SHRINK_STEP = 2;

// An IDLE item must have been continuously IDLE for at least this long
// before shrink() is allowed to reclaim it. Keeps a bubble that was just
// released (and may be about to be reused for the next message) safe
// from being torn down moments later.
export const DEFAULT_SHRINK_IDLE_AFTER_MS = 30000;

// shrink() refuses to run at all within this long after the pool's last
// successful expand() (unless explicitly forced). This is the other half
// of the hysteresis pair: it stops the pool from immediately reclaiming
// the very buffer it just grew because of a momentary lull between two
// bursts of the same stream.
export const DEFAULT_SHRINK_COOLDOWN_AFTER_EXPAND_MS = 8000;

// Default interval PoolManager.js's background reclamation timer polls
// shrink() at. Coarse on purpose — this is background housekeeping, not
// something that needs frame-accurate timing.
export const DEFAULT_SHRINK_CHECK_INTERVAL_MS = 10000;

export default {
  POOL_STATE,
  DEFAULT_MAX_POOL_SIZE,
  DEFAULT_WARMUP_SIZE,
  DEFAULT_MIN_POOL_SIZE,
  DEFAULT_EXPAND_STEP,
  DEFAULT_EXPAND_COOLDOWN_MS,
  DEFAULT_SHRINK_STEP,
  DEFAULT_SHRINK_IDLE_AFTER_MS,
  DEFAULT_SHRINK_COOLDOWN_AFTER_EXPAND_MS,
  DEFAULT_SHRINK_CHECK_INTERVAL_MS,
};
