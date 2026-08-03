// That's what keeps "text giống -> không update", "class giống -> không
// update", "texture giống -> không update" true even for a category that

import { state, listEl } from './state.js';
import { resolveMemberTier } from '/shared/role-style-config.mjs';
import { quoteCssContent, isImageUrlValue, getBadgeImageSrc } from '/shared/css-content-helpers.mjs';
import { applyMemberTierBadgeImage, applyRealBadgeImage } from './message-renderer.js';
import { composeMessageBodyHtml, composeMemberMonthsText } from './message-body.js';
import { applyAvatar } from './avatar.js';
import { applyMessageBunnyEars, applySlotBunnyEars } from './bubble.js';
import { applyEmojiOnlyStyling } from './emoji.js';
import { applyDecorationLayers } from './decoration.js';
import {
  diffText,
  diffHTML,
  diffClass,
  diffExclusiveClass,
  diffDataset,
  diffStyleProp,
  diffTextureSrc,
} from './dom-diff.js';

function rowElOf(node) {
  return node.querySelector('.ovs-message') || node;
}

function applyTextUpdate(node, msg) {
  const authorTextEl = node.querySelector('[data-slot="author"] .ovs-author-text');
  diffText(authorTextEl, msg.author);

  const memberRole = msg.roles?.includes('member') ? state.currentRoleStyle?.roles?.member : null;

  const memberMonthsEl = node.querySelector('[data-slot="member-months"]');
  if (memberMonthsEl) {
    diffText(memberMonthsEl, composeMemberMonthsText(msg));
  }

  const messageEl = node.querySelector('[data-slot="message"]');
  if (messageEl) {
    const wrote = diffHTML(messageEl, composeMessageBodyHtml(msg, memberRole));
    // content actually changed (text giống -> không update propagates to
    if (wrote) applyEmojiOnlyStyling(rowElOf(node), messageEl.querySelector('.ovs-text-content'));
  }
}

// Resolves + applies Mốc tháng (member tier) styling for a single already-
function applyMemberTierToRow(rowEl) {
  const authorEl = rowEl.querySelector('[data-slot="author"]');
  let tier = null;
  if (rowEl.classList.contains('ovs-member')) {
    const memberRole = state.currentRoleStyle?.roles?.member;
    const memberTiers = memberRole?.memberTiers;
    const months = Number(rowEl.dataset.ovsMemberMonths) || 0;
    tier = resolveMemberTier(memberTiers, months, memberRole?.memberTiersEnabled !== false);
    diffExclusiveClass(rowEl, 'ovs-member-tier-', tier ? String(tier.index) : null);
    diffDataset(rowEl, 'ovsMemberTier', tier ? tier.index : null);
    diffStyleProp(rowEl, '--ovs-member-tier-color', tier?.color || null);
    diffStyleProp(
      rowEl,
      '--ovs-member-tier-badge-before-content',
      tier && !isImageUrlValue(tier.badgeBefore) ? quoteCssContent(tier.badgeBefore) : null
    );
    diffStyleProp(
      rowEl,
      '--ovs-member-tier-badge-after-content',
      tier && !isImageUrlValue(tier.badgeAfter) ? quoteCssContent(tier.badgeAfter) : null
    );
  } else {
    diffExclusiveClass(rowEl, 'ovs-member-tier-', null);
    diffDataset(rowEl, 'ovsMemberTier', null);
    diffStyleProp(rowEl, '--ovs-member-tier-color', null);
    diffStyleProp(rowEl, '--ovs-member-tier-badge-before-content', null);
    diffStyleProp(rowEl, '--ovs-member-tier-badge-after-content', null);
  }

  // check), matching every other "value giống -> không update" write.
  applyMemberTierBadgeImage(authorEl, 'before', tier ? getBadgeImageSrc(tier.badgeBefore) : null);
  applyMemberTierBadgeImage(authorEl, 'after', tier ? getBadgeImageSrc(tier.badgeAfter) : null);

  // "Dùng badge thật" — song song với badge Mốc tháng ở trên, không thay
  // thế. rowEl.dataset.ovsBadgeIconUrl was stashed by applyStyleUpdate()
  const memberRole = state.currentRoleStyle?.roles?.member;
  const realBadgeUrl = memberRole?.useRealBadge ? (rowEl.dataset.ovsBadgeIconUrl || '') : '';
  applyRealBadgeImage(authorEl, realBadgeUrl);

  return tier;
}

// Called whenever the Mốc tháng config itself changes (role-style:updated
export function refreshAllMemberTiers() {
  listEl.querySelectorAll('.ovs-message.ovs-member').forEach(applyMemberTierToRow);
}

function applyStyleUpdate(node, msg) {
  const rowEl = rowElOf(node);

  diffClass(rowEl, 'ovs-moderator', msg.roles?.includes('moderator'));
  diffClass(rowEl, 'ovs-member', msg.roles?.includes('member'));
  diffClass(rowEl, 'ovs-superchat', !!msg.isSuperchat);

  if (msg.isSuperchat) {
    diffExclusiveClass(rowEl, 'ovs-superchat-tier-', msg.superchatTier ? String(msg.superchatTier) : null);
    diffDataset(rowEl, 'ovsSuperchatTier', msg.superchatTier || null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-color', msg.superchatColor || null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-bg', msg.superchatBg || null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-border', msg.superchatBorder || null);
  } else {
    diffExclusiveClass(rowEl, 'ovs-superchat-tier-', null);
    diffDataset(rowEl, 'ovsSuperchatTier', null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-color', null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-bg', null);
    diffStyleProp(rowEl, '--ovs-superchat-tier-border', null);
  }

  diffExclusiveClass(rowEl, 'ovs-event-', msg.eventType || (msg.isSuperchat ? 'superchat' : 'text'));
  diffDataset(rowEl, 'ovsMemberMonths', msg.memberMonths || 0);
  // "Dùng badge thật" — msg.badgeIconUrl is per-message captured data (not
  diffDataset(rowEl, 'ovsBadgeIconUrl', msg.badgeIconUrl || '');

  const tier = applyMemberTierToRow(rowEl);

  applyMessageBunnyEars(rowEl);
  const authorEl = node.querySelector('[data-slot="author"]');
  const messageEl = node.querySelector('[data-slot="message"]');
  applySlotBunnyEars(authorEl, 'author');
  applySlotBunnyEars(messageEl, 'message');

  // texture giống -> không update, so an unrelated style change (e.g. a
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  if (avatarEl) {
    diffTextureSrc(avatarEl, 'avatarUrl', msg.avatarUrl, () => applyAvatar(avatarEl, msg.avatarUrl));
  }
}

function applyDecorationUpdate(node) {
  applyDecorationLayers(rowElOf(node), state.currentDecoration);
}

function applyAnimationUpdate(node, msg) {
  diffDataset(rowElOf(node), 'ovsAnimState', msg.eventType || (msg.isSuperchat ? 'superchat' : 'text'));
}

// dirty.position — just this node's idle-index stagger var, instead of
// render-queue.js's structural sync pass rewriting every child in the list.
function applyPositionUpdate(node, index) {
  diffStyleProp(node, '--ovs-idle-index', String(index));
}

export function applyDirtyBubbleUpdate(node, dirty, msg, index) {
  if (!node) return;
  if (dirty.text) applyTextUpdate(node, msg);
  if (dirty.style) applyStyleUpdate(node, msg);
  if (dirty.decoration) applyDecorationUpdate(node);
  if (dirty.animation) applyAnimationUpdate(node, msg);
  if (dirty.position) applyPositionUpdate(node, index);
}
