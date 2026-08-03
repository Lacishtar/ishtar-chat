import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { BORDER_STYLE_OPTIONS, DEFAULT_BORDER_COLOR } from '../shared/constants.js';
import ColorPicker from '../shared/ColorPicker.jsx';

// Fully generic: the caller decides what "width/style/color" mean (global
// global "Bubble cả tin nhắn" border, the Avatar border, and the per-slot
// "Bubble riêng" border without duplicating logic three times.
export default function BorderSection({
  width,
  style,
  color,
  defaultColor = DEFAULT_BORDER_COLOR,
  offset,
  onChange,
  presets,
}) {
  const enabled = (width || 0) > 0;
  const effectiveOffset = offset ?? 0;

  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật viền (Border)"
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { width: 2, color: color || defaultColor }
                : { width: 0 },
            )
          }
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
            <ColorPicker
              value={color || defaultColor}
              onChange={(v) => onChange({ color: v })}
              allowGradient={false}
            />
          </Field>
          {offset !== undefined && (
            <>
              <Field label={`Vị trí viền (offset) — ${effectiveOffset > 0 ? '+' : ''}${effectiveOffset}px`}>
                <input
                  type="range"
                  min={-20}
                  max={20}
                  step={1}
                  value={effectiveOffset}
                  onChange={(e) => onChange({ offset: Number(e.target.value) })}
                />
              </Field>
              <div className="col-span-2 text-[10px] text-inkMuted leading-snug">
                {effectiveOffset > 0
                  ? `▲ Viền nằm ngoài (+${effectiveOffset}px)`
                  : effectiveOffset < 0
                  ? `▼ Viền nằm trong (${effectiveOffset}px)`
                  : '→ Viền nằm sát cạnh (0px — mặc định)'}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
