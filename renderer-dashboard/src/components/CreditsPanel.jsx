import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/ipc.js';
import { useEditorState } from '../state/EditorStateContext.jsx';

// Optional per-section icon; sections without an entry just fall back to 🎬.
// Purely cosmetic — safe to leave a new section id out of this map.
const SECTION_ICONS = {
  viewers: '💬',
  members: '⭐',
  superChats: '💎',
  giftMembers: '🎁',
};

const SPEED_MIN = 1;
const SPEED_MAX = 5;
const SPEED_PRESETS = [1, 2, 3, 4, 5];

// One section's rolling list. Fully generic over item shape — every section
// (present or future) normalizes its items to { rank, name, avatarUrl,
// scoreLabel, badge } in main/credits-manager.js, so this component never
// needs to know where the data actually came from. Every section — Top
// Chatters included — renders one person per row (mirrors
// overlay/credits-client.js); Top Chatters just hides the score column.
function SectionCredits({ section, snapshot, scrollSpeed, isPlaying }) {
  const items = snapshot?.items || [];
  const isViewers = section.id === 'viewers';
  // scrollSpeed is names (rows) per second, so the whole list should take
  // items.length / scrollSpeed seconds to cross once — same math the OBS
  // overlay uses, so this preview always matches what viewers actually see.
  const durationSec = Math.max(1, items.length / (scrollSpeed || 1));

  return (
    <div className="rounded-xl bg-panelAlt/40 border border-line p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{SECTION_ICONS[section.id] || '🎬'}</span>
          <h3 className="text-xs font-bold text-ink tracking-wide uppercase truncate">{section.label}</h3>
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
          <span className="text-base">⚡</span>
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
    } catch (err) {
      console.error('[credits-ui] getAllCredits failed:', err);
    } finally {
      setLoading(false);
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
            🎬
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
            <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
            Tải dữ liệu
          </button>
          {isPlaying ? (
            <button
              type="button"
              onClick={handleStop}
              title="Dừng credit, giữ nguyên dữ liệu"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-live/10 border border-live/30 hover:bg-live/20 hover:border-live/60 text-live text-xs font-semibold transition-colors"
            >
              ■ Dừng
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={!hasData}
              title={hasData ? 'Chạy credit từ đầu' : 'Cần tải dữ liệu trước'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-focusAccent/10 border border-focusAccent/30 hover:bg-focusAccent/20 hover:border-focusAccent/60 text-focusAccent text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-focusAccent/10 disabled:hover:border-focusAccent/30"
            >
              ▶ Bắt đầu chạy
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
                className="shrink-0 rounded-lg bg-focusAccent/10 border border-focusAccent/30 hover:bg-focusAccent/20 hover:border-focusAccent/60 text-focusAccent text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                {copied ? 'Đã copy ✓' : 'Copy URL'}
              </button>
            </div>
          )}
          <p className="text-[11px] text-inkMuted">
            Dữ liệu được thu thập ngầm trong lúc kết nối live — không cần thao tác gì thêm.
          </p>
        </div>

        <ScrollSpeedControl value={scrollSpeed} onChange={handleScrollSpeedChange} />
      </div>

      {/* Live OBS preview — actual /overlay/credits page in an iframe, so you can verify it renders before adding it to OBS */}
      {creditsUrl && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-inkMuted">Xem trước (giống hệt OBS)</span>
          </div>
          <div className="ovs-checkerboard h-40 rounded-xl border border-line overflow-hidden">
            <iframe
              ref={previewFrameRef}
              src={creditsUrl}
              title="Stream Credits OBS preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}

      {/* Sections */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((section) => (
            <SectionCredits
              key={section.id}
              section={section}
              snapshot={snapshots[section.id]}
              scrollSpeed={scrollSpeed}
              isPlaying={isPlaying}
            />
          ))}
        </div>
      )}
    </section>
  );
}
