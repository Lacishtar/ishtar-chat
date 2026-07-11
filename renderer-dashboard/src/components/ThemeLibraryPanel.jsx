import { useEffect, useRef, useState } from 'react';

/**
 * ThemeLibraryPanel — standalone panel for browsing/applying theme presets.
 *
 * Lives as its own top-level panel in App.jsx (right column), separate from
 * the Customize/Inspector panel on the left — picking a theme is a distinct
 * action from fine-tuning individual settings, so it gets its own space.
 *
 * Responsibilities (UI only):
 *   - Load the theme list via api.getThemeList()
 *   - Filter by search keyword
 *   - Apply a selected theme via api.applyTheme()
 *   - Trigger resetPreset() / resetCategory() (passed in from App.jsx)
 *
 * ThemeManager owns the data logic. App.jsx's onThemeChanged listener
 * already re-syncs every panel's props when a theme is applied/reset, so
 * this component doesn't need to manually push state anywhere else.
 *
 * The picker itself is a thumbnail grid rather than a text <select> — each
 * card renders a tiny mock chat bubble using the theme's own preview colors
 * (shared/theme-registry.js → { bubbleBg, authorColor, textColor }) so users
 * can recognize a theme by how it looks, not just by name.
 */

const RESET_CATEGORIES = [
  { value: 'customizeConfig',  label: 'Màu sắc & Kiểu chữ' },
  { value: 'layoutConfig',     label: 'Bố cục' },
  { value: 'slotStyleConfig',  label: 'Kiểu từng phần tử' },
  { value: 'animationConfig',  label: 'Hiệu ứng' },
  { value: 'decorationConfig', label: 'Trang trí ảnh' },
  { value: 'roleStyleConfig',  label: 'Mod / Hội viên / SC' },
];

const FALLBACK_PREVIEW = {
  bubbleBg: 'rgba(22, 25, 31, 0.72)',
  authorColor: '#6E56F0',
  textColor: '#EAECEF',
};

/** Tiny mock chat bubble rendered from a theme's preview colors — an avatar
 *  dot, a name bar, and two message-line bars, sitting on the same
 *  checkerboard pattern ChatPreview uses to signal "transparent in OBS". */
function ThemeThumb({ preview }) {
  const p = { ...FALLBACK_PREVIEW, ...preview };
  return (
    <div className="ovs-checkerboard rounded-md overflow-hidden aspect-[4/3] flex items-center p-1.5">
      <div
        className="w-full rounded-lg px-1.5 py-1.5 flex items-start gap-1.5"
        style={{ backgroundColor: p.bubbleBg }}
      >
        <span
          className="shrink-0 h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: p.authorColor }}
        />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-0.5">
          <span className="h-1 w-7 rounded-full block" style={{ backgroundColor: p.authorColor }} />
          <span className="h-1 w-full rounded-full block" style={{ backgroundColor: p.textColor, opacity: 0.85 }} />
          <span className="h-1 w-2/3 rounded-full block" style={{ backgroundColor: p.textColor, opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ theme, isSelected, isApplying, onSelect, onPreview }) {
  return (
    <button
      type="button"
      title={theme.description || theme.name}
      onClick={() => onSelect(theme.id)}
      onMouseEnter={() => onPreview(theme.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(theme.id)}
      onBlur={() => onPreview(null)}
      disabled={isApplying}
      className={`flex flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focusAccent disabled:opacity-60 ${
        isSelected
          ? 'border-focusAccent ring-2 ring-focusAccent bg-panel'
          : 'border-line bg-panel hover:border-focusAccent/50'
      }`}
    >
      <ThemeThumb preview={theme.preview} />
      <span className="text-[10px] leading-tight text-inkMuted truncate px-0.5">
        {isApplying ? 'Đang áp dụng…' : theme.name}
      </span>
    </button>
  );
}

export default function ThemeLibraryPanel({ api, onApplied, resetPreset }) {
  const [themes, setThemes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [resetOpen, setResetOpen] = useState(false);
  const statusTimer = useRef(null);
  const resetRef = useRef(null);

  // ── Load theme list once on mount ──────────────────────────────────────────
  useEffect(() => {
    api.getThemeList?.().then((list) => {
      if (Array.isArray(list)) setThemes(list);
    });
  }, [api]);

  // ── Close reset dropdown when clicking outside ──────────────────────────────
  useEffect(() => {
    function handleOutside(e) {
      if (resetRef.current && !resetRef.current.contains(e.target)) {
        setResetOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Derived: filtered theme list ────────────────────────────────────────────
  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? themes.filter(
        (t) =>
          t.name.toLowerCase().includes(keyword) ||
          (t.description || '').toLowerCase().includes(keyword),
      )
    : themes;

  // ── Flash status badge ──────────────────────────────────────────────────────
  function flashStatus(type) {
    setStatus(type);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2000);
  }

  // ── Select + apply a theme in one click ─────────────────────────────────────
  async function handleSelectTheme(themeId) {
    if (applyingId) return;
    setSelectedId(themeId);
    setApplyingId(themeId);
    try {
      const result = await api.applyTheme(themeId);
      if (result?.ok) {
        // App.jsx already handles the live preview via onThemeChanged.
        // Call onApplied so the parent can sync local state if needed.
        onApplied?.(result);
        flashStatus('ok');
      } else {
        flashStatus('error');
      }
    } catch {
      flashStatus('error');
    } finally {
      setApplyingId(null);
    }
  }

  // ── Reset whole theme ────────────────────────────────────────────────────────
  async function handleResetAll() {
    setResetOpen(false);
    if (!window.confirm('Reset toàn bộ tuỳ chỉnh về theme hiện tại?')) return;
    await resetPreset();
    flashStatus('ok');
  }

  // Description shown below the grid: whatever's hovered/focused takes
  // priority so users can preview text before committing, falling back to
  // the last applied theme.
  const describedTheme = themes.find((t) => t.id === (previewId ?? selectedId));

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-focusAccent/30 bg-panelAlt/60 p-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-inkMuted font-semibold">
          Theme Library
        </span>
        {status === 'ok' && (
          <span className="text-[10px] text-connected uppercase tracking-wide">✓ Đã áp dụng</span>
        )}
        {status === 'error' && (
          <span className="text-[10px] text-live uppercase tracking-wide">✗ Thất bại</span>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-inkMuted"
        >
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theme…"
          className="w-full rounded-lg bg-panel border border-line pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-focusAccent"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-inkMuted hover:text-ink text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Thumbnail grid ── */}
      {filtered.length === 0 ? (
        <p className="text-[11px] text-inkMuted italic py-2 text-center">
          Không tìm thấy theme nào khớp &quot;{search}&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
          {filtered.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              isSelected={selectedId === t.id}
              isApplying={applyingId === t.id}
              onSelect={handleSelectTheme}
              onPreview={setPreviewId}
            />
          ))}
        </div>
      )}

      {/* ── Description hint — shows on hover/focus, falls back to selected ── */}
      {describedTheme?.description ? (
        <p className="text-[10px] text-inkMuted leading-relaxed">{describedTheme.description}</p>
      ) : null}

      {/* ── Reset ── */}
      <div className="flex items-center justify-end">
        <div className="relative" ref={resetRef}>
          <button
            type="button"
            onClick={() => setResetOpen((v) => !v)}
            title="Reset tuỳ chỉnh"
            className="rounded-lg border border-line bg-panel hover:bg-panelAlt text-inkMuted hover:text-ink text-xs py-1.5 px-2.5 flex items-center gap-1 transition-colors"
          >
            Reset
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={`h-3 w-3 transition-transform ${resetOpen ? 'rotate-180' : ''}`}
            >
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {/* Reset dropdown menu */}
          {resetOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-line bg-panel shadow-panel overflow-hidden">
              {/* Reset all */}
              <button
                type="button"
                onClick={handleResetAll}
                className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-panelAlt border-b border-line font-semibold"
              >
                🔄 Reset toàn bộ theme
              </button>

              {/* Reset per category */}
              <div className="px-2 py-1">
                <span className="text-[10px] uppercase tracking-wide text-inkMuted block px-1 py-1">
                  Reset từng mục
                </span>
                {RESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={async () => {
                      setResetOpen(false);
                      await api.resetCategory?.(cat.value);
                      flashStatus('ok');
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-md text-xs text-inkMuted hover:text-ink hover:bg-panelAlt"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
