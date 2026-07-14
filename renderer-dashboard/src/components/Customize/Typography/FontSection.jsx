import { Field, inputClass } from '../shared/fields.jsx';
import { FONT_GROUPS } from '../shared/constants.js';
import ColorPicker from '../shared/ColorPicker.jsx';

export default function FontSection({
  fontFamily,
  fontSize,
  color,
  opacity,
  textAlign,
  onChange,
  showFontFamily = true,
  showColor = true,
  showOpacity = true,
  showTextAlign = true,
  allowDefaultAlign = true,
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
      {showTextAlign && (
        <Field label="Căn lề">
          <select
            className={inputClass}
            value={textAlign || ''}
            onChange={(e) => onChange({ textAlign: e.target.value || null })}
          >
            {allowDefaultAlign && <option value="">Mặc định</option>}
            <option value="left">Trái</option>
            <option value="center">Giữa</option>
            <option value="right">Phải</option>
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
