import { OBJECTS } from '../shared/constants.js';

export default function ObjectSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OBJECTS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          title={o.hint}
          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
            selected === o.id
              ? 'bg-focusAccent text-white'
              : 'bg-panelAlt text-inkMuted hover:bg-line'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
