
import { renderMessage } from './message-renderer.js';

const DRAIN_INTERVAL_MS = 120;
const MAX_PER_TICK = 4;
const BACKLOG_SKIP_ANIM_THRESHOLD = 10;
const MAX_QUEUE_SIZE = 50;

const queue = [];
let timerId = null;

function drain() {
  const dueCount = Math.min(MAX_PER_TICK, queue.length);
  for (let i = 0; i < dueCount; i += 1) {
    const msg = queue.shift();
    const skipEnterAnimation = queue.length >= BACKLOG_SKIP_ANIM_THRESHOLD;
    renderMessage(msg, { skipEnterAnimation });
  }
  if (queue.length === 0 && timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

export function enqueueMessage(msg) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // backlog full — drop the oldest to keep the 50 newest
  }
  queue.push(msg);
  if (timerId) return; // already draining on the interval, it'll pick this up

  drain();
  if (queue.length > 0 && !timerId) {
    timerId = setInterval(drain, DRAIN_INTERVAL_MS);
  }
}

export function pendingMessageCount() {
  return queue.length;
}

// Removes a not-yet-rendered message from the backlog (e.g. it was
// deleted/moderated a moment after arriving, before its turn to drain).
export function removeQueuedMessage(id) {
  if (id === undefined || id === null) return;
  const key = String(id);
  const idx = queue.findIndex((m) => String(m.id) === key);
  if (idx !== -1) queue.splice(idx, 1);
}

export function flushQueue() {
  queue.length = 0;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}
