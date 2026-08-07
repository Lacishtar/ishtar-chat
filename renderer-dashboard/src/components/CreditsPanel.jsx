import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/ipc.js';
import { useEditorState } from '../state/EditorStateContext.jsx';

// Small inline icon set for this panel — same convention as
// Customize/shared/icons.jsx (20x20 viewBox, stroke=currentColor) so Credits
// visually matches the rest of the dashboard instead of using emoji.
function CreditsIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="6" y1="7.8" x2="14" y2="7.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="10.5" x2="12" y2="10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="13.2" x2="10" y2="13.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M3 5.6C3 4.4 4 3.5 5.2 3.5H14.8C16 3.5 17 4.4 17 5.6V11.4C17 12.6 16 13.5 14.8 13.5H8.2L4.6 16.3V13.4C3.7 13.2 3 12.4 3 11.4V5.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M16.2 10a6.2 6.2 0 11-1.8-4.36" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.2 3.4V7.6H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M6 4.3L15.6 10L6 15.7V4.3Z" />
    </svg>
  );
}

function StopIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function PaletteIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M10 3.3a6.7 6.7 0 100 13.4c.9 0 1.5-.7 1.5-1.5 0-.4-.15-.75-.4-1.02-.24-.27-.4-.6-.4-.98 0-.8.65-1.4 1.45-1.4H13.6c1.6 0 2.9-1.3 2.9-2.9 0-3.1-2.9-5.6-6.5-5.6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="6.6" cy="8.6" r="1" fill="currentColor" />
      <circle cx="9.6" cy="6.4" r="1" fill="currentColor" />
      <circle cx="7.2" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function GaugeIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M3.3 13.8a6.7 6.7 0 1113.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="13.8" x2="13.2" y2="9.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function EditIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M12.6 3.9L16.1 7.4L6.9 16.6L3 17.5L3.9 13.6L12.6 3.9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4.5 10.2L8 13.7L15.5 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Optional per-section icon; sections without an entry just fall back to
// CreditsIcon. Purely cosmetic — safe to leave a new section id out of this
// map.
const SECTION_ICONS = {
  viewers: ChatIcon,
};

const SPEED_MIN = 1;
const SPEED_MAX = 5;
const SPEED_PRESETS = [1, 2, 3, 4, 5];
const SECTION_LABEL_MAX_LENGTH = 40;

// Click-to-rename section title (e.g. turn "Top Chatters" into anything the
// streamer wants). Purely a small local edit buffer + commit-on-blur/Enter —
// the actual persistence round-trip happens in onLabelChange (see
// CreditsPanel.handleSectionLabelChange), which is also what keeps this in
// sync if a value comes back sanitized/trimmed differently than typed.
function EditableSectionTitle({ section, onLabelChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(section.label);
  }, [section.label, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === section.label) {
      setDraft(section.label);
      return;
    }
    onLabelChange(section.id, trimmed);
  }

  function cancel() {
    setDraft(section.label);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={SECTION_LABEL_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        className="min-w-0 flex-1 text-xs font-bold text-ink tracking-wide uppercase bg-panel border border-focusAccent/50 rounded px-1.5 py-0.5 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Đổi tên mục này (vd: đổi 'Top Chatters' thành chữ khác)"
      className="flex items-center gap-1.5 min-w-0 text-left group"
    >
      <h3 className="text-xs font-bold text-ink tracking-wide uppercase truncate">{section.label}</h3>
      <EditIcon className="w-3 h-3 text-inkMuted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// One section's rolling list. Fully generic over item shape — every section
// (present or future) normalizes its items to { rank, name, avatarUrl,
// scoreLabel, badge } in main/credits-manager.js, so this component never
// needs to know where the data actually came from. Every section — Top
// Chatters included — renders one person per row (mirrors
// overlay/credits-client.js); Top Chatters just hides the score column.
function SectionCredits({ section, snapshot, scrollSpeed, isPlaying, onLabelChange }) {
  const items = snapshot?.items || [];
  const isViewers = section.id === 'viewers';
  const SectionIcon = SECTION_ICONS[section.id] || CreditsIcon;
  // scrollSpeed is names (rows) per second, so the whole list should take
  // items.length / scrollSpeed seconds to cross once — same math the OBS
  // overlay uses, so this preview always matches what viewers actually see.
  const durationSec = Math.max(1, items.length / (scrollSpeed || 1));

  return (
    <div className="rounded-xl bg-panelAlt/40 border border-line p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SectionIcon className="w-4 h-4 text-focusAccent shrink-0" />
          <EditableSectionTitle section={section} onLabelChange={onLabelChange} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-inkMuted shrink-0">
          {snapshot?.updatedAt && (
            <span className="hidden sm:inline">{new Date(snapshot.updatedAt).toLocaleTimeString('vi-VN')}</span>
          )}
        </div>
      </div>

      {!snapshot && (
        <div className="py-6 text-center text-[11px] text-inkMuted border border-dashed border-line rounded-lg">
          Chưa có dữ liệu — hệ thống sẽ tự thu thập trong lúc live, hoặc bấm "Tải dữ liệu" ở trên để quét ngay.
        </div>
      )}

      {snapshot && !snapshot.ok && (
        <div className="py-4 px-3 text-[11px] text-live bg-live/10 border border-live/30 rounded-lg">
          {snapshot.error || 'Không lấy được dữ liệu.'}
        </div>
      )}

      {snapshot?.ok && items.length === 0 && (
        <div className="py-6 text-center text-[11px] text-inkMuted border border-dashed border-line rounded-lg">
          Chưa có dữ liệu cho mục này.
        </div>
      )}

      {snapshot?.ok && items.length > 0 && (
        <div
          className="relative h-56 overflow-hidden rounded-lg border border-line bg-gradient-to-b from-panel/60 to-panelAlt"
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)' }}
        >
          {/* Items are duplicated once so translateY(-50%) loops seamlessly —
              standard trick for an infinite marquee/rolling-credits effect.
              The animation class/duration is only applied while isPlaying —
              loaded-but-not-started data just sits still at the top. */}
          <div
            className={isPlaying ? 'ovs-credits-scroll flex flex-col gap-2 px-3 py-3' : 'flex flex-col gap-2 px-3 py-3'}
            style={isPlaying ? { animationDuration: `${durationSec}s` } : undefined}
          >
            {[...items, ...items].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 py-1">
                <span className="w-7 text-right text-[11px] font-mono font-bold text-inkMuted shrink-0">
                  {item.rank ? `#${item.rank}` : '—'}
                </span>
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt={item.name}
                    className="w-7 h-7 rounded-full object-cover border border-line shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-focusAccent/20 text-focusAccent flex items-center justify-center text-[11px] font-bold shrink-0">
                    {(item.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink truncate">{item.name}</div>
                  {item.badge && <div className="text-[9px] text-inkMuted truncate">{item.badge}</div>}
                </div>
                {!isViewers && item.scoreLabel && (
                  <span className="text-[11px] font-mono text-focusAccent font-medium shrink-0">{item.scoreLabel}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Scroll-speed control — a slider (1-5 names/giây) plus quick-pick preset
// chips. Updates local state immediately for a responsive drag, then
// debounces the actual IPC write so dragging the slider doesn't spam
// main/credits-manager.
function ScrollSpeedControl({ value, onChange }) {
  const debounceRef = useRef(null);

  function commit(next) {
    onChange(next); // optimistic local update, drives the live preview instantly
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.setCreditsScrollSpeed(next).catch((err) => console.error('[credits-ui] setCreditsScrollSpeed failed:', err));
    }, 250);
  }

  return (
    <div className="rounded-xl bg-panelAlt/40 border border-line p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GaugeIcon className="w-4 h-4 text-focusAccent shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-ink tracking-wide uppercase">Tốc độ cuộn</h3>
            <p className="text-[10px] text-inkMuted">Áp dụng cho cả bản xem trước lẫn overlay OBS</p>
          </div>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-focusAccent/10 border border-focusAccent/30 text-focusAccent text-xs font-mono font-bold">
          {value} tên/giây
        </span>
      </div>

      <input
        type="range"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={1}
        value={value}
        onChange={(e) => commit(parseInt(e.target.value, 10))}
        className="w-full accent-focusAccent"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => commit(preset)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
              value === preset
                ? 'bg-focusAccent/15 border-focusAccent/50 text-focusAccent'
                : 'bg-panel border-line text-inkMuted hover:border-focusAccent/40 hover:text-ink'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

// Short Vietnamese labels for each preset's `layout` (see
// shared/credits-theme-presets.js) — shown as a small chip next to the
// preset name so it's clear a theme isn't just a recolor, it can genuinely
// rearrange the crawl (one column vs 2-col grid vs vertical cards).
const LAYOUT_LABELS = {
  classic: 'Danh sách',
  grid: 'Lưới 2 cột',
  stacked: 'Thẻ dọc',
};

// Theme-preset picker — a row of swatch chips (color dots + name), one per
// built-in Credits preset (see shared/credits-theme-presets.js). Selecting
// one calls api.setCreditsTheme(id); the live preview iframe and the real
// OBS Browser Source both pick it up on their next /overlay/credits/data
// poll (same "not instant, but within ~3s" tradeoff as everything else on
// this panel except play/pause — a preset swap isn't the kind of action
// that needs to feel immediate).
function ThemePresetControl({ themes, value, onChange, loading }) {
  return (
    <div className="rounded-xl bg-panelAlt/40 border border-line p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PaletteIcon className="w-4 h-4 text-focusAccent shrink-0" />
        <div>
          <h3 className="text-xs font-bold text-ink tracking-wide uppercase">Giao diện</h3>
          <p className="text-[10px] text-inkMuted">Màu sắc &amp; font (Google Fonts miễn phí) cho cảnh Credits</p>
        </div>
      </div>

      {loading && themes.length === 0 && (
        <div className="text-[11px] text-inkMuted">Đang tải danh sách giao diện…</div>
      )}

      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => {
          const active = theme.id === value;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              title={theme.description || theme.name}
              className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                active
                  ? 'bg-focusAccent/15 border-focusAccent/50 text-ink'
                  : 'bg-panel border-line text-inkMuted hover:border-focusAccent/40 hover:text-ink'
              }`}
            >
              <span className="flex -space-x-1 shrink-0">
                {(theme.swatch || []).slice(0, 3).map((color, idx) => (
                  <span
                    key={idx}
                    className="w-3.5 h-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: color, zIndex: 3 - idx }}
                  />
                ))}
              </span>
              {theme.name}
              {theme.layout && LAYOUT_LABELS[theme.layout] && (
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                    active ? 'bg-focusAccent/20 text-focusAccent' : 'bg-panelAlt text-inkMuted'
                  }`}
                >
                  {LAYOUT_LABELS[theme.layout]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// CreditsPanel — full "Bố cục"-style tab section for Stream Credits (Top
// Chatters). Same data/behaviour as the old CreditsOverlayModal, just laid
// out inline in the tab body instead of a popup dialog.
export default function CreditsPanel() {
  const { overlayUrl } = useEditorState();
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [themes, setThemes] = useState([]);
  const [themeId, setThemeId] = useState('default');
  const previewFrameRef = useRef(null);

  // /overlay -> /overlay/credits — same host/port as the chat overlay, just
  // a different Express route (see main/server/http-server.js).
  const creditsUrl = overlayUrl ? overlayUrl.replace(/\/overlay\/?$/, '/overlay/credits') : '';

  async function handleCopyUrl() {
    if (!creditsUrl) return;
    try {
      await navigator.clipboard.writeText(creditsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('[credits-ui] copy URL failed:', err);
    }
  }

  // Initial fetch on mount: section list + whatever's already cached (if
  // anything) + the persisted scroll speed/play state. This intentionally
  // does NOT trigger a scan — it's just reading what's already there.
  async function fetchCached() {
    setLoading(true);
    try {
      const res = await api.getAllCredits();
      setSections(res?.sections || []);
      setSnapshots(res?.snapshots || {});
      if (typeof res?.scrollSpeed === 'number') setScrollSpeed(res.scrollSpeed);
      setIsPlaying(!!res?.isPlaying);
      if (typeof res?.themeId === 'string') setThemeId(res.themeId);
    } catch (err) {
      console.error('[credits-ui] getAllCredits failed:', err);
    } finally {
      setLoading(false);
    }
  }

  // Preset list is static per app session — fetched once, separately from
  // fetchCached's data/prefs refresh.
  useEffect(() => {
    api.listCreditsThemes()
      .then((list) => setThemes(list || []))
      .catch((err) => console.error('[credits-ui] listCreditsThemes failed:', err));
  }, []);

  async function handleThemeChange(nextThemeId) {
    setThemeId(nextThemeId); // optimistic — swatch highlight responds instantly
    try {
      await api.setCreditsTheme(nextThemeId);
    } catch (err) {
      console.error('[credits-ui] setCreditsTheme failed:', err);
    }
  }

  // Renames a section's on-screen title (e.g. "Top Chatters" -> anything
  // else) — applied optimistically so the card header updates instantly,
  // then reconciled with whatever the main process actually persisted
  // (trimmed/length-capped — see CreditsManager.setSectionLabel) in case it
  // differs from what was typed.
  async function handleSectionLabelChange(sectionId, label) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, label } : s)));
    try {
      const applied = await api.setCreditsSectionLabel(sectionId, label);
      if (typeof applied === 'string' && applied) {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, label: applied } : s)));
      }
    } catch (err) {
      console.error('[credits-ui] setCreditsSectionLabel failed:', err);
    }
  }

  // Sends an instant play/pause command straight into the preview iframe
  // (same trick a lot of embedded-player controls use) — see the
  // 'ovs-credits-control' message listener in overlay/credits-client.js.
  // The real OBS Browser Source can't receive this (it's a separate
  // window), so it picks up the same state from its next data poll instead.
  function postToPreview(type) {
    try {
      previewFrameRef.current?.contentWindow?.postMessage({ source: 'ovs-credits-control', type }, '*');
    } catch (err) {
      console.error('[credits-ui] postMessage to preview failed:', err);
    }
  }

  // "Tải dữ liệu" — scans every section fresh (credits:refresh-all ->
  // CreditsManager#refreshAll) and stores the result. Data always lands
  // static: any run that was mid-scroll gets paused too, so a reload never
  // leaves the roll animating over data that just changed.
  async function handleLoadData() {
    setLoading(true);
    try {
      const newSnapshots = await api.refreshAllCredits();
      setSnapshots(newSnapshots || {});
      await api.setCreditsPlaying(false);
      setIsPlaying(false);
      postToPreview('pause');
    } catch (err) {
      console.error('[credits-ui] refreshAllCredits failed:', err);
    } finally {
      setLoading(false);
    }
  }

  // "Bắt đầu chạy" — starts the credit roll from the top. Applies to both
  // this local preview (instantly, via postMessage) and the real OBS
  // overlay (within its next ~3s poll — see POLL_INTERVAL_MS in
  // overlay/credits-client.js).
  async function handleStart() {
    setIsPlaying(true);
    postToPreview('play');
    try {
      await api.setCreditsPlaying(true);
    } catch (err) {
      console.error('[credits-ui] setCreditsPlaying failed:', err);
    }
  }

  // Lets the streamer freeze the roll again without touching the data.
  async function handleStop() {
    setIsPlaying(false);
    postToPreview('pause');
    try {
      await api.setCreditsPlaying(false);
    } catch (err) {
      console.error('[credits-ui] setCreditsPlaying failed:', err);
    }
  }

  const hasData = sections.some((s) => snapshots[s.id]?.ok && (snapshots[s.id].items || []).length > 0);

  const handleScrollSpeedChange = useCallback((next) => setScrollSpeed(next), []);

  useEffect(() => {
    fetchCached();
  }, []);

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-focusAccent/10 border border-focusAccent/20 flex items-center justify-center text-focusAccent">
            <CreditsIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Credits</h2>
            <p className="text-xs text-inkMuted">Vinh danh khán giả nổi bật — cuộn kiểu credit cuối phim</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadData}
            disabled={loading}
            title="Quét lại dữ liệu tất cả các mục"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panelAlt border border-line hover:border-focusAccent/50 text-ink text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Tải dữ liệu
          </button>
          {isPlaying ? (
            <button
              type="button"
              onClick={handleStop}
              title="Dừng credit, giữ nguyên dữ liệu"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-live/10 border border-live/30 hover:bg-live/20 hover:border-live/60 text-live text-xs font-semibold transition-colors"
            >
              <StopIcon className="w-3 h-3" />
              Dừng
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={!hasData}
              title={hasData ? 'Chạy credit từ đầu' : 'Cần tải dữ liệu trước'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-focusAccent/10 border border-focusAccent/30 hover:bg-focusAccent/20 hover:border-focusAccent/60 text-focusAccent text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-focusAccent/10 disabled:hover:border-focusAccent/30"
            >
              <PlayIcon className="w-3.5 h-3.5" />
              Bắt đầu chạy
            </button>
          )}
        </div>
      </div>

      {/* OBS Browser Source URL + live preview, side by side on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
        <div className="rounded-xl bg-panelAlt/40 border border-line p-3.5 flex flex-col gap-3">
          <span className="text-[10px] uppercase tracking-wide text-inkMuted">OBS Browser Source</span>
          {creditsUrl && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={creditsUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 rounded-lg bg-panel border border-line px-3 py-1.5 text-xs font-mono text-inkMuted"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-focusAccent/10 border border-focusAccent/30 hover:bg-focusAccent/20 hover:border-focusAccent/60 text-focusAccent text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                {copied && <CheckIcon className="w-3.5 h-3.5" />}
                {copied ? 'Đã copy' : 'Copy URL'}
              </button>
            </div>
          )}
          <p className="text-[11px] text-inkMuted">
            Dữ liệu được thu thập ngầm trong lúc kết nối live — không cần thao tác gì thêm.
          </p>
        </div>

        <ScrollSpeedControl value={scrollSpeed} onChange={handleScrollSpeedChange} />
      </div>

      <ThemePresetControl themes={themes} value={themeId} onChange={handleThemeChange} loading={loading} />

      {/* Live OBS preview — actual /overlay/credits page in an iframe, so you can verify it renders before adding it to OBS. Kept a bit taller than a typical thumbnail preview so the rolling rows are actually readable at a glance. */}
      {creditsUrl && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-inkMuted">Xem trước (giống hệt OBS)</span>
          </div>
          <div className="ovs-checkerboard h-64 rounded-xl border border-line overflow-hidden">
            <iframe
              ref={previewFrameRef}
              src={creditsUrl}
              title="Stream Credits OBS preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}

      {/* Sections — auto-fit so a single section (the common case today)
          still reads as one comfortably-sized card instead of stretching
          edge-to-edge, but extra sections added later tile in cleanly. */}
      {loading && sections.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-10 h-10 border-3 border-focusAccent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-ink">Đang tải dữ liệu Credits…</p>
        </div>
      )}

      {!loading && sections.length === 0 && (
        <div className="py-12 text-center text-inkMuted text-xs">
          Chưa có section Credits nào được cấu hình.
        </div>
      )}

      {sections.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {sections.map((section) => (
            <SectionCredits
              key={section.id}
              section={section}
              snapshot={snapshots[section.id]}
              scrollSpeed={scrollSpeed}
              isPlaying={isPlaying}
              onLabelChange={handleSectionLabelChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
