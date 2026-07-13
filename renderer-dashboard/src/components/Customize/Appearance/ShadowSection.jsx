import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { SHADOW_PRESETS } from '../shared/constants.js';
import { rgbaToHexAlpha, hexAlphaToRgba } from '../shared/colorUtils.js';
import ColorPicker from '../shared/ColorPicker.jsx';

// Shadow is stored as a single-layer CSS `box-shadow` string: "X Y blur
// spread color". Unlike Glow (a centered filter: drop-shadow halo with no
// offset/spread), Shadow exposes offset + spread as real controls — set blur
// to 0, spread to a few px, and an opaque (alpha = 1) color, and the result
// reads as a hard-edged, solid-color duplicate of the bubble peeking out from
// behind it (box-shadow always inherits the element's own border-radius),
// instead of a soft blurred glow. That's the key visual difference from Glow.
const CUSTOM_SHADOW_RE =
  /(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+(-?[\d.]+)(?:px)?)?\s+(rgba?\([^)]*\))/i;
const DEFAULT_SHADOW_HEX = '#000000';
const DEFAULT_SHADOW_ALPHA = 0.45;
const DEFAULT_SHADOW_X = 0;
const DEFAULT_SHADOW_Y = 8;
const DEFAULT_SHADOW_BLUR = 24;
const DEFAULT_SHADOW_SPREAD = 0;

function parseShadow(value) {
  const match = CUSTOM_SHADOW_RE.exec(value || '');
  if (!match) {
    return {
      x: DEFAULT_SHADOW_X,
      y: DEFAULT_SHADOW_Y,
      blur: DEFAULT_SHADOW_BLUR,
      spread: DEFAULT_SHADOW_SPREAD,
      hex: DEFAULT_SHADOW_HEX,
      alpha: DEFAULT_SHADOW_ALPHA,
    };
  }
  const [, x, y, blur, spread, color] = match;
  const { hex, alpha } = rgbaToHexAlpha(color);
  return {
    x: Number(x),
    y: Number(y),
    blur: Number(blur),
    spread: spread !== undefined ? Number(spread) : 0,
    hex,
    alpha,
  };
}

function buildShadow(x, y, blur, spread, hex, alpha) {
  return `${x}px ${y}px ${blur}px ${spread}px ${hexAlphaToRgba(hex, alpha)}`;
}

export default function ShadowSection({ value, onChange, allowCustomCss = false }) {
  const enabled = !!value && value !== 'none';
  const matchedPreset = SHADOW_PRESETS.find((p) => p.value === value);
  const { x, y, blur, spread, hex, alpha } = parseShadow(value);

  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật shadow"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? SHADOW_PRESETS[1].value : 'none')}
        />
      </div>

      {enabled && (
        <>
          <Field label="Mẫu dựng sẵn">
            <select
              className={inputClass}
              value={matchedPreset?.id || 'custom'}
              onChange={(e) => {
                const preset = SHADOW_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  onChange(preset.value);
                  return;
                }
                onChange(buildShadow(x, y, blur, spread, hex, alpha));
              }}
            >
              {SHADOW_PRESETS.filter((p) => p.id !== 'none').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Tuỳ chỉnh</option>
            </select>
          </Field>

          {allowCustomCss && (
            <>
              <Field label="Màu & độ trong suốt shadow">
                <ColorPicker
                  value={hexAlphaToRgba(hex, alpha)}
                  onChange={(v) => {
                    const parsed = rgbaToHexAlpha(v);
                    onChange(buildShadow(x, y, blur, spread, parsed.hex, parsed.alpha));
                  }}
                  allowGradient={false}
                />
              </Field>
              <p className="col-span-2 -mt-1 text-[11px] text-inkMuted">
                Mẹo: đặt <b>Độ mờ</b> = 0, <b>Độ loang</b> vài px, và{' '}
                <b>độ trong suốt màu</b> = 100% để tạo khối đặc màu như một bản
                sao của bubble nằm phía sau — thay vì bóng mờ thông thường.
              </p>
              <Field label={`Lệch ngang (X) — ${x}px`}>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={x}
                  onChange={(e) => onChange(buildShadow(Number(e.target.value), y, blur, spread, hex, alpha))}
                />
              </Field>
              <Field label={`Lệch dọc (Y) — ${y}px`}>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={y}
                  onChange={(e) => onChange(buildShadow(x, Number(e.target.value), blur, spread, hex, alpha))}
                />
              </Field>
              <Field label={`Độ mờ (Blur) — ${blur}px`}>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={blur}
                  onChange={(e) => onChange(buildShadow(x, y, Number(e.target.value), spread, hex, alpha))}
                />
              </Field>
              <Field label={`Độ loang (Spread) — ${spread}px`}>
                <input
                  type="range"
                  min={-20}
                  max={40}
                  step={1}
                  value={spread}
                  onChange={(e) => onChange(buildShadow(x, y, blur, Number(e.target.value), hex, alpha))}
                />
              </Field>
            </>
          )}
        </>
      )}
    </>
  );
}
