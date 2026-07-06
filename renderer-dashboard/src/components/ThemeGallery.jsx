export default function ThemeGallery({ themes, selectedTheme, onSelect }) {
  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted mb-1">Preset nhanh</h2>
      <p className="text-xs text-inkMuted mb-3">Chọn điểm bắt đầu — tuỳ chỉnh tự do bên dưới</p>

      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => {
          const isActive = theme.id === selectedTheme;
          const preview = theme.preview || {};
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.id)}
              className={`group relative rounded-lg border p-3 text-left transition-colors
                ${isActive ? 'border-focusAccent bg-focusAccent/10' : 'border-line bg-panelAlt hover:border-focusAccent/50'}`}
            >
              <div
                className="h-16 rounded-md border border-line mb-2 flex items-center gap-2 px-3"
                style={{ background: preview.bubbleBg || 'rgba(255,255,255,0.06)' }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: preview.authorColor || '#6E56F0' }}
                />
                <span
                  className="text-[11px] truncate"
                  style={{ color: preview.textColor || '#EAECEF' }}
                >
                  {theme.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{theme.name}</span>
                {isActive && <span className="text-[10px] uppercase text-focusAccent font-semibold">Đang dùng</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
