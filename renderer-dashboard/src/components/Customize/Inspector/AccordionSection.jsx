/**
 * A single collapsible group inside an object's Inspector.
 *
 * - `open` / `onToggle` are controlled by the parent so state can live in
 *   one place (useCustomizeState) instead of being scattered per-section.
 * - `favoriteKey`, when provided, renders a star that pins/unpins this
 *   section in the Favorites bar.
 * - `matched` is used by the search feature to visually highlight sections
 *   whose title or contents match the current search keyword.
 */
export default function AccordionSection({
  id,
  title,
  open,
  onToggle,
  children,
  favoriteKey,
  isFavorite,
  onToggleFavorite,
  matched,
  dimmed,
}) {
  return (
    <div
      id={id}
      className={`rounded-lg border transition-colors ${
        matched ? 'border-focusAccent' : 'border-line'
      } ${dimmed ? 'opacity-40' : ''} bg-panelAlt/40`}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold text-ink uppercase tracking-wide">{title}</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className={`h-3.5 w-3.5 text-inkMuted transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        {favoriteKey && (
          <button
            type="button"
            onClick={() => onToggleFavorite?.(favoriteKey)}
            title={isFavorite ? 'Bỏ ghim' : 'Ghim mục này'}
            className={`text-sm px-1 ${isFavorite ? 'text-yellow-400' : 'text-inkMuted hover:text-ink'}`}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
      </div>
      {open && <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3 min-w-0">{children}</div>}
    </div>
  );
}
