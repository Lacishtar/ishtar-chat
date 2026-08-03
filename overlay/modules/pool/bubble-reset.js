

import { stickerPoolManager } from './StickerPool.js';
import { texturePoolManager } from './TexturePool.js';

const BASE_ROW_CLASS = new WeakMap(); // rowEl -> pristine className string

function resolveRowEl(node) {
  return node.querySelector('.ovs-message') || node;
}

// Records a node's pristine (just-cloned-from-template, never-built)
export function captureBubbleBaseline(node) {
  if (!node) return node;
  const rowEl = resolveRowEl(node);
  if (rowEl && !BASE_ROW_CLASS.has(rowEl)) {
    BASE_ROW_CLASS.set(rowEl, rowEl.className);
  }
  return node;
}

const DATASET_KEYS_TO_PRESERVE = new Set(['slot']);

function clearDataset(el) {
  if (!el || !el.dataset) return;
  Object.keys(el.dataset).forEach((key) => {
    if (DATASET_KEYS_TO_PRESERVE.has(key)) return;
    delete el.dataset[key];
  });
}

// reset text — message body (both the raw slot and the emoji-only glyph
// wrapping message-renderer.js/emoji.js may have applied inside it).
function resetText(node) {
  const messageEl = node.querySelector('[data-slot="message"]');
  if (!messageEl) return;
  messageEl.innerHTML = '';
  messageEl.removeAttribute('data-emoji-only');
  clearDataset(messageEl);
  messageEl.removeAttribute('style');
}

function resetAuthor(node) {
  const authorEl = node.querySelector('[data-slot="author"]');
  if (!authorEl) return;

  const areaWrapper = node.querySelector('.ovs-author-area');
  if (areaWrapper && areaWrapper.contains(authorEl)) {
    const grandparent = areaWrapper.parentElement;
    if (grandparent) grandparent.insertBefore(authorEl, areaWrapper);
    areaWrapper.remove();
  }

  authorEl.innerHTML = '';
  clearDataset(authorEl);
  authorEl.removeAttribute('style');
}

// reset member-months — dedicated "Hội viên trong N tháng" line (Fan
function resetMemberMonths(node) {
  const memberMonthsEl = node.querySelector('[data-slot="member-months"]');
  if (!memberMonthsEl) return;
  memberMonthsEl.textContent = '';
  clearDataset(memberMonthsEl);
  memberMonthsEl.removeAttribute('style');
}

function resetAvatar(node) {
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  if (!avatarEl) return;
  avatarEl.onload = null;
  avatarEl.onerror = null;
  avatarEl.removeAttribute('src');
  avatarEl.removeAttribute('data-hidden');
  clearDataset(avatarEl); // drops dataset.avatarUrl set by message-renderer.js
  avatarEl.removeAttribute('style');
}

function resetTexture(node) {
  node.querySelectorAll('.ovs-bubble-texture').forEach((el) => texturePoolManager.release(el));
  node.querySelectorAll('.ovs-bunny-ear').forEach((el) => el.remove());
  node.querySelectorAll('[data-bunny-ears]').forEach((el) => el.removeAttribute('data-bunny-ears'));
  node.querySelectorAll('[data-bunny-ears-force-row]').forEach((el) => el.removeAttribute('data-bunny-ears-force-row'));
}

function resetDecoration(node) {
  node.querySelectorAll('.ovs-decoration-layer').forEach((el) => stickerPoolManager.release(el));
  node.querySelectorAll('.ovs-decoration-host').forEach((el) => el.remove());
  node.querySelectorAll('.ovs-decoration-anchor').forEach((wrap) => {
    const child = wrap.firstElementChild;
    if (child && wrap.parentNode) {
      wrap.parentNode.insertBefore(child, wrap);
    }
    wrap.remove();
  });
  node.querySelectorAll('[data-has-decoration]').forEach((el) => delete el.dataset.hasDecoration);
  if (node.dataset.hasDecoration) delete node.dataset.hasDecoration;
}

function resetAnimationState(node, rowEl) {
  node.querySelectorAll('.ovs-slot-enter').forEach((el) => el.classList.remove('ovs-slot-enter'));
  node.style.removeProperty('--ovs-idle-index');
  delete rowEl.dataset.ovsAnimState;
  // Danmaku-only hooks — harmless no-op for stack-mode nodes that never
  // had them, but keeps a node fully neutral if it's ever cross-used.
  delete node.dataset.danmakuLane;
  node.style.removeProperty('animation-duration');
}

function resetTransform(node) {
  node.style.removeProperty('transform');
  node.style.removeProperty('top');
}

function resetOpacity(node) {
  node.style.removeProperty('opacity');
}

function resetRootDataset(node, rowEl) {
  clearDataset(node);
  if (rowEl && rowEl !== node) clearDataset(rowEl);
}

function resetInlineStyleCatchAll(node, rowEl) {
  node.removeAttribute('style');
  if (rowEl && rowEl !== node) rowEl.removeAttribute('style');
  node.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
}

function stripAriaAttrs(el) {
  Array.from(el.attributes).forEach((attr) => {
    if (attr.name === 'role' || attr.name.startsWith('aria-')) {
      el.removeAttribute(attr.name);
    }
  });
}

function resetAriaAttributes(node) {
  stripAriaAttrs(node); // querySelectorAll below only matches descendants, not node itself
  const descendants = node.querySelectorAll('[aria-hidden], [aria-label], [aria-live], [aria-describedby], [aria-current], [role]');
  descendants.forEach(stripAriaAttrs);
}

function resetRowClasses(rowEl) {
  const baseline = BASE_ROW_CLASS.get(rowEl);
  if (baseline !== undefined) {
    rowEl.className = baseline;
  }
}

// Resets one bubble node to a neutral, reusable state so it carries NO
export function resetBubbleNode(node) {
  if (!node) return node;
  const rowEl = resolveRowEl(node);

  resetText(node);
  resetAuthor(node);
  resetMemberMonths(node);
  resetAvatar(node);
  resetTexture(node);
  resetDecoration(node);
  resetAnimationState(node, rowEl);
  resetTransform(node);
  resetOpacity(node);
  resetRowClasses(rowEl);
  resetRootDataset(node, rowEl);
  resetInlineStyleCatchAll(node, rowEl);
  resetAriaAttributes(node);

  return node;
}

// Detaches a node from wherever it's currently mounted in the document,
export function detachBubbleNode(node) {
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
  return node;
}

export default { resetBubbleNode, detachBubbleNode, captureBubbleBaseline };

