import { useState } from 'react';
import { SearchIcon } from './icons.jsx';

// Generic "jump to setting" search bar — same look & behavior as the
// Customize tab's SearchBar (Customize/Inspector/SearchBar.jsx), but driven
// by a plain `items` list instead of a hardcoded object/section model, so
// it can be reused by tabs with a different shape (Vai trò's role tabs,
// Fan Service's group tabs...).
//
// items: [{ key, label, meta?, keywords: string[], ...anything jumpTo needs }]
// onJumpTo(item) is called with the matched item when the user picks a result.
export default function SectionSearchBar({ items, onJumpTo, placeholder = 'Tìm cài đặt…' }) {
  const [keyword, setKeyword] = useState('');
  const q = keyword.trim().toLowerCase();
  const results = q
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.toLowerCase().includes(q)),
      )
    : [];

  function handleSelect(item) {
    setKeyword('');
    onJumpTo(item);
  }

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-inkMuted" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg bg-panelAlt border border-line pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-focusAccent"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => setKeyword('')}
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
          {results.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panelAlt flex items-center justify-between gap-2"
            >
              <span>{item.label}</span>
              {item.meta && (
                <span className="text-[10px] text-inkMuted uppercase tracking-wide shrink-0">{item.meta}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
