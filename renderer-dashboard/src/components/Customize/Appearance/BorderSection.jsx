import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { BORDER_STYLE_OPTIONS } from '../shared/constants.js';

/**
 * Fully generic: the caller decides what "width/style/color" mean (global
 * config field, slot-style field, or slot-bubble field) by supplying
 * `values` + `onChange`. This is what lets the same component back the
 * global "Bubble cả tin nhắn" border, the Avatar border, and the per-slot
 * "Bubble riêng" border without duplicating logic three times.
 */
export default function BorderSection({
  width,
  style,
  color,
  defaultColor,
  onChange,
  presets,
}) {
  const enabled = (width || 0) > 0;

  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật viền (Border)"
          checked={enabled}
          onChange={(e) => onChange({ width: e.target.checked ? 2 : 0 })}
        />
      </div>

      {enabled && (
        <>
          {presets && presets.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(p.patch)}
                  className="px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <Field label={`Độ dày viền — ${width}px`}>
            <input
              type="range"
              min={0}
              max={6}
              value={width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
          </Field>
          <Field label="Kiểu viền">
            <select
              className={inputClass}
              value={style || 'solid'}
              onChange={(e) => onChange({ style: e.target.value })}
            >
              {BORDER_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Màu viền">
            <input
              type="color"
              className="h-8 w-full rounded-lg border border-line bg-panelAlt"
              value={color || defaultColor}
              onChange={(e) => onChange({ color: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  );
}
