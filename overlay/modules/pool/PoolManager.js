
import { state } from '../state.js';
import { BubblePool } from './BubblePool.js';
import { resetBubbleNode, detachBubbleNode, captureBubbleBaseline } from './bubble-reset.js';
import { DEFAULT_MAX_POOL_SIZE, DEFAULT_WARMUP_SIZE, DEFAULT_SHRINK_CHECK_INTERVAL_MS } from './PoolConfig.js';

function createBareBubbleNode() {
  const tpl = state.messageTemplate;
  if (!tpl || !tpl.content || !tpl.content.firstElementChild) {
    throw new Error('[BubblePool] no message template loaded yet — cannot build a bubble node');
  }
  const node = tpl.content.firstElementChild.cloneNode(true);
  captureBubbleBaseline(node);
  return node;
}

function destroyBubbleNode(node) {
  detachBubbleNode(node);
}

const enginePool = new BubblePool({
  factory: createBareBubbleNode,
  reset: resetBubbleNode,
  destroy: destroyBubbleNode,
  maxSize: DEFAULT_MAX_POOL_SIZE,
  warmupSize: DEFAULT_WARMUP_SIZE,
});

function resolveWarmupCount(count) {
  if (Number.isFinite(count) && count >= 0) return Math.floor(count);
  const configured = Number(state.currentConfig?.poolWarmupSize);
  if (Number.isFinite(configured) && configured >= 0) return Math.floor(configured);
  return DEFAULT_WARMUP_SIZE;
}

let reclaimTimer = null;

export const bubblePoolManager = {
  // Hands back a ready-to-build bubble node: DOM-detached, neutral
  acquire(messageId = null) {
    return enginePool.acquire(messageId);
  },

  // Returns a bubble node to the pool: detaches it from the document (if
  release(node) {
    if (!node) return false;
    detachBubbleNode(node);
    return enginePool.release(node);
  },

  // Pre-builds IDLE nodes so the first burst of acquire() calls (app
  warmup(count) {
    return enginePool.warmup(resolveWarmupCount(count));
  },

  // Drops every node the pool knows about (ACTIVE and IDLE), detaching
  clear() {
    enginePool.clear();
  },

  // Dynamic Pool growth — "Active Bubble > Available -> Pool tạo thêm
  // Dynamic Pool growth — "Active Bubble > Available -> Pool tạo thêm
  expand(count) {
    return enginePool.expand(count);
  },

  // Dynamic Pool reclamation — "Pool dư Bubble quá lâu -> Pool thu hồi
  // Dynamic Pool reclamation — "Pool dư Bubble quá lâu -> Pool thu hồi
  // dần". Reclaims a few (see PoolConfig.js#DEFAULT_SHRINK_STEP) IDLE
  shrink(count) {
    return enginePool.shrink(count, { minSize: resolveWarmupCount() });
  },

  // Starts background reclamation: calls shrink() once every
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
