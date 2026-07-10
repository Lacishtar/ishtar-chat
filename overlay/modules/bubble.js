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

// Resolve màu tai thỏ theo role từ currentRoleStyle config
function resolveEarBgForNode(node) {
  const roles = state.currentRoleStyle?.roles || {};
  const ROLE_MAP = [
    { cls: 'ovs-moderator', key: 'moderator', defaultBg: '#f87171' },
    { cls: 'ovs-member', key: 'member', defaultBg: '#60a5fa' },
    { cls: 'ovs-superchat', key: 'superchat', defaultBg: '#facc15' },
  ];
  for (const { cls, key, defaultBg } of ROLE_MAP) {
    if (!node.classList.contains(cls)) continue;
    const roleCfg = roles[key] || {};
    if (roleCfg.enabled === false) continue;
    // Ưu tiên: rowBg → messageBg → default
    const bg = roleCfg.rowBg || roleCfg.rowBgColor
      || roleCfg.messageBg || roleCfg.messageBgColor
      || defaultBg;
    return bg || null;
  }
  return null; // không có role → dùng CSS var (--ovs-bubble-bg)
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
  ensureBunnyEarSpans(el);
  // Slot ears dùng CSS vars từ parent slot bubble bg (không cần JS color)
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
