import { SEARCH_INDEX } from './searchIndex.js';
import { OBJECTS } from '../shared/constants.js';

export default function FavoritesBar({ favorites, onJumpTo }) {
  if (!favorites || favorites.length === 0) return null;

  const items = favorites
    .map((key) => {
      const [objectId, sectionId] = key.split(':');
      const entry = SEARCH_INDEX.find((e) => e.objectId === objectId && e.sectionId === sectionId);
      const objLabel = OBJECTS.find((o) => o.id === objectId)?.label;
      return entry ? { ...entry, objLabel } : null;
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-panelAlt/40 p-2">
      <span className="text-[10px] uppercase tracking-wide text-inkMuted w-full">Ghim ★</span>
      {items.map((it) => (
        <button
          key={`${it.objectId}-${it.sectionId}`}
          type="button"
          onClick={() => onJumpTo(it)}
          className="px-2 py-1 rounded-md text-[11px] bg-panel border border-line text-inkMuted hover:text-ink hover:border-focusAccent"
        >
          ★ {it.label}
        </button>
      ))}
    </div>
  );
}
