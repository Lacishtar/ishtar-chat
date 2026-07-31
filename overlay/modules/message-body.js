// message-body.js — builds the innerHTML for the message slot
// ([data-slot="message"], class .ovs-text). Split out of message-renderer.js
// into its own module (rather than living in either message-renderer.js or
// bubble-updater.js) specifically so BOTH the full-build path
// (message-renderer.js#createMessageNode) and the diff-update path
// (bubble-updater.js#applyTextUpdate) can import the exact same composer —
// message-renderer.js already imports from render-queue.js, which itself
// imports bubble-updater.js, so bubble-updater.js importing straight from
// message-renderer.js would close a circular-import loop. This tiny leaf
// module has no such dependency and is safe for both to import.
//
// "Milestone text" = the always-on "đã đồng hành N tháng" style line for a
// member's registration/renewal events (see MEMBER_MILESTONE_EVENT_TYPES,
// shared/role-style-config.js). YouTube's own event text for these is
// frequently empty (a plain system "member for N months" event has no
// author-written message body at all), so this line is appended
// UNCONDITIONALLY whenever the event qualifies — regardless of whether
// msg.messageHtml itself is empty or not — rather than only filling in for
// the empty case.

import { MEMBER_MILESTONE_EVENT_TYPES, DEFAULT_MEMBER_MILESTONE_TEXT, formatMilestoneText } from '/shared/role-style-config.mjs';

// milestoneText is user-authored (typed into the dashboard's Roles panel),
// unlike msg.messageHtml which originates from YouTube's own already-
// sanitized chat renderer — so, unlike messageHtml above, this DOES need
// escaping before going into innerHTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Returns the full innerHTML for the message slot: the chat text span,
 * plus — when `msg` is a member registration/renewal event with a
 * resolvable months figure and the feature isn't disabled — a second
 * span carrying the resolved milestone text.
 */
export function composeMessageBodyHtml(msg, memberRole) {
  const textSpan = `<span class="ovs-text-content">${msg.messageHtml || ''}</span>`;

  if (!msg.roles?.includes('member')) return textSpan;
  if (!MEMBER_MILESTONE_EVENT_TYPES.has(msg.eventType)) return textSpan;
  if (memberRole?.milestoneTextEnabled === false) return textSpan;

  const months = Number(msg.memberMonths) || 0;
  if (months <= 0) return textSpan;

  const template =
    typeof memberRole?.milestoneText === 'string' && memberRole.milestoneText.trim()
      ? memberRole.milestoneText
      : DEFAULT_MEMBER_MILESTONE_TEXT;
  const text = formatMilestoneText(template, months);
  if (!text) return textSpan;

  const milestoneSpan = `<span class="ovs-milestone-text">${escapeHtml(text)}</span>`;
  return `${textSpan}${milestoneSpan}`;
}
