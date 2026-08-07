const { EventEmitter } = require('events');
const { CreditsManager } = require('../main/credits-manager');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:credits-live-sections] ${message}`);
}

// Minimal fake CaptureManager: real one extends EventEmitter and exposes
// fetchLeaderboard(); CreditsManager only needs the 'message' event + that
// one method for this test.
class FakeCaptureManager extends EventEmitter {
  fetchLeaderboard() {
    return Promise.resolve({ ok: true, items: [] });
  }
}

async function run() {
  const capture = new FakeCaptureManager();
  const credits = new CreditsManager(capture, {});

  // ── Section registry includes all four ids ──────────────────────────────
  const ids = credits.listSections().map((s) => s.id);
  assert(ids.includes('viewers'), 'viewers section registered');
  assert(ids.includes('members'), 'members section registered');
  assert(ids.includes('superChats'), 'superChats section registered');
  assert(ids.includes('giftMembers'), 'giftMembers section registered');
  // viewers, members, superChats, giftMembers — in that declared order
  assert(
    JSON.stringify(ids) === JSON.stringify(['viewers', 'members', 'superChats', 'giftMembers']),
    `sections ordered viewers < members < superChats < giftMembers, got: ${ids.join(', ')}`
  );

  // ── Membership: new member join ──────────────────────────────────────────
  capture.emit('message', {
    author: 'Alice',
    avatarUrl: 'https://example.com/alice.png',
    eventType: 'membership_new',
    membershipTierName: 'Cấp 1',
    isSuperchat: false,
  });
  // Duplicate join event for the same author should NOT create a second row.
  capture.emit('message', {
    author: 'Alice',
    avatarUrl: 'https://example.com/alice.png',
    eventType: 'membership_new',
    membershipTierName: 'Cấp 1',
    isSuperchat: false,
  });

  // ── Gift memberships: two purchases from the same gifter, should sum ────
  capture.emit('message', {
    author: 'Bob',
    avatarUrl: 'https://example.com/bob.png',
    eventType: 'membership_gift_sent',
    messageText: 'đã tặng 5 lượt Hội viên',
    isSuperchat: false,
  });
  capture.emit('message', {
    author: 'Bob',
    avatarUrl: 'https://example.com/bob.png',
    eventType: 'membership_gift_sent',
    messageText: 'đã tặng 3 lượt Hội viên',
    isSuperchat: false,
  });
  // A gift event with no readable count falls back to 1.
  capture.emit('message', {
    author: 'Cara',
    avatarUrl: '',
    eventType: 'membership_gift_sent',
    messageText: 'đã tặng Hội viên',
    isSuperchat: false,
  });

  // ── Super Chats: ranked by magnitude, largest first ──────────────────────
  capture.emit('message', {
    author: 'Dan',
    avatarUrl: '',
    eventType: 'superchat',
    isSuperchat: true,
    superchatCurrencyRaw: '₫50.000',
    superchatAmountUsd: 0,
  });
  capture.emit('message', {
    author: 'Eve',
    avatarUrl: '',
    eventType: 'superchat',
    isSuperchat: true,
    superchatCurrencyRaw: '₫200.000',
    superchatAmountUsd: 0,
  });
  // Non-superchat/non-membership text messages must be ignored entirely.
  capture.emit('message', {
    author: 'Frank',
    avatarUrl: '',
    eventType: 'text',
    isSuperchat: false,
  });

  // recordMessage() only accumulates into the in-memory Maps/array now — it
  // no longer auto-refreshes `snapshots` per event. Simulate the one-time
  // "end of stream" capture explicitly before asserting.
  await credits.refreshAll();

  const { sections, snapshots } = { sections: credits.listSections(), snapshots: credits.getAllSnapshots() };
  void sections;

  const members = snapshots.members.items;
  assert(members.length === 1, `members has exactly 1 row (dedup by author), got ${members.length}`);
  assert(members[0].name === 'Alice', 'members row is Alice');
  assert(members[0].badge === 'Thành viên mới', 'members row carries the join badge');
  assert(members[0].rank === 1, 'members row ranked');

  const gifts = snapshots.giftMembers.items;
  assert(gifts.length === 2, `giftMembers has 2 rows (Bob, Cara), got ${gifts.length}`);
  const bobRow = gifts.find((g) => g.name === 'Bob');
  const caraRow = gifts.find((g) => g.name === 'Cara');
  assert(bobRow && bobRow.scoreLabel === '8 lượt', `Bob's two gifts summed to 8, got ${bobRow && bobRow.scoreLabel}`);
  assert(caraRow && caraRow.scoreLabel === '1 lượt', `Cara's uncounted gift fell back to 1, got ${caraRow && caraRow.scoreLabel}`);
  assert(gifts[0].name === 'Bob', 'gifts sorted with the bigger gifter (Bob, 8) first');

  const superChats = snapshots.superChats.items;
  assert(superChats.length === 2, `superChats has 2 rows (Dan, Eve), got ${superChats.length}`);
  assert(superChats[0].name === 'Eve', `superChats ranked biggest first (Eve ₫200.000), got ${superChats[0].name}`);
  assert(superChats[0].scoreLabel === '₫200.000', 'superChats scoreLabel shows the original currency text as-is');
  assert(superChats[1].name === 'Dan', 'second-place superchat is Dan (₫50.000)');

  // ── reset() clears every live-tracked section ────────────────────────────
  credits.reset();
  await credits.refreshAll();
  const afterReset = credits.getAllSnapshots();
  assert(afterReset.members.items.length === 0, 'reset() clears members');
  assert(afterReset.giftMembers.items.length === 0, 'reset() clears giftMembers');
  assert(afterReset.superChats.items.length === 0, 'reset() clears superChats');

  console.log('[smoke:credits-live-sections] all assertions passed ✔');
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
