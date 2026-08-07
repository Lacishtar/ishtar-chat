const { EventEmitter } = require('events');
const { DEFAULT_CREDITS_THEME_ID, getCreditsThemeById, listCreditsThemes } = require('../shared/credits-theme-presets');

// Scroll speed is literally "names (rows) per second" — 1 (slow, easier to
// read) to 5 (fast, for long credit rolls near the end of stream). Kept
// generous but finite so the animation duration math never divides by ~0 or
// produces a multi-hour crawl.
const MIN_SCROLL_SPEED = 1;
const MAX_SCROLL_SPEED = 5;
const DEFAULT_SCROLL_SPEED = 2;

// Custom section-title length cap — this text renders as the big uppercase
// header inside the Credits crawl (see .ovs-credits-title in
// overlay/credits.html), so an unbounded string could wrap/overflow the
// overlay. 40 chars is generous for something like "TOP CHATTERS" or
// "NGƯỜI HÂM MỘ SỐ 1" while still fitting comfortably on one line.
const MAX_SECTION_LABEL_LENGTH = 40;

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

/**
 * Section registry — this is the single place to plug in a new Stream
 * Credits section later.
 *
 * `viewers` scrapes a YouTube popout on demand (see CaptureManager.
 * fetchLeaderboard).
 */
function buildSectionRegistry(captureManager) {
  return {
    viewers: {
      label: 'Top Chatters',
      order: 10,
      fetch: () => captureManager.fetchLeaderboard(),
      normalize: normalizeViewerItem,
    },
  };
}

class CreditsManager extends EventEmitter {
  constructor(captureManager, options = {}) {
    super();
    this.captureManager = captureManager;
    this.registry = buildSectionRegistry(captureManager);
    this.snapshots = {}; // sectionId -> { ok, items, error, updatedAt }

    // Per-section custom titles (e.g. renaming "Top Chatters" to something
    // else) — keyed by section id, only holding entries that actually
    // override the registry's built-in `label`. Empty/whitespace-only
    // values are never stored (see setSectionLabel): absence of a key here
    // just means "use the registry default", so a bad/old persisted file
    // degrades gracefully instead of showing a blank title.
    this.labelOverrides =
      options.labels && typeof options.labels === 'object' ? { ...options.labels } : {};

    // Playback speed for the credits roll, in names (rows) per second —
    // read by both the dashboard preview (CreditsPanel.jsx) and the OBS
    // overlay (credits-client.js) to size the scroll animation's duration.
    // 1 = one name every second (slow), 5 = five names every second (fast).
    // Clamped so a bad persisted value (or stray IPC call) can't produce an
    // unusable/instant scroll or a near-frozen one.
    this.scrollSpeed = clampScrollSpeed(options.scrollSpeed ?? DEFAULT_SCROLL_SPEED);

    // Whether the credit roll should be actively scrolling right now.
    // Loading/refreshing data never turns this on by itself — the data
    // shows up and sits still until the streamer explicitly hits "Bắt đầu
    // chạy" in the dashboard. Polled by the overlay client alongside the
    // snapshot data (see /overlay/credits/data), so both the local preview
    // and the real OBS Browser Source obey the same flag.
    this.isPlaying = false;

    // Which built-in preset (colors/fonts) the Credits overlay renders with.
    // Purely presentational — never affects data fetching/normalization
    // above. Falls back to the default preset if a persisted id no longer
    // matches anything in the library (e.g. after a preset was renamed).
    this.themeId = getCreditsThemeById(options.themeId) ? options.themeId : DEFAULT_CREDITS_THEME_ID;
  }

  listThemes() {
    return listCreditsThemes();
  }

  getThemeId() {
    return this.themeId;
  }

  getTheme() {
    return getCreditsThemeById(this.themeId) || getCreditsThemeById(DEFAULT_CREDITS_THEME_ID);
  }

  setThemeId(value) {
    this.themeId = getCreditsThemeById(value) ? value : this.themeId;
    this.emit('theme-updated', this.themeId);
    return this.themeId;
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

  /** Section metadata only (id + label), ordered — for building generic UI. `label` already reflects any custom override (see setSectionLabel). */
  listSections() {
    return Object.entries(this.registry)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([id, def]) => ({ id, label: this.getSectionLabel(id) }));
  }

  /** The label a section should render with right now: the streamer's custom title if one is set, otherwise the registry's built-in default. Returns null for an unknown section id. */
  getSectionLabel(sectionId) {
    const def = this.registry[sectionId];
    if (!def) return null;
    const override = this.labelOverrides[sectionId];
    return typeof override === 'string' && override.trim() ? override : def.label;
  }

  /**
   * Sets (or clears, with an empty/whitespace string) a section's custom
   * title — this is what lets e.g. "Top Chatters" become anything the
   * streamer wants. Returns the resulting label so callers can apply it
   * optimistically without a round-trip.
   */
  setSectionLabel(sectionId, value) {
    if (!this.registry[sectionId]) return this.getSectionLabel(sectionId);
    const trimmed = typeof value === 'string' ? value.trim().slice(0, MAX_SECTION_LABEL_LENGTH) : '';
    if (trimmed) {
      this.labelOverrides[sectionId] = trimmed;
    } else {
      delete this.labelOverrides[sectionId];
    }
    const resolved = this.getSectionLabel(sectionId);
    this.emit('label-updated', { sectionId, label: resolved });
    return resolved;
  }

  /** All current custom-title overrides, for persistence — see main/index.js's credits-labels.json. */
  getLabelOverrides() {
    return { ...this.labelOverrides };
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
  // No background polling, no auto-refresh on disconnect — Credits data is
  // only ever computed when something explicitly calls
  // refreshSection()/refreshAll(), i.e. the streamer hitting "Tải lại" in
  // the dashboard's Credits tab.

  /** Clear cached data, e.g. when connecting to a fresh stream. */
  reset() {
    this.snapshots = {};
    this.isPlaying = false;
  }
}

module.exports = { CreditsManager, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED, DEFAULT_SCROLL_SPEED };
