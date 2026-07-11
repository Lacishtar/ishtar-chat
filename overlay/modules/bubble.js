// Bubble texture overlay + "bunny ears" decoration (real DOM spans, not
// ::before/::after, so they don't conflict with custom badges on
// .ovs-author — see the original inline comment below).

import { state, listEl, isFlythroughTheme } from './state.js';
import { getTickerTrackEl } from './special-modes.js';

export function ensureBubbleTexture(parent) {
  if (!parent) return;
  let tex = parent.querySelector(`:scope > .ovs-bubble-texture`);
  if (!tex) {
    tex = document.createElement('div');
    tex.className = 'ovs-bubble-texture';
    parent.appendChild(tex);
  }
}

// ── Bunny Ears: Real DOM span injection ──────────────────────────────────
// Dùng <span class="ovs-bunny-ear ovs-bunny-ear--left/right"> thật thay vì
// ::before/::after để không xung đột với custom badges trên .ovs-author.

function ensureBunnyEarSpans(el) {
  let left = el.querySelector(':scope > .ovs-bunny-ear--left');
  let right = el.querySelector(':scope > .ovs-bunny-ear--right');
  if (!left) {
    left = document.createElement('span');
    left.className = 'ovs-bunny-ear ovs-bunny-ear--left';
    left.setAttribute('aria-hidden', 'true');
    el.insertBefore(left, el.firstChild);
  }
  if (!right) {
    right = document.createElement('span');
    right.className = 'ovs-bunny-ear ovs-bunny-ear--right';
    right.setAttribute('aria-hidden', 'true');
    // Insert right after left so both are at top of DOM
    left.after(right);
  }
  return { left, right };
}

function removeBunnyEarSpans(el) {
  el.querySelectorAll(':scope > .ovs-bunny-ear').forEach((s) => s.remove());
}

// Resolve màu tai thỏ theo role từ currentRoleStyle config.
// node có thể mang NHIỀU role class cùng lúc (vd: ovs-moderator + ovs-superchat),
// nên ưu tiên theo thứ tự superchat > moderator > member — khớp với thứ tự
// override trong role-styles.css (khối "combined roles + superchat" nằm sau
// cùng nên thắng cascade so với khối single-role).
const ROLE_PRIORITY = [
  { cls: 'ovs-superchat', key: 'superchat' },
  { cls: 'ovs-moderator', key: 'moderator' },
  { cls: 'ovs-member', key: 'member' },
];

function resolveRoleForNode(node) {
  const roles = state.currentRoleStyle?.roles || {};
  for (const entry of ROLE_PRIORITY) {
    if (!node.classList.contains(entry.cls)) continue;
    const roleCfg = roles[entry.key] || {};
    if (roleCfg.enabled === false) continue;
    return { ...entry, roleCfg };
  }
  return null;
}

// earColor là field riêng, độc lập với authorColor/messageBg/rowBg — người
// dùng chọn "Màu tai thỏ" trong panel Vai trò thì LUÔN thắng, không bị suy
// ra (và trước đây từng bị nhầm) từ màu tên hay nền bubble.
function resolveEarBgForNode(node) {
  const match = resolveRoleForNode(node);
  if (!match) return null; // không có role → dùng CSS var (--ovs-bubble-bg)
  const { roleCfg } = match;
  // Ưu tiên: earColor (set riêng) → rowBg → messageBg → mặc định theo bubble
  // (không còn ép về 1 mã hex cứng — trước đây điều này khiến tai thỏ hiện
  // màu không khớp bubble/author khi role chưa cấu hình earColor/messageBg).
  const bg = roleCfg.earColor
    || roleCfg.rowBg || roleCfg.rowBgColor
    || roleCfg.messageBg || roleCfg.messageBgColor;
  return bg || null;
}

// Slot mode (author/message tách bubble riêng): role-styles.css chỉ đổi màu
// nền của .ovs-text theo messageBg (không có rowBg ở slot mode), và chỉ đổi
// nền .ovs-author khi có authorBg (pill), nên tai thỏ phải theo đúng 2 quy tắc
// đó — không phải copy nguyên priority chain của row mode.
function resolveEarBgForSlot(node, slotName) {
  const match = resolveRoleForNode(node);
  if (!match) return null;
  const { roleCfg } = match;
  if (roleCfg.earColor) return roleCfg.earColor;
  if (slotName === 'message') {
    return roleCfg.messageBg || roleCfg.messageBgColor || null;
  }
  if (slotName === 'author') {
    // Chỉ tô màu tai theo role khi author thực sự có pill nền riêng (authorBg);
    // nếu không, bubble tác giả vẫn dùng nền mặc định nên tai cũng phải vậy.
    return roleCfg.authorBg || null;
  }
  return null;
}

export function applyMessageBunnyEars(node) {
  if (!node) return;
  const enabled = state.currentConfig.bubbleBunnyEars;
  if (!enabled) {
    removeBunnyEarSpans(node);
    node.removeAttribute('data-bunny-ears');
    return;
  }
  node.setAttribute('data-bunny-ears', 'true');
  const { left, right } = ensureBunnyEarSpans(node);
  // Set màu theo role (inline style override CSS var)
  const bg = resolveEarBgForNode(node);
  if (bg) {
    left.style.background = bg;
    right.style.background = bg;
  } else {
    left.style.removeProperty('background');
    right.style.removeProperty('background');
  }
}

export function applySlotBunnyEars(el, slotName) {
  if (!el) return;
  const slotCfg = state.currentSlotStyle?.slots?.[slotName];
  const enabled = slotCfg?.bubbleBunnyEars !== undefined && slotCfg.bubbleBunnyEars !== null
    ? slotCfg.bubbleBunnyEars
    : state.currentConfig.bubbleBunnyEars;
  if (!enabled) {
    removeBunnyEarSpans(el);
    el.removeAttribute('data-bunny-ears');
    return;
  }
  el.setAttribute('data-bunny-ears', 'true');
  const { left, right } = ensureBunnyEarSpans(el);
  // Role class nằm trên .ovs-message cha (author/message slot không tự mang
  // class role), nên phải tìm ngược lên để biết message này thuộc role nào.
  const rowNode = el.closest('.ovs-message');
  const bg = rowNode ? resolveEarBgForSlot(rowNode, slotName) : null;
  if (bg) {
    left.style.background = bg;
    right.style.background = bg;
  } else {
    left.style.removeProperty('background');
    right.style.removeProperty('background');
  }
}

export function refreshAllSlotBunnyEars() {
  if (isFlythroughTheme()) return;
  const applyTo = (node) => {
    applyMessageBunnyEars(node);
    const authorEl = node.querySelector('[data-slot="author"]');
    const messageEl = node.querySelector('[data-slot="message"]');
    applySlotBunnyEars(authorEl, 'author');
    applySlotBunnyEars(messageEl, 'message');
  };
  listEl.querySelectorAll('.ovs-message').forEach(applyTo);
  const tickerTrackEl = getTickerTrackEl();
  if (tickerTrackEl) {
    tickerTrackEl.querySelectorAll('.ovs-message').forEach(applyTo);
  }
}
