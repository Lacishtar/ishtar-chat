import { Field } from '../shared/fields.jsx';
import { rgbaToHexAlpha, hexAlphaToRgba } from '../shared/colorUtils.js';

export default function BackgroundSection({ rgba, onChange, label = 'Màu nền bubble' }) {
  const { hex, alpha } = rgbaToHexAlpha(rgba);

  return (
    <>
      <Field label={label}>
        <input
          type="color"
          className="h-8 w-full rounded-lg border border-line bg-panelAlt"
          value={hex}
          onChange={(e) => onChange(hexAlphaToRgba(e.target.value, alpha))}
        />
      </Field>
      <Field label={`Độ trong nền — ${Math.round(alpha * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={alpha}
          onChange={(e) => onChange(hexAlphaToRgba(hex, Number(e.target.value)))}
        />
      </Field>
    </>
  );
}
