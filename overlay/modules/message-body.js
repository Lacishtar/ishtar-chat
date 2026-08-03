// NOTE: this module used to also append an app-authored "đã đồng hành N
// tháng" milestone-text line (see MEMBER_MILESTONE_EVENT_TYPES history in
// for exactly that "no message" case (e.g. "Chào mừng bạn đến với ... !!"

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// member's regular chat line carries it too), and surfacing "Hội viên
// trong N tháng" there would be showing an unrequested, easily-misread
const MEMBER_MONTHS_EVENT_TYPES = new Set(['membership_new', 'membership_gift_sent', 'membership_milestone']);

// Returns the text for the dedicated member-months line
// "Hội viên trong 12 tháng". Empty string (nothing rendered, CSS handles
export function composeMemberMonthsText(msg) {
  if (!MEMBER_MONTHS_EVENT_TYPES.has(msg.eventType)) return '';
  const months = msg.memberMonths || 0;
  if (!months) return '';
  return `Hội viên trong ${months} tháng`;
}

// Returns the full innerHTML for the message slot: the chat text span,
export function composeMessageBodyHtml(msg, memberRole) {
  const textSpan = `<span class="ovs-text-content">${msg.messageHtml || ''}</span>`;

  const packageNameSpan =
    msg.roles?.includes('member') && memberRole?.packageNameEnabled !== false && msg.membershipTierName
      ? `<span class="ovs-package-name-text">${escapeHtml(msg.membershipTierName)}</span>`
      : '';

  return `${textSpan}${packageNameSpan}`;
}
