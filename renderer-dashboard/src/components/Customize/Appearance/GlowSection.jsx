import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { GLOW_PRESETS } from '../shared/constants.js';
import { rgbaToHexAlpha, hexAlphaToRgba } from '../shared/colorUtils.js';

// Glow is stored as a CSS `filter: drop-shadow(...)` string (see constants.js /
// overlay/bubble-wrap.css). The "custom" editor below never asks the user to type
// that CSS by hand — it reads the offset/blur/color straight out of whatever
// single-layer drop-shadow is currently set and drives it with a real color
// picker + range inputs, then re-serializes to the same string shape.
const CUSTOM_GLOW_RE = /drop-shadow\(\s*0\s+0\s+([\d.]+)px\s+(rgba?\([^)]*\))\s*\)/i;
const DEFAULT_GLOW_HEX = '#6E56F0';
const DEFAULT_GLOW_ALPHA = 0.65;
const DEFAULT_GLOW_BLUR = 8;

function parseGlow(value) {
  const match = CUSTOM_GLOW_RE.exec(value || '');
  if (!match) return { hex: DEFAULT_GLOW_HEX, alpha: DEFAULT_GLOW_ALPHA, blur: DEFAULT_GLOW_BLUR };
  const blur = Number(match[1]);
  const { hex, alpha } = rgbaToHexAlpha(match[2]);
  return { hex, alpha, blur: Number.isFinite(blur) ? blur : DEFAULT_GLOW_BLUR };
}

function buildGlow(hex, alpha, blur) {
  return `drop-shadow(0 0 ${blur}px ${hexAlphaToRgba(hex, alpha)})`;
}

export default function GlowSection({ value, onChange, allowCustomCss = false }) {
  const enabled = !!value && value !== 'none';
  const matchedPreset = GLOW_PRESETS.find((p) => p.value === value);
  const { hex, alpha, blur } = parseGlow(value);

  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật glow"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? GLOW_PRESETS[1].value : 'none')}
        />
      </div>

      {enabled && (
        <>
          <Field label="Preset">
            <select
              className={inputClass}
              value={matchedPreset?.id || 'custom'}
              onChange={(e) => {
                const preset = GLOW_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  onChange(preset.value);
                  return;
                }
                onChange(buildGlow(hex, alpha, blur));
              }}
            >
              {GLOW_PRESETS.filter((p) => p.id !== 'none').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Tuỳ chỉnh</option>
            </select>
          </Field>

          {allowCustomCss && (
            <>
              <Field label="Màu glow">
                <input
                  type="color"
                  className="h-8 w-full rounded-lg border border-line bg-panelAlt cursor-pointer"
                  value={hex}
                  onChange={(e) => onChange(buildGlow(e.target.value, alpha, blur))}
                />
              </Field>
              <Field label={`Cường độ glow — ${Math.round(alpha * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={alpha}
                  onChange={(e) => onChange(buildGlow(hex, Number(e.target.value), blur))}
                />
              </Field>
              <Field label={`Độ lan toả — ${blur}px`}>
                <input
                  type="range"
                  min={2}
                  max={40}
                  step={1}
                  value={blur}
                  onChange={(e) => onChange(buildGlow(hex, alpha, Number(e.target.value)))}
                />
              </Field>
            </>
          )}
        </>
      )}
    </>
  );
}
