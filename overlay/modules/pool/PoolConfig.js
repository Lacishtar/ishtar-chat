
export const POOL_STATE = Object.freeze({
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
});

// see BubblePool.acquire()'s overflow note). Sized against maxMessages'
export const DEFAULT_MAX_POOL_SIZE = 60;

// How many idle items warmup() pre-builds by default when a caller asks
// for warmup() with no explicit count.
export const DEFAULT_WARMUP_SIZE = 8;

// ===== Dynamic Pool (expand()/shrink()) ====================================

export const DEFAULT_MIN_POOL_SIZE = 4;

// How many IDLE items a single expand() call builds by default.
export const DEFAULT_EXPAND_STEP = 4;

export const DEFAULT_EXPAND_COOLDOWN_MS = 4000;

// How many IDLE items a single shrink() call reclaims at most — "thu hồi
// dần" (gradual reclamation), never the whole surplus in one pass.
export const DEFAULT_SHRINK_STEP = 2;

export const DEFAULT_SHRINK_IDLE_AFTER_MS = 30000;

export const DEFAULT_SHRINK_COOLDOWN_AFTER_EXPAND_MS = 8000;

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
