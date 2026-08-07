// (danmaku/ticker are unaffected — see note there). No other module may

import { state, listEl } from './state.js';
import { createMessageNode, trimToMax } from './message-renderer.js';
import { applyDecorationLayers } from './decoration.js';
import { createVirtualBubble, diffVirtualBubble, isAnyDirty, commitVirtualBubble } from './virtual-bubble.js';
import { applyDirtyBubbleUpdate } from './bubble-updater.js';
import { bubblePoolManager } from './pool/PoolManager.js';


const pending = [];
let scheduled = false;

const nodeMap = new Map();

const vbubbles = new Map();

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(flush);
}

// ===== Public queue API — pure bookkeeping, no DOM access here. =====

// Queues a brand-new message. Called by renderMessage() for every
// stack-mode message.
export function enqueueStackMessage(msg, options = {}) {
  pending.push({ kind: 'create', id: msg.id, msg, options });
  schedule();
}

export function enqueueStackUpdate(id, updateFn) {
  if (!id || typeof updateFn !== 'function') return;
  pending.push({ kind: 'update', id, updateFn });
  schedule();
}

export function enqueueBubbleUpdate(id, msg) {
  if (!id || !msg) return;
  pending.push({ kind: 'bubbleUpdate', id, msg });
  schedule();
}

export function enqueueStackRemove(id) {
  if (!id) return;
  pending.push({ kind: 'remove', id });
  schedule();
}

export function clearStackQueue() {
  pending.length = 0;
  // Leave `scheduled` as-is: an already-scheduled rAF callback will just
  // see an empty `pending` and no-op (see the early return in flush()).
}

export function clearStackList() {
  clearStackQueue();
  if (listEl) {
    Array.from(listEl.children).forEach((child) => bubblePoolManager.release(child));
  }
  nodeMap.clear();
  vbubbles.clear();
}

export function hardResetStackPool() {
  clearStackList();
  bubblePoolManager.clear();
}

// ===== Renderer — everything below only ever runs inside flush(). =====

function resolvePatches(patches) {
  const toCreate = new Map(); // id -> { msg, options }
  const toUpdate = new Map(); // id -> updateFn[]
  const toBubbleUpdate = new Map(); // id -> msg (latest wins; diffed against the Virtual Bubble at apply time)
  const toRemove = new Set(); // id

  for (const p of patches) {
    if (p.kind === 'create') {
      toCreate.set(p.id, { msg: p.msg, options: p.options });
      toUpdate.delete(p.id); // a fresh create supersedes any update queued earlier this frame
      toBubbleUpdate.delete(p.id); // ...same for a bubbleUpdate: the create's own snapshot is already current
      toRemove.delete(p.id); // ...and un-cancels a remove-then-recreate in the same frame
    } else if (p.kind === 'update') {
      if (toCreate.has(p.id) || toRemove.has(p.id)) {
      }
      if (!toUpdate.has(p.id)) toUpdate.set(p.id, []);
      toUpdate.get(p.id).push(p.updateFn);
    } else if (p.kind === 'bubbleUpdate') {
      if (toCreate.has(p.id) || toRemove.has(p.id)) {
        continue;
      }
      toBubbleUpdate.set(p.id, p.msg); // latest msg for this id this frame wins
    } else if (p.kind === 'remove') {
      if (toCreate.has(p.id)) {
        // Created AND removed within the same frame — never needs to
        // touch the DOM at all.
        toCreate.delete(p.id);
        toUpdate.delete(p.id);
        toBubbleUpdate.delete(p.id);
        continue;
      }
      toRemove.add(p.id);
      toUpdate.delete(p.id);
      toBubbleUpdate.delete(p.id);
    }
  }

  return { toCreate, toUpdate, toBubbleUpdate, toRemove };
}

function flush() {
  scheduled = false;
  if (pending.length === 0) return;
  const patches = pending.splice(0, pending.length);
  const { toCreate, toUpdate, toBubbleUpdate, toRemove } = resolvePatches(patches);
  if (toCreate.size === 0 && toUpdate.size === 0 && toBubbleUpdate.size === 0 && toRemove.size === 0) return;

  // ===== CREATE DOM ===== build + insert every new node due this frame.
  const createdRows = [];
  for (const [id, { msg, options }] of toCreate) {
    // Defensive dedupe: a 'create' patch for an id we already track means
    // a message got (re-)created for the same id a second time — e.g. a
    // WS reconnect replaying live traffic, or a history replay overlapping
    // a still-in-flight live message. nodeMap can only hold ONE entry per
    // id, so without this guard nodeMap.set() below would silently stop
    // tracking the PREVIOUS node while leaving it fully attached in
    // listEl — an orphaned duplicate that no later chat:deleted can ever
    // find again (this was the root cause of deleted messages staying
    // stuck in the overlay forever). Releasing it first keeps nodeMap and
    // the DOM in sync no matter how many times create fires for one id.
    const staleNode = nodeMap.get(id);
    if (staleNode) {
      bubblePoolManager.release(staleNode);
      vbubbles.delete(id);
    }
    const pooledNode = bubblePoolManager.acquire(id);
    const node = createMessageNode(msg, { skipEnterAnimation: options.skipEnterAnimation, node: pooledNode });
    nodeMap.set(id, node);
    // Reverse lookup for the structural sync pass below (listEl.children ->
    // bubble id) so that pass never needs its own separate Map scan.
    node.dataset.ovsBubbleId = String(id);
    vbubbles.set(id, createVirtualBubble(msg, 0, state.currentDecoration));
    if (state.currentConfig.position === 'top-down') {
      listEl.prepend(node);
    } else {
      listEl.appendChild(node);
    }
    createdRows.push(node.querySelector('.ovs-message') || node);
  }
  for (const rowEl of createdRows) {
    applyDecorationLayers(rowEl, state.currentDecoration);
  }

  // ===== UPDATE DOM ===== apply every queued update to its live node.
  for (const [id, updateFns] of toUpdate) {
    const node = nodeMap.get(id);
    if (!node) continue; // already removed/trimmed before this frame's Update phase ran
    for (const updateFn of updateFns) updateFn(node);
  }

  // ===== BUBBLE UPDATE (Virtual Bubble dirty-flag patch) =====
  for (const [id, msg] of toBubbleUpdate) {
    const node = nodeMap.get(id);
    const vbubble = vbubbles.get(id);
    if (!node || !vbubble) continue; // already removed/trimmed before this frame's Update phase ran
    const currentIndex = Number(node.style.getPropertyValue('--ovs-idle-index')) || 0;
    const { dirty, next } = diffVirtualBubble(vbubble, msg, currentIndex, state.currentDecoration);
    if (!isAnyDirty(dirty)) continue; // nothing changed -> zero DOM writes for this id
    applyDirtyBubbleUpdate(node, dirty, msg, currentIndex);
    commitVirtualBubble(vbubble, next);
  }

  // ===== REMOVE DOM + ANIMATION (position) =====
  const structuralChange = toCreate.size > 0 || toRemove.size > 0;
  if (structuralChange) {
    for (const id of toRemove) {
      const node = nodeMap.get(id);
      if (node) bubblePoolManager.release(node);
      nodeMap.delete(id);
      vbubbles.delete(id);
    }
    trimToMax((evictedNode) => bubblePoolManager.release(evictedNode));
    for (const [id, node] of nodeMap) {
      if (!node.isConnected) {
        nodeMap.delete(id);
        vbubbles.delete(id);
      }
    }

    const children = listEl.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      el.style.setProperty('--ovs-idle-index', String(i));
      const id = el.dataset.ovsBubbleId;
      if (!id) continue;
      const vbubble = vbubbles.get(id);
      if (vbubble) vbubble.snapshot.position = { index: i };
    }
  }
}
