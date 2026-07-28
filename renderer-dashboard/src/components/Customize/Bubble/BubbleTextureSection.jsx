import { useEffect, useRef, useState } from 'react';
import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';

const BLEND_MODES = [
  ['normal', 'Bình thường'],
  ['multiply', 'Multiply (tối lại)'],
  ['screen', 'Screen (sáng lên)'],
  ['overlay', 'Overlay'],
  ['soft-light', 'Soft Light'],
  ['hard-light', 'Hard Light'],
  ['color-dodge', 'Color Dodge'],
  ['color-burn', 'Color Burn'],
  ['darken', 'Darken'],
  ['lighten', 'Lighten'],
  ['difference', 'Difference'],
  ['exclusion', 'Exclusion'],
  ['hue', 'Hue'],
  ['saturation', 'Saturation'],
  ['color', 'Color'],
  ['luminosity', 'Luminosity'],
];

const SIZE_UNITS = ['px', '%', 'auto'];

// Quick square-tile presets — the common case for a repeating texture is
// "one small/medium/large square", not an asymmetric width×height. Stored
// as an explicit two-value size ("16px 16px") rather than the width-only
// shorthand so it reads unambiguously as "square", independent of the
// source image's own aspect ratio.
const SQUARE_SIZE_PRESETS = [
  { label: 'Nhỏ', px: 16 },
  { label: 'Vừa', px: 32 },
  { label: 'Lớn', px: 64 },
  { label: 'Rất lớn', px: 128 },
];

function squarePresetValue(px) {
  return `${px}px ${px}px`;
}

// A CSS background-size value is 1 or 2 components ("32px", "50% 50%",
// "auto 100%"...). We store bubbleTextureSize as that raw string (so old
// configs / the auto|contain|cover presets keep working untouched), but the
// "custom" editor below no longer asks the user to type that string by
// hand — free-typed CSS was the main source of "not accurate" complaints
// (typos, missing units, forgetting the second component). Instead we parse
// it into two structured {value, unit} components and always re-serialize.
function parseSizeComponent(token) {
  if (!token || token === 'auto') return { value: '', unit: 'auto' };
  const m = /^(-?\d*\.?\d+)(px|%)$/.exec(token.trim());
  if (m) return { value: m[1], unit: m[2] };
  return { value: '', unit: 'auto' };
}

function parseCustomSize(str) {
  const parts = (str || '').trim().split(/\s+/).filter(Boolean);
  const width = parseSizeComponent(parts[0]);
  const height = parts.length > 1 ? parseSizeComponent(parts[1]) : { value: '', unit: 'auto' };
  return { width, height };
}

function formatSizeComponent(c) {
  if (c.unit === 'auto') return 'auto';
  const n = c.value === '' ? 0 : c.value;
  return `${n}${c.unit}`;
}

function serializeCustomSize(width, height) {
  // Single-value shorthand when height is left on "auto" — matches how
  // background-size is normally authored (width set, height follows ratio).
  if (height.unit === 'auto') return formatSizeComponent(width);
  return `${formatSizeComponent(width)} ${formatSizeComponent(height)}`;
}

// One axis (width or height) of the "advanced" custom-size editor: a
// segmented px/%/Auto picker plus a slider — replaces the old bare number
// input, which had no sense of range and made "how big is this really"
// hard to judge at a glance.
function SizeAxisControl({ label, comp, onUpdate }) {
  const max = comp.unit === '%' ? 100 : 300;
  const numValue = comp.value === '' ? 0 : Number(comp.value);
  return (
    <Field label={comp.unit === 'auto' ? `${label} — Auto` : `${label} — ${numValue}${comp.unit}`}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5">
          {SIZE_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUpdate({ value: u === 'auto' ? '' : (comp.value || '32'), unit: u })}
              className={`flex-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                comp.unit === u
                  ? 'bg-focusAccent text-white border-focusAccent'
                  : 'bg-panelAlt text-inkMuted hover:bg-line border-line'
              }`}
            >
              {u === 'auto' ? 'Auto' : u}
            </button>
          ))}
        </div>
        {comp.unit !== 'auto' && (
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={numValue}
            onChange={(e) => onUpdate({ ...comp, value: e.target.value })}
          />
        )}
      </div>
    </Field>
  );
}

export default function BubbleTextureSection({ value, onChange, onReset }) {
  const {
    bubbleTextureUrl,
    bubbleTextureSize,
    bubbleTextureRepeat,
    bubbleTextureOpacity,
    bubbleTextureBlendMode,
  } = value;
  // Config from disk/older presets may predate these fields and hand us
  // `undefined` — normalize to the documented default (center) so the
  // sliders below always have a real number to show.
  const posX = value.bubbleTexturePositionX ?? 50;
  const posY = value.bubbleTexturePositionY ?? 50;

  // "Enabled" used to be derived purely from `!!bubbleTextureUrl`. That broke
  // the very first time someone flipped the toggle on: with no URL saved yet,
  // turning it on wrote an empty string, which is falsy, so `enabled` snapped
  // right back to false and the URL/size/opacity fields never appeared.
  // We now track "the user turned this on" as its own bit of state, so the
  // fields stay visible while they type in a URL.
  const [manuallyEnabled, setManuallyEnabled] = useState(!!bubbleTextureUrl);
  const enabled = manuallyEnabled || !!bubbleTextureUrl;

  // Remember the last URL typed so unchecking "Enable Texture" (which clears
  // the url so the effect actually turns off) doesn't lose the user's work
  // if they flip it back on.
  const lastUrlRef = useRef(bubbleTextureUrl || '');
  if (bubbleTextureUrl) lastUrlRef.current = bubbleTextureUrl;

  // Remember the last custom width/height the user set, independently of
  // the raw bubbleTextureSize string, so switching the preset dropdown to
  // Auto/Contain/Cover and back to "Tự chọn" restores exactly what they had
  // instead of resetting to a hardcoded default (the old bug here).
  const isPreset = ['auto', 'contain', 'cover'].includes(bubbleTextureSize);
  const lastCustomRef = useRef(
    !isPreset && bubbleTextureSize ? parseCustomSize(bubbleTextureSize) : { width: { value: '32', unit: 'px' }, height: { value: '', unit: 'auto' } },
  );
  if (!isPreset && bubbleTextureSize) {
    lastCustomRef.current = parseCustomSize(bubbleTextureSize);
  }
  const customSize = !isPreset && bubbleTextureSize ? parseCustomSize(bubbleTextureSize) : lastCustomRef.current;

  const updateCustomSize = (patch) => {
    const next = { ...customSize, ...patch };
    onChange({ bubbleTextureSize: serializeCustomSize(next.width, next.height) });
  };

  // Which quick preset (if any) the current size matches, so its chip can
  // show as active. `null` when the size is asymmetric / a value the chips
  // don't cover — that's when the advanced editor should default open.
  const activeSquarePreset = SQUARE_SIZE_PRESETS.find((p) => bubbleTextureSize === squarePresetValue(p.px)) || null;
  const [advancedOpen, setAdvancedOpen] = useState(!isPreset && bubbleTextureSize && !activeSquarePreset);
  // If a preset chip gets clicked while the advanced editor is open, close it
  // again — otherwise the sliders below would keep showing a now-stale
  // asymmetric value instead of reflecting the chip that was just picked.
  const selectSquarePreset = (px) => {
    setAdvancedOpen(false);
    onChange({ bubbleTextureSize: squarePresetValue(px) });
  };

  // If the URL gets cleared from outside (e.g. "Dùng mặc định chung"), make
  // sure the section collapses back too instead of staying stuck open.
  useEffect(() => {
    if (!bubbleTextureUrl) setManuallyEnabled(false);
  }, [bubbleTextureUrl]);

  const handleToggle = (e) => {
    const turningOn = e.target.checked;
    setManuallyEnabled(turningOn);
    if (turningOn) {
      // Only write a URL if we actually have one remembered; otherwise leave
      // it null and let the field below stay empty for the user to fill in.
      if (lastUrlRef.current) onChange({ bubbleTextureUrl: lastUrlRef.current });
    } else {
      // Write '' (not null) so this explicitly overrides an inherited
      // texture. At the per-slot level (author/message bubble), null means
      // "no override — fall back to the shared Bubble config", so a
      // texture set there would keep reappearing even after switching this
      // toggle off. '' is a real, resolvable value that always renders as
      // "no texture" (both globally and per-slot), so it actually turns it
      // off. Use the separate "Dùng mặc định chung" button to go back to
      // true inheritance instead.
      onChange({ bubbleTextureUrl: '' });
    }
  };

  return (
    <>
      <div className="col-span-2 flex items-center justify-between gap-2">
        <EnableToggle
          label="Bật texture nền bubble"
          checked={enabled}
          onChange={handleToggle}
        />
        {onReset && (
          <button type="button" onClick={onReset} className="text-[10px] text-inkMuted hover:text-ink underline shrink-0">
            Dùng mặc định chung
          </button>
        )}
      </div>

      {enabled && (
        <>
          <div className="col-span-2">
            <Field label="URL Texture (Ảnh lặp nền)">
              <input
                type="text"
                className={inputClass}
                placeholder="Ví dụ: /overlay/assets/texture.png hoặc url ảnh"
                value={bubbleTextureUrl || ''}
                onChange={(e) => onChange({ bubbleTextureUrl: e.target.value.trim() || null })}
              />
            </Field>
          </div>

          <Field label="Chế độ lặp">
            <select
              className={inputClass}
              value={bubbleTextureRepeat || 'repeat'}
              onChange={(e) => onChange({ bubbleTextureRepeat: e.target.value })}
            >
              <option value="repeat">Lặp ngang & dọc (Tile)</option>
              <option value="repeat-x">Lặp ngang</option>
              <option value="repeat-y">Lặp dọc</option>
              <option value="no-repeat">Không lặp</option>
            </select>
          </Field>

          <Field label="Kích thước texture">
            <select
              className={inputClass}
              value={isPreset ? bubbleTextureSize : 'custom'}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ bubbleTextureSize: v === 'custom' ? serializeCustomSize(lastCustomRef.current.width, lastCustomRef.current.height) : v });
              }}
            >
              <option value="auto">Mặc định (Auto)</option>
              <option value="contain">Khớp khung (Contain)</option>
              <option value="cover">Tràn khung (Cover)</option>
              <option value="custom">Tự chọn kích thước...</option>
            </select>
          </Field>

          {!isPreset && (
            <div className="col-span-2 flex flex-col gap-3">
              <div>
                <span className="text-xs text-inkMuted block mb-1.5">Kích thước nhanh (ô vuông)</span>
                <div className="flex flex-wrap gap-2">
                  {SQUARE_SIZE_PRESETS.map((p) => {
                    const active = !advancedOpen && activeSquarePreset?.px === p.px;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => selectSquarePreset(p.px)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          active
                            ? 'bg-focusAccent text-white border-focusAccent'
                            : 'bg-panelAlt text-inkMuted hover:bg-line border-line'
                        }`}
                      >
                        {p.label} · {p.px}px
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                      advancedOpen
                        ? 'bg-focusAccent text-white border-focusAccent'
                        : 'bg-panelAlt text-inkMuted hover:bg-line border-line'
                    }`}
                  >
                    Rộng/cao riêng…
                  </button>
                </div>
              </div>

              {advancedOpen && (
                <div className="grid grid-cols-1 gap-3">
                  <SizeAxisControl
                    label="Chiều rộng"
                    comp={customSize.width}
                    onUpdate={(comp) => updateCustomSize({ width: comp })}
                  />
                  <SizeAxisControl
                    label="Chiều cao"
                    comp={customSize.height}
                    onUpdate={(comp) => updateCustomSize({ height: comp })}
                  />
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <Field label={`Độ hiển thị texture — ${Math.round((bubbleTextureOpacity ?? 1) * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round((bubbleTextureOpacity ?? 1) * 100)}
                onChange={(e) => onChange({ bubbleTextureOpacity: Number(e.target.value) / 100 })}
              />
            </Field>
          </div>

          <div className="col-span-2 flex flex-col gap-3">
            <Field label={`Vị trí trục X (ngang) — ${posX}%`}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={posX}
                onChange={(e) => onChange({ bubbleTexturePositionX: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Vị trí trục Y (dọc) — ${posY}%`}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={posY}
                onChange={(e) => onChange({ bubbleTexturePositionY: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Chế độ hoà trộn (Blend mode)" full>
            <select
              className={inputClass}
              value={bubbleTextureBlendMode || 'normal'}
              onChange={(e) => onChange({ bubbleTextureBlendMode: e.target.value })}
            >
              {BLEND_MODES.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </Field>
        </>
      )}
    </>
  );
}
