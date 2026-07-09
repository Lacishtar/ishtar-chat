import { searchSections } from './searchIndex.js';
import { OBJECTS } from '../shared/constants.js';

export default function SearchBar({ keyword, onKeywordChange, onJumpTo }) {
  const results = searchSections(keyword);

  return (
    <div className="relative">
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
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Tìm settings… (shadow, font, radius, texture)"
          className="w-full rounded-lg bg-panelAlt border border-line pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-focusAccent"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => onKeywordChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-inkMuted hover:text-ink text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {keyword && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-panel shadow-panel max-h-56 overflow-y-auto">
          {results.length === 0 && (
            <div className="px-3 py-2 text-xs text-inkMuted">Không tìm thấy setting phù hợp.</div>
          )}
          {results.map((r) => {
            const objLabel = OBJECTS.find((o) => o.id === r.objectId)?.label;
            return (
              <button
                key={`${r.objectId}-${r.sectionId}`}
                type="button"
                onClick={() => onJumpTo(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-panelAlt flex items-center justify-between gap-2"
              >
                <span>{r.label}</span>
                <span className="text-[10px] text-inkMuted uppercase tracking-wide">{objLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
