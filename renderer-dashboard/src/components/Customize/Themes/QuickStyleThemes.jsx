import { QUICK_STYLE_THEMES } from './themeDefinitions.js';

export default function QuickStyleThemes({ onApply }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wide text-inkMuted">Quick Style</span>
      <div className="flex flex-wrap gap-2">
        {QUICK_STYLE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t.patch)}
            title={`Áp dụng theme ${t.label}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-panelAlt text-inkMuted hover:text-ink border border-line hover:border-focusAccent"
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.swatch }} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
