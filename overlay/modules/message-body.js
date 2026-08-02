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
// NOTE: this module used to also append an app-authored "đã đồng hành N
// tháng" milestone-text line (see MEMBER_MILESTONE_EVENT_TYPES history in
// shared/role-style-config.js) for member registration/renewal events with
// no real message body. That was removed: a real-world capture showed
// YouTube's own '#header-subtext' element already carries meaningful copy
// for exactly that "no message" case (e.g. "Chào mừng bạn đến với ... !!"
// for a new member with no header count and no #message text) — so the
// app-fabricated line was redundant, and could show alongside/instead of
// real YouTube copy in misleading ways (e.g. keyed off a person's
// persistent tier badge rather than this specific event). The Package/Tier
// Name line below (sourced from msg.membershipTierName, i.e. that same
// '#header-subtext' element) already covers this case with real content.

// membershipTierName is captured, untrusted text — unlike msg.messageHtml,
// which originates from YouTube's own already-sanitized chat renderer —
// so it DOES need escaping before going into innerHTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// The 3 events Fan Service's "membership" group targets (see
// shared/fan-service-config.js header comment) — deliberately NOT
// membership_gift_received, same exclusion Fan Service itself makes.
// Scoped this narrowly on purpose: msg.memberMonths also reflects a
// viewer's persistent tier badge on completely unrelated messages (any
// member's regular chat line carries it too), and surfacing "Hội viên
// trong N tháng" there would be showing an unrequested, easily-misread
// number on rows that have nothing to do with a membership event. See
// this file's header comment for the prior history of a similar
// always-on line that was removed for exactly that reason.
const MEMBER_MONTHS_EVENT_TYPES = new Set(['membership_new', 'membership_gift_sent', 'membership_milestone']);

/**
 * Returns the text for the dedicated member-months line
 * ([data-slot="member-months"], class .ovs-member-months) — e.g.
 * "Hội viên trong 12 tháng". Empty string (nothing rendered, CSS handles
 * hiding a fully empty div) unless both: the event is one of the 3 Fan
 * Service membership events, and memberMonths parsed to something > 0
 * (membership_new's real-world badge never carries a count — see
 * overlay/modules/theme-loader.js's mock-data comment — so this stays
 * empty there too, which is expected, not a bug).
 */
export function composeMemberMonthsText(msg) {
  if (!MEMBER_MONTHS_EVENT_TYPES.has(msg.eventType)) return '';
  const months = msg.memberMonths || 0;
  if (!months) return '';
  return `Hội viên trong ${months} tháng`;
}

/**
 * Returns the full innerHTML for the message slot: the chat text span,
 * plus — when `msg` is a member event that carried a tier/package name
 * and the feature isn't disabled — a second span showing that name
 * verbatim (real YouTube content, not an app-authored template).
 */
export function composeMessageBodyHtml(msg, memberRole) {
  const textSpan = `<span class="ovs-text-content">${msg.messageHtml || ''}</span>`;

  const packageNameSpan =
    msg.roles?.includes('member') && memberRole?.packageNameEnabled !== false && msg.membershipTierName
      ? `<span class="ovs-package-name-text">${escapeHtml(msg.membershipTierName)}</span>`
      : '';

  return `${textSpan}${packageNameSpan}`;
}
