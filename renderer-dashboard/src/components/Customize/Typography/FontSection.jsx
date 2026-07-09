import { Field, inputClass } from '../shared/fields.jsx';
import { FONT_OPTIONS } from '../shared/constants.js';

export default function FontSection({
  fontFamily,
  fontSize,
  color,
  opacity,
  onChange,
  showFontFamily = true,
  showColor = true,
  showOpacity = true,
  sizeRange = [10, 32],
}) {
  return (
    <>
      {showFontFamily && (
        <Field label="Font">
          <select
            className={inputClass}
            value={fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={`Cỡ chữ — ${fontSize}px`}>
        <input
          type="range"
          min={sizeRange[0]}
          max={sizeRange[1]}
          value={fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
        />
      </Field>
      {showColor && (
        <Field label="Màu chữ">
          <input
            type="color"
            className="h-8 w-full rounded-lg border border-line bg-panelAlt"
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </Field>
      )}
      {showOpacity && (
        <Field label={`Opacity — ${Math.round(opacity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </Field>
      )}
    </>
  );
}
