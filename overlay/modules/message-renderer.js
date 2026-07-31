// Builds individual message DOM nodes (createMessageNode, used by both
// this module's stack-mode path AND special-modes.js's danmaku/ticker
// paths) and owns history tracking + top-level mode dispatch.
//
// IMPORTANT (post-refactor): this module no longer appends/removes stack-
// mode nodes itself. renderMessage() decides history tracking + which
// mode a message belongs to, but for stack mode it now hands the message
// off to render-queue.js's enqueueStackMessage() instead of touching
// listEl directly — render-queue.js is the only place stack-mode
// appendChild/prepend/removeChild happens, batched on requestAnimationFrame.
// Danmaku/ticker are unaffected by this refactor: appendDanmakuMessage()/
// appendTickerMessage() (special-modes.js) already own their own
// timing/queueing model and were out of scope for this pass.

import { state, listEl, getDisplayMode, syncThemeModeClass } from './state.js';
import { resolveEffectiveSlotStyle } from './css-variables.js';
import { resolveMemberTier, quoteCssContent } from '/shared/role-style-config.mjs';
import { composeMessageBodyHtml } from './message-body.js';
import { applyAvatar } from './avatar.js';
import { ensureBubbleTexture, applyMessageBunnyEars, applySlotBunnyEars } from './bubble.js';
import { applyEmojiOnlyStyling } from './emoji.js';
import {
  appendDanmakuMessage,
  renderDanmakuHistory,
  resetDanmaku,
  appendTickerMessage,
  renderTickerHistory,
  resetTicker,
} from './special-modes.js';
import { enqueueStackMessage, clearStackList } from './render-queue.js';

export function applySlotVisibility(el, slotKey) {
  if (!el) return;
  const effective = resolveEffectiveSlotStyle(state.currentSlotStyle, state.currentConfig, state.currentLayout);
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
  if (!badgesEl.textContent.trim()) {
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
}

function applySlotEnterAnimation(node, skip) {
  if (skip) return;
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

export function createMessageNode(msg, options = {}) {
  // `node` is the root returned to callers: the MOVEMENT layer (.ovs-slot).
  // It's the element ticker/danmaku/stack actually append and position.
  // `rowEl` is the RENDER layer (.ovs-message) nested two levels inside —
  // every class/attribute/texture/decoration that visually belongs to the
  // bubble itself must be applied there, not on the outer wrapper, or it
  // would silently detach from the idle-wobble + bubble box (see the
  // architecture doc: each DOM layer has exactly one job).
  // `options.node`, if given, is an already-neutral node handed to us by
  // BubblePoolManager (overlay/modules/pool/PoolManager.js) via
  // acquire() — reused instead of cloning a fresh one from the template.
  // This function doesn't need to know whether that node is pooled or
  // brand-new; it just builds onto whatever root it's given, exactly the
  // way it always built onto a fresh clone. Callers that don't pass
  // options.node (danmaku/ticker — see special-modes.js) keep the
  // original clone-every-time behavior unchanged.
  const node = options.node || state.messageTemplate.content.firstElementChild.cloneNode(true);
  const rowEl = node.querySelector('.ovs-message') || node;

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
  // để resolveEarBgForNode có thể đọc classList ngay lập tức.
  // Gắn TẤT CẢ role class phù hợp (không chỉ 1) — vd một mod gửi Super Chat
  // sẽ có cả ovs-moderator lẫn ovs-superchat. role-styles.css đã có sẵn các
  // khối CSS riêng cho tổ hợp .ovs-moderator.ovs-superchat /
  // .ovs-member.ovs-superchat để hiện gradient pha trộn, nhưng trước đây
  // node chỉ nhận đúng 1 class (ưu tiên superchat > mod > member) nên các
  // khối CSS đó không bao giờ khớp — badge/màu của mod hoặc member bị Super
  // Chat "nuốt mất" hoàn toàn thay vì hoà trộn.
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
    // Apply layout class based on root attribute set by role-style-config
    const rootEl = document.documentElement;
    const superchatLayoutAttr = rootEl.getAttribute('data-ovs-role-superchat-layout');
    if (superchatLayoutAttr === 'youtube') {
      rowEl.classList.add('ovs-superchat-youtube');
    }
  }

  // Attach eventType class hook (e.g. ovs-event-text, ovs-event-superchat, ovs-event-sticker,
  // ovs-event-membership_new, ovs-event-membership_gift_sent, ovs-event-membership_gift_received,
  // ovs-event-membership_milestone) — driven entirely by msg.eventType, no event names hardcoded here.
  const eventCls = `ovs-event-${msg.eventType || (msg.isSuperchat ? 'superchat' : 'text')}`;
  rowEl.classList.add(eventCls);

  // memberMonths is stored on the row so decoration.js can read it later
  // (including when refreshAllDecorations() re-applies layers without a msg ref).
  rowEl.dataset.ovsMemberMonths = String(msg.memberMonths || 0);

  // Member Tiers — same pattern as the Super Chat tier block above: resolve
  // which configured tier (if any) this row qualifies for, then stamp an
  // exclusive class + inline CSS vars onto the row. The lookup is keyed off
  // rowEl.dataset.ovsMemberMonths (just set above), not off msg.badges/text
  // again — deriveMemberMonths() (shared/chat-message.js) already did that
  // parsing once, and resolveMemberTier() is the single shared helper for
  // "which tier does this months value qualify for" (also used by
  // bubble-updater.js's diff-update path, so there is exactly one
  // resolution algorithm for the whole app).
  const memberRole = msg.roles?.includes('member') ? state.currentRoleStyle?.roles?.member : null;

  if (memberRole) {
    const memberTiers = memberRole.memberTiers;
    const months = Number(rowEl.dataset.ovsMemberMonths) || 0;
    const tier = resolveMemberTier(memberTiers, months, memberRole.memberTiersEnabled !== false);
    if (tier) {
      rowEl.classList.add(`ovs-member-tier-${tier.index}`);
      rowEl.dataset.ovsMemberTier = String(tier.index);
      if (tier.color) rowEl.style.setProperty('--ovs-member-tier-color', tier.color);
      rowEl.style.setProperty('--ovs-member-tier-badge-before-content', quoteCssContent(tier.badge));
    }
  }

  ensureBubbleTexture(rowEl);
  applyMessageBunnyEars(rowEl);
  if (authorEl) {
    authorEl.innerHTML = `<span class="ovs-author-text">${msg.author}</span>`;
    ensureBubbleTexture(authorEl);
    applySlotBunnyEars(authorEl, 'author');
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
    messageEl.innerHTML = composeMessageBodyHtml(msg, memberRole);
    // If the message is nothing but emoji (unicode chars and/or YouTube's
    // own custom emoji <img> tags), mark the row and wrap each glyph so
    // layout-text.css can scale the text up a touch and give every emoji
    // its own square backdrop chip.
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

// `onEvict(node)`, if given, is called with each overflowing node INSTEAD
// of this function detaching it itself — e.g. render-queue.js passes
// bubblePoolManager.release() so an evicted stack-mode bubble goes back to
// the pool (detached + reset) rather than being destroyed outright.
// Without an onEvict callback, falls back to the original behavior
// (target.remove()) — used by nothing in this app anymore but kept as a
// safe default for any other caller.
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

// Stamps --ovs-idle-index on every current child, for staggered idle
// animation delay. Pulled out of renderMessage() so render-queue.js can
// call it exactly once per animation frame for however many messages
// landed that frame, instead of the old behavior of re-stamping the
// entire list once per individual message (O(n) per message, O(n^2)
// over a burst of n messages).
export function stampIdleIndexes() {
  Array.from(listEl.children).forEach((el, i) => {
    el.style.setProperty('--ovs-idle-index', String(i));
  });
}

export function renderMessage(msg, options = {}) {
  const trackHistory = options.trackHistory !== false;
  if (!state.messageTemplate) return;

  // `trackHistory` is only false during a history replay (renderHistory());
  // a real *live* message (trackHistory: true) means chat has actually
  // started, so any leftover mock preview bubbles (see theme-loader.js)
  // need to go now — otherwise they'd sit in the feed forever, with real
  // messages just piling up next to them instead of replacing them.
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

  // Node creation, insertion, decoration masking, trimming, and the
  // idle-index stamp all used to happen right here, synchronously, for
  // every single message. They now happen together, batched, inside
  // render-queue.js's flush() on the next animation frame — see that
  // file for the full read/write-batching rationale. This function's
  // job for stack mode ends at handing the message off to the queue.
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
  // `history` (state.messageHistory) is stored newest-first for top-down
  // (built via unshift in renderMessage() above) and oldest-first for
  // bottom-up (built via push). Replaying it must always feed renderMessage()
  // in chronological (oldest-first) order — exactly like live arrival does —
  // since renderMessage()'s own prepend/append already places each message
  // correctly for the current position mode. Skipping this normalization
  // double-reverses top-down history on every reconnect / theme switch /
  // display-mode change: replaying newest-first via prepend ends up
  // prepending the OLDEST message last, flipping the whole stack upside
  // down. Same fix already applied to the danmaku/ticker replay paths below.
  const chronological = state.currentConfig.position === 'top-down' ? [...history].reverse() : history;
  chronological.forEach((msg) => renderMessage(msg, { trackHistory: false }));
}

// Wipes all rendered chat messages from the DOM and clears the in-memory
// history. Called when a new stream connection starts so stale messages
// from the previous session never bleed through in OBS.
export function clearAllMessages() {
  resetDanmaku();
  resetTicker();
  // clearStackList() drops any stack-mode messages already handed to
  // render-queue.js but not yet flushed (still waiting on the next
  // requestAnimationFrame) before wiping the DOM — otherwise they'd still
  // get appended right after the list is cleared, silently undoing this.
  clearStackList();
  state.messageHistory = [];
  state.isMockHistory = false;
}