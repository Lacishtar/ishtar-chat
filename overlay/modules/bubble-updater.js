// Applies a Virtual Bubble dirty-flag patch (see virtual-bubble.js) to an
// already-rendered stack-mode node, touching only the DOM areas the flag
// says actually changed. This is the DOM-writing half of the Virtual
// Bubble system — kept in its own module so render-queue.js's flush()
// stays a thin dispatcher, and so this reuses the exact same per-slot
// helpers createMessageNode() already calls (message-renderer.js) instead
// of duplicating their logic.
//
// Contract: `node` is the live `.ovs-slot` root render-queue.js tracks in
// nodeMap (same node createMessageNode() returned). Each apply*Update()
// below is only ever called by applyDirtyBubbleUpdate() for a flag that's
// already true — "not dirty -> don't touch the DOM" is enforced by the
// caller (render-queue.js), not re-checked here.
//
// DOM DIFF: a Virtual Bubble dirty flag says a *category* changed
// (position/text/style/decoration/animation), not that every individual
// field inside it did — e.g. `dirty.style` goes true whenever roles OR
// superchat tier OR avatarUrl changes, even if only one of the three
// actually did. Every write below goes through dom-diff.js first: it
// re-reads the DOM's current value right before writing and skips the
// write entirely when it already matches (Virtual State == DOM State).
// That's what keeps "text giống -> không update", "class giống -> không
// update", "texture giống -> không update" true even for a category that
// IS dirty, and is exactly why the UI never visibly changes for a field
// that didn't actually change — no class re-toggle to restart a CSS
// animation, no avatar <img> re-pointed at the same URL, etc.

import { state } from './state.js';
import { resolveMemberTier, quoteCssContent } from '/shared/role-style-config.mjs';
import { composeMessageBodyHtml } from './message-body.js';
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

// dirty.text — only the text-bearing slots (author name, badges, message
// body/emoji). Never touches texture, decoration hosts, avatar, or role
// classes — a pure text edit shouldn't re-fetch the avatar or rebuild the
// decoration layers. Each field is DOM-diffed on its own: e.g. an edit
// that only changes the message body leaves the author span completely
// untouched, since diffText() there finds it already matches and no-ops.
function applyTextUpdate(node, msg) {
  const authorTextEl = node.querySelector('[data-slot="author"] .ovs-author-text');
  diffText(authorTextEl, msg.author);

  const badgesEl = node.querySelector('[data-slot="badges"]');
  if (badgesEl && msg.badges?.length) {
    diffText(badgesEl, msg.badges.map((b) => `[${b}]`).join(' '));
  }

  const messageEl = node.querySelector('[data-slot="message"]');
  if (messageEl) {
    // Diffed as one blob (chat text span + milestone text span) rather than
    // just the .ovs-text-content sub-span, since the milestone span may
    // need to be added/removed/changed entirely between two messages this
    // pooled node renders — composeMessageBodyHtml() is the single place
    // (shared with message-renderer.js's full-build path) that decides
    // what that combined HTML should be, so the diff-update path can never
    // drift out of sync with what a fresh build would have produced.
    const memberRole = msg.roles?.includes('member') ? state.currentRoleStyle?.roles?.member : null;
    const wrote = diffHTML(messageEl, composeMessageBodyHtml(msg, memberRole));
    // applyEmojiOnlyStyling() re-walks childNodes and re-wraps glyphs — a
    // real (not cosmetic) DOM operation, so only re-run it when the text
    // content actually changed (text giống -> không update propagates to
    // this derived pass too, not just the raw HTML write).
    if (wrote) applyEmojiOnlyStyling(rowElOf(node), messageEl.querySelector('.ovs-text-content'));
  }
}

// dirty.style — role classes, superchat tier CSS vars, bunny-ear colors,
// avatar image. Never touches message/author text content or decoration
// layers. Every class/attr/var/texture write below is individually
// DOM-diffed, so a `style` patch triggered by (say) only `roles` changing
// never re-touches the avatar <img> or the superchat CSS vars just
// because they live in the same category.
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

  // Member Tiers — mirrors the Super Chat tier block above. Resolved via
  // rowEl.dataset.ovsMemberMonths (just diffed into place on the line
  // above), reusing the exact same resolveMemberTier() helper
  // message-renderer.js's full-build path uses, so tier resolution never
  // drifts between the create-path and the diff-update path.
  if (msg.roles?.includes('member')) {
    const memberRole = state.currentRoleStyle?.roles?.member;
    const memberTiers = memberRole?.memberTiers;
    const months = Number(rowEl.dataset.ovsMemberMonths) || 0;
    const tier = resolveMemberTier(memberTiers, months, memberRole?.memberTiersEnabled !== false);
    diffExclusiveClass(rowEl, 'ovs-member-tier-', tier ? String(tier.index) : null);
    diffDataset(rowEl, 'ovsMemberTier', tier ? tier.index : null);
    diffStyleProp(rowEl, '--ovs-member-tier-color', tier?.color || null);
    diffStyleProp(rowEl, '--ovs-member-tier-badge-before-content', tier ? quoteCssContent(tier.badge) : null);
  } else {
    diffExclusiveClass(rowEl, 'ovs-member-tier-', null);
    diffDataset(rowEl, 'ovsMemberTier', null);
    diffStyleProp(rowEl, '--ovs-member-tier-color', null);
    diffStyleProp(rowEl, '--ovs-member-tier-badge-before-content', null);
  }

  // Bunny ears read role/earColor config off the DOM classes just written
  // above, so they still need to be (re-)evaluated whenever style is
  // dirty — but bubble.js's own apply*BunnyEars() already only touches
  // its span/background when the resolved color actually differs, so no
  // extra diff wrapper is needed here.
  applyMessageBunnyEars(rowEl);
  const authorEl = node.querySelector('[data-slot="author"]');
  const messageEl = node.querySelector('[data-slot="message"]');
  applySlotBunnyEars(authorEl, 'author');
  applySlotBunnyEars(messageEl, 'message');

  // Avatar "texture": only actually re-run applyAvatar() (which sets src/
  // onload/onerror and can trigger a real network fetch) when the raw
  // avatar URL differs from what's already recorded on the element —
  // texture giống -> không update, so an unrelated style change (e.g. a
  // role badge) never causes the avatar image to flicker/reload.
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  if (avatarEl) {
    diffTextureSrc(avatarEl, 'avatarUrl', msg.avatarUrl, () => applyAvatar(avatarEl, msg.avatarUrl));
  }
}

// dirty.decoration — re-runs the existing layer reconciler, which already
// DOM-diffs internally per layer (existingElements map keyed by layer id,
// `data-raw-src` check before touching an <img> src — see decoration.js)
// so an unchanged layer's texture is never re-fetched and an unchanged
// layer's wrapper is never rebuilt. Never touches text/style.
function applyDecorationUpdate(node) {
  applyDecorationLayers(rowElOf(node), state.currentDecoration);
}

// dirty.animation — idle-animation state hook only. Never touches text,
// role/style classes, or decoration hosts (a decoration layer's own
// idleAnimation is config-owned and lives inside applyDecorationUpdate,
// same as the rest of that layer's look).
function applyAnimationUpdate(node, msg) {
  diffDataset(rowElOf(node), 'ovsAnimState', msg.eventType || (msg.isSuperchat ? 'superchat' : 'text'));
}

// dirty.position — just this node's idle-index stagger var, instead of
// render-queue.js's structural sync pass rewriting every child in the list.
function applyPositionUpdate(node, index) {
  diffStyleProp(node, '--ovs-idle-index', String(index));
}

// Dispatches to exactly the categories flagged in `dirty`. If nothing in
// `dirty` is true, this is a no-op — the caller already skips even
// invoking this function in that case (see render-queue.js), so a
// non-dirty bubble never causes a single DOM read/write. Within a flagged
// category, the DOM Diff helpers above then further narrow that down to
// only the specific fields that actually changed — the UI itself never
// visibly changes for anything that was already correct.
export function applyDirtyBubbleUpdate(node, dirty, msg, index) {
  if (!node) return;
  if (dirty.text) applyTextUpdate(node, msg);
  if (dirty.style) applyStyleUpdate(node, msg);
  if (dirty.decoration) applyDecorationUpdate(node);
  if (dirty.animation) applyAnimationUpdate(node, msg);
  if (dirty.position) applyPositionUpdate(node, index);
}
