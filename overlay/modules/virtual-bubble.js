// Virtual Bubble — a lightweight, in-memory snapshot of what's currently
// rendered for a stack-mode message, plus a dirty-flag diff so an update to
// an already-rendered bubble only touches the DOM parts that actually
// changed instead of rebuilding the whole node.
//
// This module is pure bookkeeping — it never reads or writes the DOM.
// render-queue.js is the only place a dirty flag turns into a real DOM
// write (see bubble-updater.js for that half).
//
// Nothing in the app currently calls enqueueBubbleUpdate() (render-queue.js)
// — this is forward-looking scaffolding for a future "edit an
// already-rendered message" feature (live badge/role change, late avatar
// swap, decoration-config hot-reload, animation-only refresh, etc.), same
// status enqueueStackUpdate()/enqueueStackRemove() already had in this file
// before this change. createMessageNode()'s full-build path (message-
// renderer.js) is completely untouched by any of this.

export const DIRTY_KEYS = ['position', 'text', 'style', 'decoration', 'animation'];

function cleanDirty() {
  return { position: false, text: false, style: false, decoration: false, animation: false };
}

// Only the fields each category actually needs in order to detect a
// change — keeps the diff cheap and keeps "what counts as e.g. a text
// change" defined in exactly one place instead of scattered across
// call sites.
function snapshotPosition(index) {
  return { index: index || 0 };
}

function snapshotText(msg) {
  return {
    author: msg.author,
    messageHtml: msg.messageHtml,
    membershipTierName: msg.membershipTierName || '',
  };
}

function snapshotStyle(msg) {
  return {
    roles: (msg.roles || []).slice().sort().join('|'),
    isSuperchat: !!msg.isSuperchat,
    superchatTier: msg.superchatTier ?? null,
    superchatColor: msg.superchatColor ?? null,
    superchatBg: msg.superchatBg ?? null,
    superchatBorder: msg.superchatBorder ?? null,
    eventType: msg.eventType || 'text',
    memberMonths: msg.memberMonths || 0,
    avatarUrl: msg.avatarUrl || '',
  };
}

// Decoration layers come from global config, not per-message — a bubble is
// "decoration dirty" whenever the layer list it was last rendered against
// no longer matches the current one (config hot-reload), independent of
// whatever changed (if anything) about the message itself.
function snapshotDecoration(decorationConfig) {
  const layers = decorationConfig?.layers || [];
  const signature = layers.map((l) => [
    l.id, l.enabled, l.imageUrl, l.anchor, l.placement, l.stackLayer,
    l.idleAnimation, l.maskEnabled, l.maskMode, l.maskTarget, l.visibilityRoles,
  ]);
  return { signature: JSON.stringify(signature) };
}

function snapshotAnimation(msg) {
  return { eventType: msg.eventType || 'text', isSuperchat: !!msg.isSuperchat };
}

function snapshotAll(msg, index, decorationConfig) {
  return {
    position: snapshotPosition(index),
    text: snapshotText(msg),
    style: snapshotStyle(msg),
    decoration: snapshotDecoration(decorationConfig),
    animation: snapshotAnimation(msg),
  };
}

function shallowEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Builds a fresh Virtual Bubble for a message that was just fully rendered
// (create path). It starts fully clean — its stored snapshot already
// matches the DOM, so there's nothing to patch until something changes.
export function createVirtualBubble(msg, index, decorationConfig) {
  return {
    id: msg.id,
    snapshot: snapshotAll(msg, index, decorationConfig),
    dirty: cleanDirty(),
  };
}

// Compares a virtual bubble's stored snapshot against a fresh msg/index/
// decoration config WITHOUT mutating it. Returns which of the 5 categories
// actually changed plus the new snapshot to commit if the caller decides
// to apply the patch. If nothing changed, every key in `dirty` is false —
// callers use that to skip the DOM entirely.
export function diffVirtualBubble(vbubble, msg, index, decorationConfig) {
  const next = snapshotAll(msg, index, decorationConfig);
  const dirty = cleanDirty();
  if (!vbubble) {
    // No prior snapshot to compare against — treat everything as dirty so
    // the caller renders it in full rather than silently skipping it.
    DIRTY_KEYS.forEach((key) => { dirty[key] = true; });
    return { dirty, next };
  }
  for (const key of DIRTY_KEYS) {
    dirty[key] = !shallowEqual(vbubble.snapshot[key], next[key]);
  }
  return { dirty, next };
}

export function isAnyDirty(dirty) {
  return DIRTY_KEYS.some((key) => dirty[key]);
}

// Stores the fresh snapshot and clears every dirty flag — called right
// after the dirty categories have actually been applied to the live DOM
// node, so the Virtual Bubble stays in sync with what's on screen.
export function commitVirtualBubble(vbubble, nextSnapshot) {
  vbubble.snapshot = nextSnapshot;
  vbubble.dirty = cleanDirty();
}
