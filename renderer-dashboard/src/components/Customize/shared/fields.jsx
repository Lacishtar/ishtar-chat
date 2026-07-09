export const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </label>
  );
}

export function PresetBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wide text-inkMuted bg-panelAlt px-1.5 py-0.5 rounded">
      Preset
    </span>
  );
}

export function PresetButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
    >
      {label}
    </button>
  );
}

export function SlotToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-focusAccent" />
      {label}
    </label>
  );
}

// Used for progressive disclosure ("Enable Border", "Enable Shadow", ...).
// Visually distinct from SlotToggle (which toggles visibility of an object)
// so the two concepts don't get confused at a glance.
export function EnableToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm cursor-pointer select-none">
      <span className="font-medium">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-focusAccent' : 'bg-panelAlt border border-line'
        }`}
      >
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[19px]' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  );
}
