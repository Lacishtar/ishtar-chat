import { Field, inputClass } from '../shared/fields.jsx';
import { FONT_GROUPS } from '../shared/constants.js';
import ColorPicker from '../shared/ColorPicker.jsx';

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
        <Field label="Phông chữ">
          <select
            className={inputClass}
            value={fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          >
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.fonts.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
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
          <ColorPicker value={color} onChange={(v) => onChange({ color: v })} allowGradient={false} />
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
