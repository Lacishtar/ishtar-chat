
import { POOL_STATE } from './PoolConfig.js';

let nextInternalId = 1;

export class PoolItem {
  constructor(value) {
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
