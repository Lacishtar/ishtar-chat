const { normalizeMessage } = require('../shared/chat-message');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:chat-message] ${message}`);
}

// 1. Standard text message
const textMsg = normalizeMessage({
  author: 'Alice',
  messageHtml: 'Hello chat!',
  messageText: 'Hello chat!',
  badges: [],
});
assert(textMsg.author === 'Alice', 'author normalization');
assert(textMsg.eventType === 'text', 'default eventType is text');
assert(!textMsg.isSuperchat, 'isSuperchat false by default');
assert(textMsg.roles.length === 0, 'no roles for standard user');
assert(textMsg.memberMonths === 0, 'memberMonths 0 by default');

// 2. Super Chat - Tier 4 ($10)
const superchatMsg = normalizeMessage({
  author: 'Bob',
  messageHtml: 'Great stream!',
  messageText: 'Great stream!',
  isSuperchat: true,
  superchatAmountRaw: '$10.00',
  eventType: 'superchat',
});
assert(superchatMsg.eventType === 'superchat', 'eventType superchat');
assert(superchatMsg.isSuperchat === true, 'isSuperchat is true for superchat');
assert(superchatMsg.superchatAmountUsd === 10, 'superchat amount USD parsed');
assert(superchatMsg.superchatCurrencyRaw === '$10.00', 'superchatCurrencyRaw preserved');
assert(superchatMsg.superchatTier === 4, 'superchat tier 4 for $10');
assert(superchatMsg.superchatColor === '#ffca28', 'superchat tier 4 yellow color');

// 3. Superchat Tiers 1-7 calculation tests
const tier1 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$1.50' });
assert(tier1.superchatTier === 1 && tier1.superchatColor === '#1e88e5', 'tier 1 blue');

const tier2 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$2.00' });
assert(tier2.superchatTier === 2 && tier2.superchatColor === '#00e5ff', 'tier 2 cyan');

const tier3 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$5.00' });
assert(tier3.superchatTier === 3 && tier3.superchatColor === '#0f9d58', 'tier 3 green');

const tier5 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$20.00' });
assert(tier5.superchatTier === 5 && tier5.superchatColor === '#f57c00', 'tier 5 orange');

const tier6 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$50.00' });
assert(tier6.superchatTier === 6 && tier6.superchatColor === '#e91e63', 'tier 6 magenta');

const tier7 = normalizeMessage({ isSuperchat: true, superchatAmountRaw: '$100.00' });
assert(tier7.superchatTier === 7 && tier7.superchatColor === '#e53935', 'tier 7 red');

// 4. Super Sticker
const stickerMsg = normalizeMessage({
  author: 'Charlie',
  messageHtml: '<img src="http://example.com/sticker.png" class="ovs-sticker-img" />',
  messageText: '[Super Sticker]',
  isSuperchat: true,
  superchatAmountRaw: '$5.00',
  eventType: 'sticker',
});
assert(stickerMsg.eventType === 'sticker', 'eventType sticker');
assert(stickerMsg.isSuperchat === true, 'isSuperchat is true for sticker');
assert(stickerMsg.superchatAmountUsd === 5, 'superchat amount USD parsed for sticker');
assert(stickerMsg.superchatTier === 3, 'sticker tier 3 for $5');

// 5. New Membership
const newMemberMsg = normalizeMessage({
  author: 'Dave',
  messageHtml: 'Welcome to Member!',
  messageText: 'Welcome to Member!',
  badges: ['Member'],
  eventType: 'membership_new',
});
assert(newMemberMsg.eventType === 'membership_new', 'eventType membership_new');
assert(newMemberMsg.roles.includes('member'), 'role includes member');

// 6. Gift Membership (legacy combined event — kept for backward compatibility
// with older/already-persisted captures; capture-preload.js no longer emits it)
const giftMsg = normalizeMessage({
  author: 'Eve',
  messageHtml: 'Gifted 5 channel memberships to the community',
  messageText: 'Gifted 5 channel memberships to the community',
  badges: ['Member'],
  eventType: 'membership_gift',
});
assert(giftMsg.eventType === 'membership_gift', 'eventType membership_gift (legacy, backward compat)');
assert(giftMsg.roles.includes('member'), 'gift assigned member role');

// 6a. Gift Membership Sent — the gifter purchasing memberships
const giftSentMsg = normalizeMessage({
  author: 'Eve',
  messageHtml: 'Gifted 5 channel memberships to the community',
  messageText: 'Gifted 5 channel memberships to the community',
  badges: ['Member'],
  eventType: 'membership_gift_sent',
});
assert(giftSentMsg.eventType === 'membership_gift_sent', 'eventType membership_gift_sent');
assert(giftSentMsg.roles.includes('member'), 'gift sent assigned member role');

// 6b. Gift Membership Received — a viewer redeeming a gifted membership
const giftReceivedMsg = normalizeMessage({
  author: 'Frankie',
  messageHtml: 'Was gifted a membership by Eve',
  messageText: 'Was gifted a membership by Eve',
  badges: ['Member'],
  eventType: 'membership_gift_received',
});
assert(giftReceivedMsg.eventType === 'membership_gift_received', 'eventType membership_gift_received');
assert(giftReceivedMsg.roles.includes('member'), 'gift received assigned member role');

// 7. Member Milestone Chat — "Member for 12 months"
const milestone1 = normalizeMessage({
  author: 'Frank',
  messageHtml: 'Happy 1 year!',
  messageText: 'Happy 1 year!',
  badges: ['Member for 12 months'],
  eventType: 'membership_milestone',
});
assert(milestone1.eventType === 'membership_milestone', 'eventType membership_milestone');
assert(milestone1.roles.includes('member'), 'milestone includes member role');
assert(milestone1.memberMonths === 12, 'parsed 12 memberMonths from "Member for 12 months"');

// 8. Member Milestone Chat — "Member (6 months)"
const milestone2 = normalizeMessage({
  author: 'Grace',
  messageHtml: '6 months milestone',
  messageText: '6 months milestone',
  badges: ['Member (6 months)'],
  eventType: 'membership_milestone',
});
assert(milestone2.memberMonths === 6, 'parsed 6 memberMonths from "Member (6 months)"');

// 9. Member Milestone Chat — Vietnamese "Thành viên 6 tháng" & "Hội viên (1 năm)"
const milestoneVi1 = normalizeMessage({
  author: 'Hoa',
  messageHtml: 'Chuc mung 6 thang',
  messageText: 'Chuc mung 6 thang',
  badges: ['Thành viên 6 tháng'],
});
assert(milestoneVi1.memberMonths === 6, 'parsed 6 memberMonths from "Thành viên 6 tháng"');

const milestoneVi2 = normalizeMessage({
  author: 'Hung',
  messageHtml: 'Chuc mung 1 nam',
  messageText: 'Chuc mung 1 nam',
  badges: ['Hội viên (1 năm)'],
});
assert(milestoneVi2.memberMonths === 12, 'parsed 12 memberMonths from "Hội viên (1 năm)"');

console.log('[smoke:chat-message] all checks passed');
