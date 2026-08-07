
import { state, listEl, getDisplayMode, syncThemeModeClass } from './state.js';
import { resolveEffectiveSlotStyle } from './css-variables.js';
import { resolveMemberTier } from '/shared/role-style-config.mjs';
import { quoteCssContent, isImageUrlValue, getBadgeImageSrc } from '/shared/css-content-helpers.mjs';
import { composeMessageBodyHtml, composeMemberMonthsText } from './message-body.js';
import { applyAvatar } from './avatar.js';
import { ensureBubbleTexture, applyMessageBunnyEars, applySlotBunnyEars } from './bubble.js';
import { applyEmojiOnlyStyling } from './emoji.js';
import {
  appendDanmakuMessage,
  renderDanmakuHistory,
  resetDanmaku,
  removeDanmakuMessage,
  appendTickerMessage,
  renderTickerHistory,
  resetTicker,
  removeTickerMessage,
} from './special-modes.js';
import { enqueueStackMessage, clearStackList, enqueueStackRemove } from './render-queue.js';
import { removeQueuedMessage } from './message-queue.js';

export function applySlotVisibility(el, slotKey) {
  if (!el) return;
  const effective = resolveEffectiveSlotStyle(state.currentSlotStyle, state.currentConfig, state.currentLayout);
  if (!effective[slotKey]?.visible) {
    el.setAttribute('data-hidden', 'true');
  } else {
    el.removeAttribute('data-hidden');
  }
}

export function applyMemberTierBadgeImage(authorEl, side, url) {
  if (!authorEl) return;
  const cls = `ovs-member-badge ovs-member-badge--${side}`;
  let img = authorEl.querySelector(`:scope > img.ovs-member-badge--${side}`);
  if (!url) {
    if (img) img.remove();
    return;
  }
  if (!img) {
    img = document.createElement('img');
    img.className = cls;
    img.alt = '';
    const textEl = authorEl.querySelector('.ovs-author-text');
    if (side === 'before') {
      authorEl.insertBefore(img, textEl || authorEl.firstChild);
    } else {
      authorEl.appendChild(img);
    }
  }
  if (img.dataset.rawSrc !== url) {
    img.dataset.rawSrc = url;
    img.src = url;
  }
}

// "Dùng badge thật" (role.useRealBadge, shared/role-style-config.js) — a
// is an ADDITION next to the custom Mốc tháng badge, never a replacement
// after any Mốc tháng "after" badge) so it reads as trailing the display
export function applyRealBadgeImage(authorEl, url) {
  if (!authorEl) return;
  let img = authorEl.querySelector(':scope > img.ovs-real-badge');
  if (!url) {
    if (img) img.remove();
    return;
  }
  if (!img) {
    img = document.createElement('img');
    img.className = 'ovs-real-badge';
    img.alt = '';
    authorEl.appendChild(img);
  }
  if (img.dataset.rawSrc !== url) {
    img.dataset.rawSrc = url;
    img.src = url;
  }
}

export function refreshMessageNodeVisibility(node) {
  if (!node) return;
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  const authorEl = node.querySelector('[data-slot="author"]');
  const messageEl = node.querySelector('[data-slot="message"]');

  if (avatarEl) {
    const avatarUrl = avatarEl.dataset.avatarUrl || '';
    applyAvatar(avatarEl, avatarUrl);
  }
  applySlotVisibility(authorEl, 'author');
  applySlotVisibility(messageEl, 'message');
}

export function refreshAllSlotVisibility() {
  const roots = listEl.querySelectorAll('.ovs-message');
  roots.forEach(refreshMessageNodeVisibility);
}

function applySlotEnterAnimation(node, skip) {
  if (skip) return;
  const root = getComputedStyle(document.documentElement);
  if (root.getPropertyValue('--ovs-anim-enabled').trim() === '0') return;

  const pairs = [
    ['avatar', node.querySelector('[data-slot="avatar"]')],
    ['author', node.querySelector('[data-slot="author"]')],
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

export function createMessageNode(msg, options = {}) {
  const node = options.node || state.messageTemplate.content.firstElementChild.cloneNode(true);
  const rowEl = node.querySelector('.ovs-message') || node;

  // Stamped on every node regardless of display mode so a later
  // chat:deleted event can find this exact node (see removeMessageById
  // below) without each mode needing its own id-tagging logic. Pooled
  // stack-mode nodes get this wiped along with the rest of their dataset
  // on release (see pool/bubble-reset.js#resetRootDataset), so it's
  // always fresh for whatever message currently occupies the node.
  if (msg && msg.id !== undefined && msg.id !== null) {
    node.dataset.ovsMessageId = String(msg.id);
  }

  const avatarEl = node.querySelector('[data-slot="avatar"]');
  const authorEl = node.querySelector('[data-slot="author"]');
  const messageEl = node.querySelector('[data-slot="message"]');
  const memberMonthsEl = node.querySelector('[data-slot="member-months"]');

  if (avatarEl) {
    // Always store (even when empty) so refreshMessageNodeVisibility can
    // reapply the correct value on later config/visibility changes.
    avatarEl.dataset.avatarUrl = msg.avatarUrl || '';
    applyAvatar(avatarEl, msg.avatarUrl);
  }
  applySlotVisibility(authorEl, 'author');
  applySlotVisibility(messageEl, 'message');
  if (memberMonthsEl) memberMonthsEl.textContent = composeMemberMonthsText(msg);

  // Set role class TRƯỚC khi gọi applyMessageBunnyEars
  // để resolveEarBgForNode có thể đọc classList ngay lập tức.
  // Gắn TẤT CẢ role/event class phù hợp (không chỉ 1) — vd một mod gửi
  // Super Chat sẽ có cả ovs-moderator lẫn ovs-superchat. Đây là các data
  // hook DOM trung lập: message-renderer.js không quan tâm ai đang tiêu
  // thụ chúng. Sau refactor Super Chat -> Fan Service
  // (docs/refactor-superchat-to-fanservice.md), .ovs-superchat được Fan
  // Service (shared/fan-service-config.js) style hoàn toàn qua CSS scoped
  // khi bật; badge Identity (MOD) của role-styles.css vẫn hiện độc lập bên
  // cạnh vì badge không còn bị :not(.ovs-superchat) loại trừ nữa (mục 3.3
  // của tài liệu) — không còn khái niệm "combined role CSS" nữa, mỗi hệ
  // (Role/Fan Service) chỉ style đúng phần mình sở hữu.
  if (msg.roles?.includes('moderator')) rowEl.classList.add('ovs-moderator');
  if (msg.roles?.includes('member')) rowEl.classList.add('ovs-member');
  if (msg.isSuperchat) {
    rowEl.classList.add('ovs-superchat');
    if (msg.superchatTier) {
      rowEl.classList.add(`ovs-superchat-tier-${msg.superchatTier}`);
      rowEl.dataset.ovsSuperchatTier = String(msg.superchatTier);
    }
    if (msg.superchatColor) {
      rowEl.style.setProperty('--ovs-superchat-tier-color', msg.superchatColor);
    }
    if (msg.superchatBg) {
      rowEl.style.setProperty('--ovs-superchat-tier-bg', msg.superchatBg);
    }
    if (msg.superchatBorder) {
      rowEl.style.setProperty('--ovs-superchat-tier-border', msg.superchatBorder);
    }
  }

  const eventCls = `ovs-event-${msg.eventType || (msg.isSuperchat ? 'superchat' : 'text')}`;
  rowEl.classList.add(eventCls);

  // memberMonths is stored on the row so decoration.js can read it later
  // (including when refreshAllDecorations() re-applies layers without a msg ref).
  rowEl.dataset.ovsMemberMonths = String(msg.memberMonths || 0);
  // Same reason: bubble-updater.js's applyMemberTierToRow() runs the "Dùng
  // badge thật" real-badge lookup with no `msg` reference at hand
  rowEl.dataset.ovsBadgeIconUrl = msg.badgeIconUrl || '';

  const memberRole = msg.roles?.includes('member') ? state.currentRoleStyle?.roles?.member : null;
  let memberTier = null;

  if (memberRole) {
    const memberTiers = memberRole.memberTiers;
    const months = Number(rowEl.dataset.ovsMemberMonths) || 0;
    const tier = resolveMemberTier(memberTiers, months, memberRole.memberTiersEnabled !== false);
    memberTier = tier;
    if (tier) {
      rowEl.classList.add(`ovs-member-tier-${tier.index}`);
      rowEl.dataset.ovsMemberTier = String(tier.index);
      if (tier.color) rowEl.style.setProperty('--ovs-member-tier-color', tier.color);
      rowEl.style.setProperty(
        '--ovs-member-tier-badge-before-content',
        isImageUrlValue(tier.badgeBefore) ? 'none' : quoteCssContent(tier.badgeBefore)
      );
      rowEl.style.setProperty(
        '--ovs-member-tier-badge-after-content',
        isImageUrlValue(tier.badgeAfter) ? 'none' : quoteCssContent(tier.badgeAfter)
      );
    }
  }

  ensureBubbleTexture(rowEl);
  applyMessageBunnyEars(rowEl);
  if (authorEl) {
    authorEl.innerHTML = `<span class="ovs-author-text">${msg.author}</span>`;
    applyMemberTierBadgeImage(authorEl, 'before', getBadgeImageSrc(memberTier?.badgeBefore));
    applyMemberTierBadgeImage(authorEl, 'after', getBadgeImageSrc(memberTier?.badgeAfter));
    // "Dùng badge thật" — hiển thị SONG SONG với badge Mốc tháng ở trên,
    // không thay thế. Chỉ hiện khi role bật useRealBadge VÀ message này có
    // capture được badgeIconUrl (không phải hội viên nào cũng có, ví dụ
    // hội viên mới dưới ngưỡng badge đầu tiên của YouTube).
    applyRealBadgeImage(authorEl, memberRole?.useRealBadge ? (msg.badgeIconUrl || '') : '');
    ensureBubbleTexture(authorEl);
    applySlotBunnyEars(authorEl, 'author');
  }
  if (messageEl) {
    messageEl.innerHTML = composeMessageBodyHtml(msg, memberRole);
    applyEmojiOnlyStyling(rowEl, messageEl.querySelector('.ovs-text-content'));
    ensureBubbleTexture(messageEl);
    applySlotBunnyEars(messageEl, 'message');
  }

  if (msg.isSuperchat && msg.superchatCurrencyRaw && authorEl) {
    const amountEl = document.createElement('span');
    amountEl.className = 'ovs-superchat-amount';
    amountEl.textContent = msg.superchatCurrencyRaw;

    // Wrap author + amount in a flex container for banner/block layout support.
    // The wrapper (.ovs-author-area) is the flex parent that CSS banner rules target.
    const areaWrapper = document.createElement('div');
    areaWrapper.className = 'ovs-author-area';
    const parentEl = authorEl.parentElement;
    if (parentEl) {
      parentEl.insertBefore(areaWrapper, authorEl);
      areaWrapper.appendChild(authorEl);
      areaWrapper.appendChild(amountEl);
    } else {
      // Fallback: no parent yet — just append sibling (legacy path)
      authorEl.parentElement?.insertBefore(amountEl, authorEl.nextSibling);
    }
  }

  applySlotEnterAnimation(node, options.skipEnterAnimation);
  return node;
}

export function trimToMax(onEvict) {
  const max = state.currentConfig.maxMessages || 40;
  while (listEl.children.length > max) {
    // bottom-up: oldest is first child; top-down: oldest is last child.
    const removeFromStart = state.currentConfig.position !== 'top-down';
    const target = removeFromStart ? listEl.firstElementChild : listEl.lastElementChild;
    if (!target) break;
    if (typeof onEvict === 'function') {
      onEvict(target);
    } else {
      target.remove();
    }
  }
}

export function stampIdleIndexes() {
  Array.from(listEl.children).forEach((el, i) => {
    el.style.setProperty('--ovs-idle-index', String(i));
  });
}

export function renderMessage(msg, options = {}) {
  const trackHistory = options.trackHistory !== false;
  if (!state.messageTemplate) return;

  if (trackHistory && state.isMockHistory) {
    clearStackList();
    state.messageHistory = [];
    state.isMockHistory = false;
  }

  if (trackHistory) {
    if (state.currentConfig.position === 'top-down') {
      state.messageHistory.unshift(msg);
    } else {
      state.messageHistory.push(msg);
    }
  }

  // Self-heals the dataset attribute / clears the list if some call site
  // missed reacting to a displayMode change — cheap no-op when unchanged.
  syncThemeModeClass();

  if (getDisplayMode() === 'danmaku') {
    appendDanmakuMessage(msg);
    return;
  }
  if (getDisplayMode() === 'ticker') {
    appendTickerMessage(msg);
    return;
  }

  enqueueStackMessage(msg, { skipEnterAnimation: options.skipEnterAnimation });
}

export function renderHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return;
  if (getDisplayMode() === 'danmaku') {
    renderDanmakuHistory(history);
    return;
  }
  if (getDisplayMode() === 'ticker') {
    renderTickerHistory(history);
    return;
  }
  const chronological = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  chronological.forEach((msg) => renderMessage(msg, { trackHistory: false }));
}

// Handles a chat:deleted event (moderator/streamer removed a message, or
// banned its author) for whichever display mode is currently active.
// Covers all three places a message can be at the moment it's deleted:
// still queued (message-queue.js, not drained to a node yet), already a
// live DOM node (stack/danmaku/ticker), or sitting in messageHistory for
// future replay (theme switch, late-joining overlay).
export function removeMessageById(id) {
  if (id === undefined || id === null) return;
  const key = String(id);

  state.messageHistory = state.messageHistory.filter((m) => String(m.id) !== key);
  removeQueuedMessage(key);

  const mode = getDisplayMode();
  if (mode === 'danmaku') {
    removeDanmakuMessage(key);
  } else if (mode === 'ticker') {
    removeTickerMessage(key);
  } else {
    // stack + horizontal-bar both go through the same pooled render queue.
    enqueueStackRemove(key);
  }
}

export function clearAllMessages() {
  resetDanmaku();
  resetTicker();
  clearStackList();
  state.messageHistory = [];
  state.isMockHistory = false;
}