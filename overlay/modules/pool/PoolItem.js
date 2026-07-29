// PoolItem — a thin wrapper around one pooled value (a DOM node, in this
// app, but nothing here assumes that) plus its ACTIVE/IDLE state.
//
// No imports. PoolItem knows nothing about bubbles, chat messages, or the
// DOM specifically — BubblePool is the only thing that creates/reads
// these, and it's just as generic.

import { POOL_STATE } from './PoolConfig.js';

let nextInternalId = 1;

export class PoolItem {
  constructor(value) {
    // Internal bookkeeping id — NOT the chat message id. Kept distinct
    // from whatever "key" the pool's owner (e.g. render-queue.js) later
    // associates with this item, so PoolItem stays reusable outside the
    // chat-bubble use case too.
    this.internalId = nextInternalId += 1;
    this.value = value;
    this.state = POOL_STATE.IDLE;
    this.key = null; // owner-assigned key while ACTIVE (e.g. message id)
    this.createdAt = Date.now();
    this.lastTransitionAt = this.createdAt;
  }

  isActive() {
    return this.state === POOL_STATE.ACTIVE;
  }

  isIdle() {
    return this.state === POOL_STATE.IDLE;
  }

  markActive(key = null) {
    this.state = POOL_STATE.ACTIVE;
    this.key = key;
    this.lastTransitionAt = Date.now();
  }

  markIdle() {
    this.state = POOL_STATE.IDLE;
    this.key = null;
    this.lastTransitionAt = Date.now();
  }
}

export default PoolItem;
