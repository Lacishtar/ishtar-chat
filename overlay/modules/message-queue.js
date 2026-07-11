// Smooths bursts of incoming chat messages.
//
// Why this exists: every incoming message is rendered by cloning a DOM
// node AND (for non-flythrough themes) computing decoration masks via
// getBoundingClientRect, which forces a synchronous layout. That's cheap
// for one message, but when the scraper's batch delivers a burst (e.g.
// a dozen messages arriving within the same tick during a fast chat),
// rendering all of them synchronously in one JS turn causes exactly the
// "chat can't keep up" jank this module fixes.
//
// The fix is NOT a flat multi-second delay — that would just move the
// same burst to a later, bigger pile-up and add real latency for every
// single message. Instead we queue messages and drain a few at a time on
// a short interval, so a lone message still renders immediately (no
// perceptible delay) while a burst gets spread across several ticks. If
// the queue backs up further than BACKLOG_SKIP_ANIM_THRESHOLD, we stop
// entry animations to fast-forward through the backlog rather than
// falling further behind.

import { renderMessage } from './message-renderer.js';

const DRAIN_INTERVAL_MS = 120;
const MAX_PER_TICK = 4;
const BACKLOG_SKIP_ANIM_THRESHOLD = 10;

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
  queue.push(msg);
  if (timerId) return; // already draining on the interval, it'll pick this up

  // Drain immediately so the common case (one message, no burst) still
  // renders with ~0 added latency. Only start the interval if this pass
  // didn't clear the queue (i.e. we're mid-burst).
  drain();
  if (queue.length > 0 && !timerId) {
    timerId = setInterval(drain, DRAIN_INTERVAL_MS);
  }
}

export function pendingMessageCount() {
  return queue.length;
}
