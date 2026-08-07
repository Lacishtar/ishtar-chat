const { EventEmitter } = require('events');

// Scroll speed is literally "names (rows) per second" — 1 (slow, easier to
// read) to 5 (fast, for long credit rolls near the end of stream). Kept
// generous but finite so the animation duration math never divides by ~0 or
// produces a multi-hour crawl.
const MIN_SCROLL_SPEED = 1;
const MAX_SCROLL_SPEED = 5;
const DEFAULT_SCROLL_SPEED = 2;

function clampScrollSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SCROLL_SPEED;
  return Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, n));
}

/**
 * Every credits section, regardless of source, is normalized to this shape
 * before it reaches IPC/renderer:
 *   { rank, name, avatarUrl, scoreLabel, badge }
 * This is what lets the overlay UI render any section with one generic
 * "rolling list" component — no per-section UI branching required.
 */
function normalizeViewerItem(raw) {
  return {
    rank: raw?.rank ?? null,
    name: raw?.channelName || 'Ẩn danh',
    avatarUrl: raw?.avatarUrl || '',
    scoreLabel: raw?.xp || '',
    badge: raw?.badge || '',
  };
}

// members/superChats/giftMembers items are already built in the target
// { rank, name, avatarUrl, scoreLabel, badge } shape by the time they leave
// the live-tracking maps below, so normalizing them is a no-op passthrough.
function identityItem(raw) {
  return raw;
}

/**
 * Best-effort "how many" extractor for gift-membership announcements, e.g.
 * "đã tặng 5 lượt Hội viên" / "gifted 5 Memberships" -> 5. Falls back to 1
 * (a single gift) when no count can be found in the announcement text —
 * YouTube doesn't always expose the count in a place we can read.
 */
function extractGiftCount(text) {
  if (!text) return 1;
  const match = String(text).match(/\d+/);
  if (!match) return 1;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Best-effort numeric magnitude for ranking Super Chats regardless of
 * currency (₫, $, £, ...) — NOT a currency-accurate conversion, just enough
 * to sort "biggest support first". The original text is still shown as-is
 * in scoreLabel, so display is always accurate even when ranking isn't.
 */
function extractMagnitude(rawText) {
  if (!rawText) return 0;
  const match = String(rawText).match(/[\d.,]+/);
  if (!match) return 0;
  const numeric = match[0];
  const decimalIndex = Math.max(numeric.lastIndexOf(','), numeric.lastIndexOf('.'));
  let normalized = numeric;
  if (decimalIndex !== -1) {
    const intPart = numeric.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fracPart = numeric.slice(decimalIndex + 1).replace(/[.,]/g, '');
    // "50.000" style thousand-separator (3-digit group) vs an actual decimal
    // amount like "12.50" — heuristic, but good enough for sort order.
    normalized = fracPart.length === 3 ? `${intPart}${fracPart}` : `${intPart}.${fracPart}`;
  }
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Section registry — this is the single place to plug in a new Stream
 * Credits section (Members, Super Chats, Gift Members, ...) later.
 *
 * `viewers` scrapes a YouTube popout on demand (see CaptureManager.
 * fetchLeaderboard). `members` / `superChats` / `giftMembers` instead
 * accumulate live from the classified chat message stream (see
 * CreditsManager#recordMessage below) — YouTube has no equivalent popout
 * for those, but every chat message already arrives pre-classified with
 * eventType/superchatAmountUsd/etc. (shared/chat-message.js), so tracking
 * them as they happen is both simpler and more accurate than scraping.
 */
function buildSectionRegistry(captureManager, creditsManager) {
  return {
    viewers: {
      label: 'Top Chatters',
      order: 10,
      fetch: () => captureManager.fetchLeaderboard(),
      normalize: normalizeViewerItem,
    },
    members: {
      label: 'Thành viên mới',
      order: 20,
      fetch: () => Promise.resolve({ ok: true, items: creditsManager.getLiveMembers() }),
      normalize: identityItem,
    },
    superChats: {
      label: 'Super Chat',
      order: 30,
      fetch: () => Promise.resolve({ ok: true, items: creditsManager.getLiveSuperChats() }),
      normalize: identityItem,
    },
    giftMembers: {
      label: 'Tặng hội viên',
      order: 40,
      fetch: () => Promise.resolve({ ok: true, items: creditsManager.getLiveGiftMembers() }),
      normalize: identityItem,
    },
  };
}

class CreditsManager extends EventEmitter {
  constructor(captureManager, options = {}) {
    super();
    this.captureManager = captureManager;
    this.registry = buildSectionRegistry(captureManager, this);
    this.snapshots = {}; // sectionId -> { ok, items, error, updatedAt }

    // Playback speed for the credits roll, in names (rows) per second —
    // read by both the dashboard preview (CreditsPanel.jsx) and the OBS
    // overlay (credits-client.js) to size the scroll animation's duration.
    // 1 = one name every second (slow), 5 = five names every second (fast).
    // Clamped so a bad persisted value (or stray IPC call) can't produce an
    // unusable/instant scroll or a near-frozen one.
    this.scrollSpeed = clampScrollSpeed(options.scrollSpeed ?? DEFAULT_SCROLL_SPEED);

    // Live-accumulated sections — keyed by author so repeat events (e.g. a
    // gifter who buys gift memberships twice in one stream) merge into one
    // row instead of duplicating. Cleared on reset() (new stream connect).
    // NOTE: these Maps/array keep filling in the background for as long as
    // we're connected (see recordMessage below), but that data does NOT
    // automatically flow into `snapshots` / the overlay — no auto-update of
    // any kind (no polling, no per-message refresh, no refresh on
    // disconnect). It only becomes visible when the streamer manually hits
    // "Tải lại" (refreshSection/refreshAll) in the dashboard's Credits tab.
    this._liveMembers = new Map(); // author -> item
    this._liveGiftMembers = new Map(); // author -> item (+ _giftCount)
    this._liveSuperChats = []; // item[] (+ _magnitude, _at), capped
    this._maxSuperChats = 100;

    // Whether the credit roll should be actively scrolling right now.
    // Loading/refreshing data never turns this on by itself — the data
    // shows up and sits still until the streamer explicitly hits "Bắt đầu
    // chạy" in the dashboard. Polled by the overlay client alongside the
    // snapshot data (see /overlay/credits/data), so both the local preview
    // and the real OBS Browser Source obey the same flag.
    this.isPlaying = false;

    this._onMessage = (message) => this.recordMessage(message);
    this.captureManager.on('message', this._onMessage);
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  setIsPlaying(value) {
    this.isPlaying = !!value;
    this.emit('play-state-updated', this.isPlaying);
    return this.isPlaying;
  }

  getScrollSpeed() {
    return this.scrollSpeed;
  }

  setScrollSpeed(value) {
    this.scrollSpeed = clampScrollSpeed(value);
    this.emit('scroll-speed-updated', this.scrollSpeed);
    return this.scrollSpeed;
  }

  // ── Live chat-message tracking (members / superChats / giftMembers) ─────

  /**
   * Called for every classified chat message as it arrives while connected.
   * Purely bookkeeping — accumulates into the in-memory Maps/array below so
   * the data is ready whenever a snapshot is next taken. Does NOT touch
   * `snapshots` itself (no more per-message auto-refresh/broadcast).
   */
  recordMessage(message) {
    if (!message) return;
    if (message.eventType === 'membership_new') {
      this._recordMember(message);
    } else if (message.eventType === 'membership_gift_sent') {
      this._recordGiftMember(message);
    } else if (message.isSuperchat) {
      // Covers both 'superchat' and 'sticker' (Super Stickers are paid too).
      this._recordSuperChat(message);
    }
  }

  _recordMember(message) {
    const author = message.author || 'Ẩn danh';
    if (this._liveMembers.has(author)) return; // one shout-out per member per stream
    this._liveMembers.set(author, {
      rank: null,
      name: author,
      avatarUrl: message.avatarUrl || '',
      scoreLabel: message.membershipTierName || '',
      badge: 'Thành viên mới',
    });
  }

  _recordGiftMember(message) {
    const author = message.author || 'Ẩn danh';
    const giftCount = extractGiftCount(message.messageText);
    const prev = this._liveGiftMembers.get(author);
    if (prev) {
      prev._giftCount += giftCount;
      prev.scoreLabel = `${prev._giftCount} lượt`;
    } else {
      this._liveGiftMembers.set(author, {
        rank: null,
        name: author,
        avatarUrl: message.avatarUrl || '',
        scoreLabel: `${giftCount} lượt`,
        badge: 'Tặng hội viên',
        _giftCount: giftCount,
      });
    }
  }

  _recordSuperChat(message) {
    const amountRaw = message.superchatCurrencyRaw || (message.superchatAmountUsd ? `$${message.superchatAmountUsd}` : '');
    this._liveSuperChats.push({
      rank: null,
      name: message.author || 'Ẩn danh',
      avatarUrl: message.avatarUrl || '',
      scoreLabel: amountRaw,
      badge: message.eventType === 'sticker' ? 'Super Sticker' : '',
      _magnitude: extractMagnitude(amountRaw) || message.superchatAmountUsd || 0,
      _at: message.timestamp || Date.now(),
    });
    // Biggest support first; keep the list bounded so a long stream doesn't
    // grow this unboundedly in memory.
    this._liveSuperChats.sort((a, b) => b._magnitude - a._magnitude || b._at - a._at);
    if (this._liveSuperChats.length > this._maxSuperChats) {
      this._liveSuperChats.length = this._maxSuperChats;
    }
  }

  getLiveMembers() {
    // Newest joins first.
    return Array.from(this._liveMembers.values())
      .reverse()
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  getLiveGiftMembers() {
    return Array.from(this._liveGiftMembers.values())
      .sort((a, b) => b._giftCount - a._giftCount)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  getLiveSuperChats() {
    return this._liveSuperChats.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  /** Section metadata only (id + label), ordered — for building generic UI. */
  listSections() {
    return Object.entries(this.registry)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([id, def]) => ({ id, label: def.label }));
  }

  getSnapshot(sectionId) {
    return this.snapshots[sectionId] || null;
  }

  getAllSnapshots() {
    return { ...this.snapshots };
  }

  async refreshSection(sectionId) {
    const def = this.registry[sectionId];
    if (!def) {
      return { ok: false, error: `Section không tồn tại: ${sectionId}`, items: [] };
    }

    const prev = this.snapshots[sectionId];
    const prevItems = prev && prev.ok ? prev.items : [];

    // A scrape that comes back with far fewer items than we already had is
    // almost always a transient glitch (hidden window got throttled, global
    // timeout cut the virtual-scroll pass short, etc.) — not the leaderboard
    // actually shrinking. Overwriting a good 30-item snapshot with a
    // half-finished 2-item one is what caused data to "randomly disappear"
    // after running a while. Keep the last good snapshot in that case
    // instead, just marking it stale.
    const isSuspiciouslyShort = (newCount) =>
      prevItems.length >= 5 && newCount > 0 && newCount < prevItems.length * 0.5;

    let snapshot;
    try {
      const raw = await def.fetch();
      if (raw?.ok) {
        const newItems = (raw.items || []).map(def.normalize);
        if (isSuspiciouslyShort(newItems.length)) {
          console.warn(
            `[credits-manager] "${sectionId}": scrape mới chỉ có ${newItems.length} items (trước đó ${prevItems.length}) — nghi bị cắt ngắn, giữ lại dữ liệu cũ.`
          );
          snapshot = { ...prev, updatedAt: new Date().toISOString(), stale: true };
        } else {
          snapshot = {
            ok: true,
            items: newItems,
            error: null,
            updatedAt: new Date().toISOString(),
            stale: false,
          };
        }
      } else if (prevItems.length > 0) {
        console.warn(
          `[credits-manager] "${sectionId}": scrape lỗi (${raw?.error || 'unknown'}), giữ lại dữ liệu cũ (${prevItems.length} items).`
        );
        snapshot = { ...prev, updatedAt: new Date().toISOString(), stale: true, error: raw?.error || prev.error || null };
      } else {
        snapshot = {
          ok: false,
          items: [],
          error: raw?.error || 'Không lấy được dữ liệu.',
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      if (prevItems.length > 0) {
        console.warn(`[credits-manager] "${sectionId}": scrape exception (${err.message}), giữ lại dữ liệu cũ.`);
        snapshot = { ...prev, updatedAt: new Date().toISOString(), stale: true, error: err.message };
      } else {
        snapshot = { ok: false, items: [], error: err.message, updatedAt: new Date().toISOString() };
      }
    }

    this.snapshots[sectionId] = snapshot;
    this.emit('snapshot-updated', { sectionId, snapshot });
    return snapshot;
  }

  async refreshAll() {
    const ids = Object.keys(this.registry);
    const entries = await Promise.all(ids.map(async (id) => [id, await this.refreshSection(id)]));
    return Object.fromEntries(entries);
  }

  // ── Manual-only lifecycle ────────────────────────────────────────────────
  // No background polling, no per-message auto-refresh, no auto-refresh on
  // disconnect — Credits data is only ever computed when something
  // explicitly calls refreshSection()/refreshAll(), i.e. the streamer
  // hitting "Tải lại" in the dashboard's Credits tab.

  /** Clear cached data, e.g. when connecting to a fresh stream. */
  reset() {
    this.snapshots = {};
    this._liveMembers.clear();
    this._liveGiftMembers.clear();
    this._liveSuperChats = [];
    this.isPlaying = false;
  }
}

module.exports = { CreditsManager, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED, DEFAULT_SCROLL_SPEED };
