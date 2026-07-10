// Builds/updates individual message DOM nodes, and owns the top-level
// render dispatch (stack / ticker / danmaku) plus max-message trimming and
// slot visibility refresh.
//
// NOTE: this module and special-modes.js import from each other — see the
// comment at the top of special-modes.js for why that's safe.

import { state, listEl, TICKER_THEMES, DANMAKU_THEMES, isFlythroughTheme } from './state.js';
import { resolveEffectiveSlotStyle } from './css-variables.js';
import { applyAvatar } from './avatar.js';
import { ensureBubbleTexture, applyMessageBunnyEars, applySlotBunnyEars } from './bubble.js';
import { applyDecorationLayers } from './decoration.js';
import {
  appendTickerMessage,
  appendDanmakuMessage,
  renderTickerHistory,
  renderDanmakuHistory,
  getTickerTrackEl,
} from './special-modes.js';

export function applySlotVisibility(el, slotKey) {
  if (!el) return;
  const effective = resolveEffectiveSlotStyle(state.currentSlotStyle, state.currentConfig);
  if (!effective[slotKey]?.visible) {
    el.setAttribute('data-hidden', 'true');
  } else {
    el.removeAttribute('data-hidden');
  }
}

export function refreshBadgesVisibility(badgesEl) {
  if (!badgesEl) return;
  applySlotVisibility(badgesEl, 'badges');
  if (badgesEl.getAttribute('data-hidden') === 'true') return;
  if (state.currentConfig.showBadges === false || !badgesEl.textContent.trim()) {
    badgesEl.setAttribute('data-hidden', 'true');
  }
}

export function refreshMessageNodeVisibility(node) {
  if (!node) return;
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  const authorEl = node.querySelector('[data-slot="author"]');
  const badgesEl = node.querySelector('[data-slot="badges"]');
  const messageEl = node.querySelector('[data-slot="message"]');

  if (avatarEl) {
    const avatarUrl = avatarEl.dataset.avatarUrl || '';
    applyAvatar(avatarEl, avatarUrl);
  }
  applySlotVisibility(authorEl, 'author');
  applySlotVisibility(messageEl, 'message');
  refreshBadgesVisibility(badgesEl);
}

export function refreshAllSlotVisibility() {
  const roots = listEl.querySelectorAll('.ovs-message');
  roots.forEach(refreshMessageNodeVisibility);
  const tickerTrackEl = getTickerTrackEl();
  if (tickerTrackEl) {
    tickerTrackEl.querySelectorAll('.ovs-message').forEach(refreshMessageNodeVisibility);
  }
}

function applySlotEnterAnimation(node) {
  if (TICKER_THEMES.has(state.currentTheme) || DANMAKU_THEMES.has(state.currentTheme)) return;
  const root = getComputedStyle(document.documentElement);
  if (root.getPropertyValue('--ovs-anim-enabled').trim() === '0') return;

  const pairs = [
    ['avatar', node.querySelector('[data-slot="avatar"]')],
    ['author', node.querySelector('[data-slot="author"]')],
    ['badges', node.querySelector('[data-slot="badges"]')],
    ['message', node.querySelector('[data-slot="message"]')],
  ];

  pairs.forEach(([, el]) => {
    if (!el || el.getAttribute('data-hidden') === 'true') return;
    el.classList.add('ovs-slot-enter');
    el.addEventListener(
      'animationend',
      (ev) => {
        if (ev.target === el) el.classList.remove('ovs-slot-enter');
      },
      { once: true }
    );
  });
}

export function createMessageNode(msg) {
  const node = state.messageTemplate.content.firstElementChild.cloneNode(true);

  const avatarEl = node.querySelector('[data-slot="avatar"]');
  const authorEl = node.querySelector('[data-slot="author"]');
  const badgesEl = node.querySelector('[data-slot="badges"]');
  const messageEl = node.querySelector('[data-slot="message"]');

  if (avatarEl) {
    // Always store (even when empty) so refreshMessageNodeVisibility can
    // reapply the correct value on later config/visibility changes.
    avatarEl.dataset.avatarUrl = msg.avatarUrl || '';
    applyAvatar(avatarEl, msg.avatarUrl);
  }
  applySlotVisibility(authorEl, 'author');
  applySlotVisibility(messageEl, 'message');

  // Set role class TRƯỚC khi gọi applyMessageBunnyEars
  // để resolveEarBgForNode có thể đọc classList ngay lập tức
  const primaryRole = msg.isSuperchat
    ? 'superchat'
    : msg.roles?.includes('moderator')
      ? 'moderator'
      : msg.roles?.includes('member')
        ? 'member'
        : null;
  if (primaryRole) node.classList.add(`ovs-${primaryRole}`);

  ensureBubbleTexture(node);
  if (!isFlythroughTheme()) {
    applyMessageBunnyEars(node);
  }
  if (authorEl) {
    authorEl.textContent = msg.author;
    ensureBubbleTexture(authorEl);
    if (!isFlythroughTheme()) {
      applySlotBunnyEars(authorEl, 'author');
    }
  }
  if (badgesEl) {
    if (msg.badges?.length) {
      badgesEl.textContent = msg.badges.map((b) => `[${b}]`).join(' ');
    }
    refreshBadgesVisibility(badgesEl);
  }
  // messageHtml originates from YouTube's own already-sanitized chat
  // renderer (plain text + their emoji <img> tags) — that's what lets us
  // safely use innerHTML here instead of losing the emoji.
  if (messageEl) {
    messageEl.innerHTML = msg.messageHtml;
    ensureBubbleTexture(messageEl);
    if (!isFlythroughTheme()) {
      applySlotBunnyEars(messageEl, 'message');
    }
  }

  if (msg.isSuperchat && msg.superchatCurrencyRaw && authorEl?.parentElement) {
    const amountEl = document.createElement('span');
    amountEl.className = 'ovs-superchat-amount';
    amountEl.textContent = msg.superchatCurrencyRaw;
    authorEl.parentElement.insertBefore(amountEl, authorEl.nextSibling);
  }

  applySlotEnterAnimation(node);
  return node;
}

export function trimToMax() {
  const max = state.currentConfig.maxMessages || 40;
  while (listEl.children.length > max) {
    // bottom-up: oldest is first child; top-down: oldest is last child.
    const removeFromStart = state.currentConfig.position !== 'top-down';
    const target = removeFromStart ? listEl.firstElementChild : listEl.lastElementChild;
    if (!target) break;
    target.remove();
  }
}

export function renderMessage(msg, options = {}) {
  const trackHistory = options.trackHistory !== false;
  if (!state.messageTemplate) return;

  if (trackHistory) {
    if (state.currentConfig.position === 'top-down') {
      state.messageHistory.unshift(msg);
    } else {
      state.messageHistory.push(msg);
    }
  }

  if (TICKER_THEMES.has(state.currentTheme)) {
    appendTickerMessage(msg);
    return;
  }

  if (DANMAKU_THEMES.has(state.currentTheme)) {
    appendDanmakuMessage(msg);
    return;
  }

  const node = createMessageNode(msg);

  if (state.currentConfig.position === 'top-down') {
    listEl.prepend(node);
  } else {
    listEl.appendChild(node);
  }

  // Decoration masks are built from live layout (getBoundingClientRect on
  // the mask target — avatar/bubble/username/chatContainer — and on the
  // decoration <img>), so they can only be computed once `node` is
  // actually attached to the document — every rect reads as 0x0 on a
  // detached node, which silently no-ops the whole masking step. Must
  // run after insertion, not inside createMessageNode().
  if (!isFlythroughTheme()) {
    applyDecorationLayers(node, state.currentDecoration);
  }

  trimToMax();
}

export function renderHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return;
  if (TICKER_THEMES.has(state.currentTheme)) {
    renderTickerHistory(history);
    return;
  }
  if (DANMAKU_THEMES.has(state.currentTheme)) {
    renderDanmakuHistory(history);
    return;
  }
  history.forEach((msg) => renderMessage(msg, { trackHistory: false }));
}
