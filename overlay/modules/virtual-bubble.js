
export const DIRTY_KEYS = ['position', 'text', 'style', 'decoration', 'animation'];

function cleanDirty() {
  return { position: false, text: false, style: false, decoration: false, animation: false };
}

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

export function createVirtualBubble(msg, index, decorationConfig) {
  return {
    id: msg.id,
    snapshot: snapshotAll(msg, index, decorationConfig),
    dirty: cleanDirty(),
  };
}

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

export function commitVirtualBubble(vbubble, nextSnapshot) {
  vbubble.snapshot = nextSnapshot;
  vbubble.dirty = cleanDirty();
}
