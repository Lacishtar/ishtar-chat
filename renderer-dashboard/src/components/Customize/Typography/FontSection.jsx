import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { FONT_GROUPS } from '../shared/constants.js';
import ColorPicker from '../shared/ColorPicker.jsx';
import GlowSection from '../Appearance/GlowSection.jsx';

export default function FontSection({
  fontFamily,
  fontSize,
  color,
  opacity,
  textAlign,
  glow,
  strokeWidth,
  strokeColor,
  onChange,
  showFontFamily = true,
  showColor = true,
  showOpacity = true,
  showTextAlign = true,
  showGlow = true,
  showStroke = true,
  allowDefaultAlign = true,
  sizeRange = [10, 32],
}) {
  const strokeEnabled = (strokeWidth || 0) > 0;

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

      {showGlow && (
        <div className="col-span-2 flex flex-col gap-3 border-t border-line pt-3">
          <GlowSection value={glow ?? 'none'} onChange={(v) => onChange({ glow: v })} allowCustomCss />
        </div>
      )}

      {showStroke && (
        <div className="col-span-2 flex flex-col gap-3 border-t border-line pt-3">
          <EnableToggle
            label="Bật viền chữ (stroke)"
            checked={strokeEnabled}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ strokeWidth: 1, strokeColor: strokeColor || '#000000' });
              } else {
                onChange({ strokeWidth: 0 });
              }
            }}
          />
          {strokeEnabled && (
            <>
              <Field label={`Độ dày viền — ${strokeWidth}px`}>
                <input
                  type="range"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={strokeWidth}
                  onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
                />
              </Field>
              <Field label="Màu viền">
                <ColorPicker
                  value={strokeColor || '#000000'}
                  onChange={(v) => onChange({ strokeColor: v })}
                  allowGradient={false}
                />
              </Field>
            </>
          )}
        </div>
      )}
    </>
  );
}
