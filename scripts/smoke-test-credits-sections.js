const { EventEmitter } = require('events');
const { CreditsManager } = require('../main/credits-manager');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:credits-sections] ${message}`);
}

// Minimal fake CaptureManager: real one extends EventEmitter and exposes
// fetchLeaderboard(); CreditsManager only needs that one method now.
class FakeCaptureManager extends EventEmitter {
  fetchLeaderboard() {
    return Promise.resolve({
      ok: true,
      items: [
        { rank: 1, channelName: 'Alice', avatarUrl: '', xp: '100 XP', badge: '' },
        { rank: 2, channelName: 'Bob', avatarUrl: '', xp: '80 XP', badge: '' },
      ],
    });
  }
}

async function run() {
  const capture = new FakeCaptureManager();
  const credits = new CreditsManager(capture, {});

  // ── Section registry only exposes Top Chatters ("viewers") ──────────────
  const ids = credits.listSections().map((s) => s.id);
  assert(ids.length === 1, `only one credits section registered, got: ${ids.join(', ')}`);
  assert(ids[0] === 'viewers', 'the only registered section is "viewers"');
  assert(!('members' in credits.registry), 'no "members" (new member) section');
  assert(!('giftMembers' in credits.registry), 'no "giftMembers" (gift member) section');
  assert(!('superChats' in credits.registry), 'no "superChats" (Super Chat) section');

  // ── Membership/gift/superchat chat events are simply ignored ────────────
  // CreditsManager no longer listens to captureManager 'message' events at
  // all — emitting one here must not throw and must not create any new
  // section/data.
  capture.emit('message', {
    author: 'Alice',
    eventType: 'membership_new',
    membershipTierName: 'Cấp 1',
    isSuperchat: false,
  });
  capture.emit('message', {
    author: 'Bob',
    eventType: 'membership_gift_sent',
    messageText: 'đã tặng 5 lượt Hội viên',
    isSuperchat: false,
  });
  capture.emit('message', {
    author: 'Dan',
    eventType: 'superchat',
    isSuperchat: true,
    superchatCurrencyRaw: '₫50.000',
  });

  const snapshotsBeforeRefresh = credits.getAllSnapshots();
  assert(Object.keys(snapshotsBeforeRefresh).length === 0, 'no snapshot exists before an explicit refresh');

  // ── refreshAll() only ever populates the "viewers" snapshot ─────────────
  const snapshots = await credits.refreshAll();
  assert(Object.keys(snapshots).length === 1, 'refreshAll() only returns the "viewers" snapshot');
  assert(snapshots.viewers.ok, 'viewers snapshot ok');
  assert(snapshots.viewers.items.length === 2, `viewers has 2 rows, got ${snapshots.viewers.items.length}`);
  assert(snapshots.viewers.items[0].name === 'Alice', 'first row is Alice');

  console.log('[smoke:credits-sections] all assertions passed ✔');
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
