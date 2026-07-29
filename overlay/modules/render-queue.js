// Render Queue + rAF-batched DOM writer for stack-mode messages.
//
// Why this exists (see architecture doc for the full bottleneck analysis):
// previously renderMessage() in message-renderer.js did, synchronously,
// for every single stack-mode message the moment message-queue.js's
// pacing let it through:
//   createMessageNode -> appendChild -> applyDecorationLayers (read+write
//   getBoundingClientRect) -> trimToMax() -> an O(n) idle-index rewrite
//   over the WHOLE list.
// If N messages land in the same JS turn (e.g. message-queue.js's
// MAX_PER_TICK letting several through together during a burst), that
// whole cycle used to repeat N times, back-to-back — N inserts, N
// decoration read/writes, N idle-index rewrites of the WHOLE list.
//
// This module fixes that: no matter how many messages arrive within the
// same animation frame — 1 or 50 — this queue collects them as Patches
// and the Renderer (flush(), below) runs EXACTLY ONCE per frame,
// producing one Create pass, one Update pass, one Bubble Update (Virtual
// Bubble dirty-flag) pass, and — ONLY when the list's membership/order
// actually changed this frame — one Remove+Animation pass, in that fixed
// order:
//
//   Queue -> Frame (requestAnimationFrame) -> Create DOM -> Update DOM
//   -> Bubble Update (dirty-flag patch) -> [Remove DOM -> Animation]*
//
//   * skipped entirely on a frame with no creates/removes — see
//     flush()'s `structuralChange` guard. A frame where N bubbles are
//     dirty (Virtual Bubble edits only, nothing created/removed) touches
//     exactly those N nodes: no querySelectorAll over the whole chat, no
//     loop over every message, no idle-index re-stamp of the whole list.
//
// This module does NOT change WHEN a message is allowed to appear —
// message-queue.js still owns that pacing (DRAIN_INTERVAL_MS/MAX_PER_TICK
// are a deliberate UX throttle, not a perf fix, and are left untouched).
// What changes is HOW the eventual DOM mutation happens.
//
// message-renderer.js is the only caller of the enqueue* functions below
// (danmaku/ticker are unaffected — see note there). No other module may
// call listEl.appendChild/prepend/removeChild for stack-mode messages —
// this file is the only one that does.

import { state, listEl } from './state.js';
import { createMessageNode, trimToMax } from './message-renderer.js';
import { applyDecorationLayers } from './decoration.js';
import { createVirtualBubble, diffVirtualBubble, isAnyDirty, commitVirtualBubble } from './virtual-bubble.js';
import { applyDirtyBubbleUpdate } from './bubble-updater.js';
import { bubblePoolManager } from './pool/PoolManager.js';

// Object Pool integration (overlay/modules/pool/) — stack mode only.
// Danmaku/ticker (special-modes.js) intentionally stay unpooled: their
// nodes carry per-instance animation timing (lane duration, fly-across
// transform) that isn't safe to hand to a future occupant without extra
// bookkeeping this app doesn't need yet (see the pool strategy analysis).
// Every stack-mode node this module creates comes from
// bubblePoolManager.acquire() and every one it stops using goes back via
// bubblePoolManager.release() — this file never calls node.remove() on a
// stack-mode bubble anymore; the Pool owns detach+reset for that node's
// entire life from here on.

// Patch queue — plain data, no DOM access happens while building this.
// Each entry is one of:
//   { kind: 'create', id, msg, options }
//   { kind: 'update', id, updateFn }   // updateFn(node) — applied to the live node
//   { kind: 'bubbleUpdate', id, msg }  // diffed against the id's Virtual Bubble; only dirty parts touch the DOM
//   { kind: 'remove', id }
const pending = [];
let scheduled = false;

// bubbleId -> live HTMLElement, for update/remove to find their target
// and for trim-overflow cleanup to stay in sync. This is the only place
// in the app that tracks stack-mode nodes by message id.
const nodeMap = new Map();

// bubbleId -> Virtual Bubble ({ id, snapshot, dirty }) — the in-memory
// "what's currently on screen for this message" record used by
// enqueueBubbleUpdate()/flush() to figure out which of position/text/
// style/decoration/animation actually changed, so an update only ever
// touches the DOM parts that are dirty. Kept in lockstep with nodeMap:
// created alongside a node, deleted alongside it. See virtual-bubble.js.
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

// Queues an in-place update to an already-rendered message (e.g. a late
// avatar load, a badge/role change) without rebuilding the node. updateFn
// receives the live `.ovs-slot` root node during the Update phase.
// Not yet called anywhere in the app — added so a future feature (message
// edits, live badge updates, etc.) has a batched path to land in from day
// one instead of reaching for a direct DOM write.
export function enqueueStackUpdate(id, updateFn) {
  if (!id || typeof updateFn !== 'function') return;
  pending.push({ kind: 'update', id, updateFn });
  schedule();
}

// Queues a Virtual Bubble diff-and-patch for an already-rendered message
// (e.g. a late badge/role change, an edited message, a config hot-reload
// affecting one bubble's decoration). Unlike enqueueStackUpdate() above,
// the caller doesn't write the DOM update itself — flush() diffs `msg`
// against the id's stored Virtual Bubble snapshot and only calls into
// bubble-updater.js for the categories (position/text/style/decoration/
// animation) that actually changed. If nothing changed, the patch is a
// pure no-op: it never touches the DOM at all.
// Not yet called anywhere in the app — same forward-looking status
// enqueueStackUpdate/enqueueStackRemove already had before this change.
export function enqueueBubbleUpdate(id, msg) {
  if (!id || !msg) return;
  pending.push({ kind: 'bubbleUpdate', id, msg });
  schedule();
}

// Queues an explicit removal of a still-visible message by id (distinct
// from trimToMax()'s automatic oldest-overflow eviction, which the Remove
// phase below also runs). Not yet called anywhere in the app — same
// status as enqueueStackUpdate above: a ready batched path for a future
// per-message removal feature (e.g. a moderator deleting one message).
export function enqueueStackRemove(id) {
  if (!id) return;
  pending.push({ kind: 'remove', id });
  schedule();
}

// Drops any patches that were queued but not yet flushed to the DOM.
// Called by clearAllMessages()/clearStackList() so a burst of stale
// patches queued right before a new connection/clear doesn't still land
// after the list has already been wiped.
export function clearStackQueue() {
  pending.length = 0;
  // Leave `scheduled` as-is: an already-scheduled rAF callback will just
  // see an empty `pending` and no-op (see the early return in flush()).
}

// Wipes every currently-rendered stack-mode node. Used for the two cases
// that need the list empty right away rather than waiting for the next
// frame (mock-history purge in renderMessage(), and clearAllMessages() on
// a new connection) — both are one-off, infrequent wipes, not part of the
// burst/reflow path this module batches, so they run synchronously. Kept
// here (instead of message-renderer.js touching listEl itself) so this
// file stays the single place that mutates listEl for stack mode.
export function clearStackList() {
  clearStackQueue();
  if (listEl) {
    // Release every currently-mounted node back to the Pool (detach +
    // reset) instead of `listEl.innerHTML = ''`, which would drop every
    // node on the floor for GC instead of letting the Pool reuse them.
    // Array.from() snapshots the live children first since release()
    // mutates listEl (via detach) as it goes.
    Array.from(listEl.children).forEach((child) => bubblePoolManager.release(child));
  }
  nodeMap.clear();
  vbubbles.clear();
}

// Hard-resets the stack-mode Pool itself (drops every ACTIVE+IDLE node it
// holds, not just the ones currently visible) in addition to everything
// clearStackList() already does. Needed specifically when the underlying
// theme template changes (see theme-loader.js#loadTheme): nodes already
// cloned from the OLD template are structurally stale and must never be
// handed back out by a future acquire() under the new one.
export function hardResetStackPool() {
  clearStackList();
  bubblePoolManager.clear();
}

// ===== Renderer — everything below only ever runs inside flush(). =====

// Collapses the frame's raw patch list into three id-keyed intents so
// that N patches for the same message never do more than one create,
// one batch of update-fns, or one remove — and so create+remove for the
// same id within one frame cancels out to zero DOM work (the message
// never needed to be visible in the first place).
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
        // Being created this same frame: apply the update right after
        // creation instead of a separate DOM touch. Being removed this
        // same frame: no point updating something about to disappear.
        // Either way it still belongs in the Update phase's fn list so
        // ordering relative to other updates for this id is preserved.
      }
      if (!toUpdate.has(p.id)) toUpdate.set(p.id, []);
      toUpdate.get(p.id).push(p.updateFn);
    } else if (p.kind === 'bubbleUpdate') {
      if (toCreate.has(p.id) || toRemove.has(p.id)) {
        // Same reasoning as 'update' above: a create this frame already
        // renders the latest msg in full, and a remove this frame means
        // there's nothing left to diff/patch.
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

// The only function in this module (and, by the header comment above,
// the only one in the whole stack-mode pipeline) that mutates listEl.
// Runs at most once per animation frame, no matter how many patches were
// queued — this is the "50 messages in one frame -> one render, not 50"
// guarantee.
function flush() {
  scheduled = false;
  if (pending.length === 0) return;
  const patches = pending.splice(0, pending.length);
  const { toCreate, toUpdate, toBubbleUpdate, toRemove } = resolvePatches(patches);
  if (toCreate.size === 0 && toUpdate.size === 0 && toBubbleUpdate.size === 0 && toRemove.size === 0) return;

  // ===== CREATE DOM ===== build + insert every new node due this frame.
  // createMessageNode() never reads layout, and appendChild/prepend don't
  // either, so this loop is pure writes with no interleaved reads.
  const createdRows = [];
  for (const [id, { msg, options }] of toCreate) {
    const pooledNode = bubblePoolManager.acquire(id);
    const node = createMessageNode(msg, { skipEnterAnimation: options.skipEnterAnimation, node: pooledNode });
    nodeMap.set(id, node);
    // Reverse lookup for the structural sync pass below (listEl.children ->
    // bubble id) so that pass never needs its own separate Map scan.
    node.dataset.ovsBubbleId = String(id);
    // A brand-new node was just rendered in full, so its Virtual Bubble
    // starts fully clean (dirty: all false) — the `position` field gets
    // corrected below by the structural sync pass (this create implies
    // structuralChange=true this frame), so it never falsely reads as
    // dirty on the very next diff.
    vbubbles.set(id, createVirtualBubble(msg, 0, state.currentDecoration));
    if (state.currentConfig.position === 'top-down') {
      listEl.prepend(node);
    } else {
      listEl.appendChild(node);
    }
    createdRows.push(node.querySelector('.ovs-message') || node);
  }
  // Decoration masks still read+write internally per layer (see
  // decoration.js), but now run after every node in this frame's batch is
  // already attached, instead of being interleaved between each
  // individual message's own insert.
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
  // Diff each queued msg against its stored Virtual Bubble snapshot and
  // apply ONLY the categories (position/text/style/decoration/animation)
  // that actually changed. A bubble with nothing dirty never touches the
  // DOM at all — not even a class check.
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
  // Both only ever need to run on a frame where the list's MEMBERSHIP or
  // ORDER could actually have changed — i.e. something was created or
  // explicitly removed this frame. A frame that's *only* BUBBLE UPDATE
  // patches (the "N bubbles dirty" case) never touches listEl's children,
  // so it can't have shifted anyone's index — skipping this block entirely
  // for that frame is what keeps a dirty-only frame to EXACTLY the work
  // done in the BUBBLE UPDATE loop above: no full listEl.children scan, no
  // full nodeMap scan, no trimToMax() check.
  const structuralChange = toCreate.size > 0 || toRemove.size > 0;
  if (structuralChange) {
    for (const id of toRemove) {
      const node = nodeMap.get(id);
      if (node) bubblePoolManager.release(node);
      nodeMap.delete(id);
      vbubbles.delete(id);
    }
    // Overflow eviction hands each evicted node to the Pool (detach +
    // reset) instead of destroying it — trimToMax() itself doesn't know
    // or care that its caller happens to be pool-backed.
    trimToMax((evictedNode) => bubblePoolManager.release(evictedNode));
    // trimToMax() removes by DOM position (oldest end), not by id, so sync
    // nodeMap afterwards by dropping any entry whose node is no longer in
    // the document. nodeMap is bounded by maxMessages, so this stays cheap.
    for (const [id, node] of nodeMap) {
      if (!node.isConnected) {
        nodeMap.delete(id);
        vbubbles.delete(id);
      }
    }

    // One single pass over the live list — covers both jobs a structural
    // change requires (stamping --ovs-idle-index for staggered idle-wobble
    // delay, and syncing each surviving Virtual Bubble's `position`
    // snapshot to match) instead of two separate full scans. Reads
    // listEl.children directly (a live, already-materialized collection)
    // rather than a fresh querySelectorAll over the whole chat.
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
