import { useEffect, useRef, useState } from 'react';

/**
 * ThemeSection — theme picker that lives at the top of the Inspector panel.
 *
 * Responsibilities (UI only):
 *   - Load the theme list via api.getThemeList()
 *   - Filter by search keyword
 *   - Apply a selected theme via api.applyTheme()
 *   - Trigger resetPreset() / resetCategory() from the parent state
 *
 * ThemeManager owns the data logic.
 * The renderer (App.jsx → onThemeChanged) owns the live-preview update.
 * This component owns ONLY the interaction.
 */

const RESET_CATEGORIES = [
  { value: 'customizeConfig',  label: 'Màu sắc & Kiểu chữ' },
  { value: 'layoutConfig',     label: 'Bố cục' },
  { value: 'slotStyleConfig',  label: 'Kiểu từng phần tử' },
  { value: 'animationConfig',  label: 'Hiệu ứng' },
  { value: 'decorationConfig', label: 'Trang trí ảnh' },
  { value: 'roleStyleConfig',  label: 'Mod / Hội viên / SC' },
];

export default function ThemeSection({ api, onApplied, resetPreset }) {
  const [themes, setThemes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [applying, setApplying] = useState(false);
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

  // ── Apply theme ─────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!selectedId || applying) return;
    setApplying(true);
    try {
      const result = await api.applyTheme(selectedId);
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
      setApplying(false);
    }
  }

  // ── Reset whole theme ────────────────────────────────────────────────────────
  async function handleResetAll() {
    setResetOpen(false);
    if (!window.confirm('Reset toàn bộ tuỳ chỉnh về theme hiện tại?')) return;
    await resetPreset();
    flashStatus('ok');
  }

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

      {/* ── Dropdown ── */}
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full rounded-lg bg-panel border border-line px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-focusAccent text-ink"
      >
        <option value="">— Chọn theme —</option>
        {filtered.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* ── Description hint ── */}
      {selectedId && (() => {
        const t = themes.find((x) => x.id === selectedId);
        return t?.description ? (
          <p className="text-[10px] text-inkMuted leading-relaxed">{t.description}</p>
        ) : null;
      })()}

      {/* ── Action row ── */}
      <div className="flex items-center gap-2">
        {/* Apply */}
        <button
          type="button"
          disabled={!selectedId || applying}
          onClick={handleApply}
          className="flex-1 rounded-lg bg-focusAccent hover:bg-focusAccent/85 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 transition-colors"
        >
          {applying ? 'Đang áp dụng…' : 'Áp dụng'}
        </button>

        {/* Reset dropdown trigger */}
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
