import { useEffect, useRef, useState } from 'react';

const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (mặc định)' },
  { value: '"Space Grotesk", system-ui, sans-serif', label: 'Space Grotesk' },
  { value: 'ui-monospace, "JetBrains Mono", monospace', label: 'Mono' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
];

const TABS = [
  { id: 'global', label: 'Chung' },
  { id: 'avatar', label: 'Avatar' },
  { id: 'author', label: 'Tên' },
  { id: 'message', label: 'Nội dung' },
  { id: 'badges', label: 'Badge' },
];

function rgbaToHexAlpha(rgba) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/.exec(rgba || '');
  if (!match) return { hex: '#16191F', alpha: 0.72 };
  const [, r, g, b, a] = match;
  const hex = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
  return { hex, alpha: a !== undefined ? Number(a) : 1 };
}

function hexAlphaToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function mergeSlot(local, slot, patch) {
  return {
    ...local,
    slots: {
      ...local.slots,
      [slot]: { ...(local.slots?.[slot] || {}), ...patch },
    },
  };
}

function slotVal(slotStyle, slot, key, fallback) {
  const v = slotStyle?.slots?.[slot]?.[key];
  return v !== undefined && v !== null ? v : fallback;
}

function configVal(config, key, fallback) {
  const v = config?.[key];
  return v !== undefined && v !== null ? v : fallback;
}

function isUserSet(config, key) {
  const v = config?.[key];
  return v !== undefined && v !== null;
}

function PresetBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wide text-inkMuted bg-panelAlt px-1.5 py-0.5 rounded">
      Preset
    </span>
  );
}

const BORDER_STYLE_OPTIONS = [
  { value: 'solid', label: 'Liền' },
  { value: 'dashed', label: 'Đứt khúc' },
  { value: 'dotted', label: 'Chấm' },
  { value: 'none', label: 'Không viền' },
];

const SHADOW_PRESETS = [
  { id: 'none', label: 'Không', value: 'none' },
  { id: 'light', label: 'Nhẹ', value: '0 4px 14px rgba(255, 140, 200, 0.25)' },
  { id: 'strong', label: 'Mạnh', value: '0 8px 24px rgba(0, 0, 0, 0.45)' },
];

function PresetButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
    >
      {label}
    </button>
  );
}

function SlotToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-focusAccent" />
      {label}
    </label>
  );
}

function TransformFields({ slotLocal, slot, pushSlotUpdate }) {
  const zIndex = slotVal(slotLocal, slot, 'zIndex', null);
  const displayZIndex = zIndex !== null ? zIndex : 'Mặc định (auto)';

  return (
    <>
      <Field label={`Góc xoay — ${slotVal(slotLocal, slot, 'rotate', 0)}°`}>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={slotVal(slotLocal, slot, 'rotate', 0)}
          onChange={(e) => pushSlotUpdate(slot, { rotate: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Offset X — ${slotVal(slotLocal, slot, 'translateX', 0)}px`}>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={slotVal(slotLocal, slot, 'translateX', 0)}
          onChange={(e) => pushSlotUpdate(slot, { translateX: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Offset Y — ${slotVal(slotLocal, slot, 'translateY', 0)}px`}>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={slotVal(slotLocal, slot, 'translateY', 0)}
          onChange={(e) => pushSlotUpdate(slot, { translateY: Number(e.target.value) })}
        />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            <span>Thứ tự hiển thị (z-index) — {displayZIndex}</span>
            {zIndex !== null && (
              <button
                type="button"
                onClick={() => pushSlotUpdate(slot, { zIndex: null })}
                className="text-[10px] text-inkMuted hover:text-ink underline ml-1"
              >
                Mặc định
              </button>
            )}
          </span>
        }
      >
        <input
          type="range"
          min={-10}
          max={20}
          step={1}
          value={zIndex !== null ? zIndex : 0}
          onChange={(e) => pushSlotUpdate(slot, { zIndex: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function slotBubbleVal(slotLocal, slot, key, globalConfig, fallback) {
  const slotValRaw = slotLocal?.slots?.[slot]?.[key];
  if (slotValRaw !== undefined && slotValRaw !== null) return slotValRaw;
  const globalVal = globalConfig?.[key];
  if (globalVal !== undefined && globalVal !== null) return globalVal;
  return fallback;
}

function isSlotBubbleUserSet(slotLocal, slot, key) {
  const v = slotLocal?.slots?.[slot]?.[key];
  return v !== undefined && v !== null;
}





function TextureFields({ localValue, onChange, onReset }) {
  return (
    <div className="col-span-2 border-t border-line/60 pt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-inkMuted uppercase tracking-wider">Texture nền bubble</h4>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-inkMuted hover:text-ink underline"
          >
            Dùng mặc định chung
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="URL Texture (Ảnh lặp nền)">
            <input
              type="text"
              className={inputClass}
              placeholder="Ví dụ: /overlay/assets/texture.png hoặc url ảnh"
              value={localValue.bubbleTextureUrl || ''}
              onChange={(e) => onChange({ bubbleTextureUrl: e.target.value.trim() || null })}
            />
          </Field>
        </div>
        <Field label="Chế độ lặp">
          <select
            className={inputClass}
            value={localValue.bubbleTextureRepeat || 'repeat'}
            onChange={(e) => onChange({ bubbleTextureRepeat: e.target.value })}
          >
            <option value="repeat">Lặp ngang & dọc (Tile)</option>
            <option value="repeat-x">Lặp ngang</option>
            <option value="repeat-y">Lặp dọc</option>
            <option value="no-repeat">Không lặp</option>
          </select>
        </Field>
        <Field label="Kích thước texture (Size)">
          <select
            className={inputClass}
            value={['auto', 'contain', 'cover'].includes(localValue.bubbleTextureSize) ? localValue.bubbleTextureSize : 'custom'}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ bubbleTextureSize: v === 'custom' ? '32px' : v });
            }}
          >
            <option value="auto">Mặc định (Auto)</option>
            <option value="contain">Khớp khung (Contain)</option>
            <option value="cover">Tràn khung (Cover)</option>
            <option value="custom">Tự chọn kích thước...</option>
          </select>
        </Field>
        {localValue.bubbleTextureSize && !['auto', 'contain', 'cover'].includes(localValue.bubbleTextureSize) && (
          <div className="col-span-2">
            <Field label="Kích thước tự chọn (CSS background-size)">
              <input
                type="text"
                className={inputClass}
                placeholder="Ví dụ: 32px hoặc 50% 50%"
                value={localValue.bubbleTextureSize || ''}
                onChange={(e) => onChange({ bubbleTextureSize: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="col-span-2">
          <Field label={`Độ hiển thị texture — ${Math.round((localValue.bubbleTextureOpacity ?? 1) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={localValue.bubbleTextureOpacity ?? 1}
              onChange={(e) => onChange({ bubbleTextureOpacity: Number(e.target.value) })}
              className="w-full accent-focusAccent"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}



function SlotBubbleFields({ title, slot, slotLocal, globalConfig, pushSlotUpdate }) {
  const bg = slotBubbleVal(slotLocal, slot, 'bubbleBg', globalConfig, globalConfig.bubbleBg);
  const { hex, alpha } = rgbaToHexAlpha(bg);
  const padX = slotBubbleVal(
    slotLocal,
    slot,
    'bubblePaddingX',
    globalConfig,
    slotBubbleVal(slotLocal, slot, 'bubblePadding', globalConfig, 14),
  );
  const padY = slotBubbleVal(
    slotLocal,
    slot,
    'bubblePaddingY',
    globalConfig,
    slotBubbleVal(slotLocal, slot, 'bubblePadding', globalConfig, 10),
  );

  const textureVal = {
    bubbleTextureUrl: slotBubbleVal(slotLocal, slot, 'bubbleTextureUrl', globalConfig, null),
    bubbleTextureSize: slotBubbleVal(slotLocal, slot, 'bubbleTextureSize', globalConfig, 'auto'),
    bubbleTextureRepeat: slotBubbleVal(slotLocal, slot, 'bubbleTextureRepeat', globalConfig, 'repeat'),
    bubbleTextureOpacity: slotBubbleVal(slotLocal, slot, 'bubbleTextureOpacity', globalConfig, 1),
  };

  const handleTextureReset = () => {
    pushSlotUpdate(slot, {
      bubbleTextureUrl: null,
      bubbleTextureSize: null,
      bubbleTextureRepeat: null,
      bubbleTextureOpacity: null,
    });
  };

  return (
    <div className="border-t border-line pt-3 flex flex-col gap-3 col-span-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-inkMuted uppercase tracking-wide">{title}</h3>
        <button
          type="button"
          onClick={() =>
            pushSlotUpdate(slot, {
              bubbleBg: null,
              bubbleRadius: null,
              bubbleOpacity: null,
              bubbleBorderWidth: null,
              bubbleBorderStyle: null,
              bubbleBorderColor: null,
              bubbleBoxShadow: null,
              bubblePadding: null,
              bubblePaddingX: null,
              bubblePaddingY: null,
              bubbleTextureUrl: null,
              bubbleTextureSize: null,
              bubbleTextureRepeat: null,
              bubbleTextureOpacity: null,
              bubbleBunnyEars: null,
              bubbleBunnyEarsWidth: null,
              bubbleBunnyEarsHeight: null,
              bubbleBunnyEarsRoundness: null,
              bubbleBunnyEarsOffsetX: null,
              bubbleBunnyEarsOffsetY: null,
              bubbleBunnyEarsZIndex: null,
            })
          }
          className="text-[10px] text-inkMuted hover:text-ink underline"
        >
          Dùng mặc định chung
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Bo góc — ${slotBubbleVal(slotLocal, slot, 'bubbleRadius', globalConfig, globalConfig.bubbleRadius ?? 14)}px`}>
          <input
            type="range"
            min={0}
            max={32}
            value={slotBubbleVal(slotLocal, slot, 'bubbleRadius', globalConfig, globalConfig.bubbleRadius ?? 14)}
            onChange={(e) => pushSlotUpdate(slot, { bubbleRadius: Number(e.target.value) })}
          />
        </Field>
        <Field label="Màu nền bubble">
          <input
            type="color"
            className="h-8 w-full rounded-lg border border-line bg-panelAlt"
            value={hex}
            onChange={(e) => pushSlotUpdate(slot, { bubbleBg: hexAlphaToRgba(e.target.value, alpha) })}
          />
        </Field>
        <Field label={`Độ trong nền — ${Math.round(alpha * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={alpha}
            onChange={(e) => pushSlotUpdate(slot, { bubbleBg: hexAlphaToRgba(hex, Number(e.target.value)) })}
          />
        </Field>
        <Field label={`Độ mờ bubble — ${Math.round(slotBubbleVal(slotLocal, slot, 'bubbleOpacity', globalConfig, globalConfig.bubbleOpacity ?? 1) * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={slotBubbleVal(slotLocal, slot, 'bubbleOpacity', globalConfig, globalConfig.bubbleOpacity ?? 1)}
            onChange={(e) => pushSlotUpdate(slot, { bubbleOpacity: Number(e.target.value) })}
          />
        </Field>
        <Field
          label={
            <span className="flex items-center gap-2">
              {`Độ dày viền — ${slotBubbleVal(slotLocal, slot, 'bubbleBorderWidth', globalConfig, 0)}px`}
              {!isSlotBubbleUserSet(slotLocal, slot, 'bubbleBorderWidth') && <PresetBadge />}
            </span>
          }
        >
          <input
            type="range"
            min={0}
            max={6}
            value={slotBubbleVal(slotLocal, slot, 'bubbleBorderWidth', globalConfig, 0)}
            onChange={(e) => pushSlotUpdate(slot, { bubbleBorderWidth: Number(e.target.value) })}
          />
        </Field>
        <Field label="Kiểu viền">
          <select
            className={inputClass}
            value={slotBubbleVal(slotLocal, slot, 'bubbleBorderStyle', globalConfig, 'solid')}
            onChange={(e) => pushSlotUpdate(slot, { bubbleBorderStyle: e.target.value })}
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
            value={slotBubbleVal(slotLocal, slot, 'bubbleBorderColor', globalConfig, globalConfig.textColor)}
            onChange={(e) => pushSlotUpdate(slot, { bubbleBorderColor: e.target.value })}
          />
        </Field>
        <Field label={`Padding ngang — ${padX}px`}>
          <input
            type="range"
            min={0}
            max={40}
            value={padX}
            onChange={(e) => pushSlotUpdate(slot, { bubblePaddingX: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Padding dọc — ${padY}px`}>
          <input
            type="range"
            min={0}
            max={40}
            value={padY}
            onChange={(e) => pushSlotUpdate(slot, { bubblePaddingY: Number(e.target.value) })}
          />
        </Field>
        <Field label="Shadow">
          <select
            className={inputClass}
            value={
              SHADOW_PRESETS.find((p) => p.value === slotBubbleVal(slotLocal, slot, 'bubbleBoxShadow', globalConfig, 'none'))?.id
              || (slotBubbleVal(slotLocal, slot, 'bubbleBoxShadow', globalConfig, null) ? 'custom' : 'none')
            }
            onChange={(e) => {
              const preset = SHADOW_PRESETS.find((p) => p.id === e.target.value);
              if (preset) pushSlotUpdate(slot, { bubbleBoxShadow: preset.value });
            }}
          >
            {SHADOW_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Tuỳ chỉnh</option>
          </select>
        </Field>

        <TextureFields
          localValue={textureVal}
          onChange={(patch) => pushSlotUpdate(slot, patch)}
          onReset={handleTextureReset}
        />

        <div className="col-span-2 border-t border-line/60 pt-3 grid grid-cols-2 gap-3">
          <Field label="Tai thỏ (Bunny Ears)">
            <select
              className={inputClass}
              value={
                slotLocal?.slots?.[slot]?.bubbleBunnyEars === true
                  ? 'true'
                  : slotLocal?.slots?.[slot]?.bubbleBunnyEars === false
                  ? 'false'
                  : 'default'
              }
              onChange={(e) => {
                const val = e.target.value;
                pushSlotUpdate(slot, {
                  bubbleBunnyEars: val === 'true' ? true : val === 'false' ? false : null,
                });
              }}
            >
              <option value="default">Kế thừa chung ({globalConfig.bubbleBunnyEars ? 'Bật' : 'Tắt'})</option>
              <option value="true">Bật</option>
              <option value="false">Tắt</option>
            </select>
          </Field>

          <Field label={`Độ rộng tối thiểu — ${slotBubbleVal(slotLocal, slot, 'bubbleMinWidth', globalConfig, globalConfig.bubbleMinWidth ?? 0)}px`}>
            <input
              type="range"
              min={0}
              max={320}
              step={10}
              value={slotBubbleVal(slotLocal, slot, 'bubbleMinWidth', globalConfig, globalConfig.bubbleMinWidth ?? 0)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleMinWidth: Number(e.target.value) })}
            />
          </Field>

          <Field label={`Chiều rộng tai — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsWidth', globalConfig, globalConfig.bubbleBunnyEarsWidth ?? 32)}px`}>
            <input
              type="range"
              min={8}
              max={80}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsWidth', globalConfig, globalConfig.bubbleBunnyEarsWidth ?? 32)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsWidth: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Chiều cao tai — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsHeight', globalConfig, globalConfig.bubbleBunnyEarsHeight ?? 30)}px`}>
            <input
              type="range"
              min={8}
              max={80}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsHeight', globalConfig, globalConfig.bubbleBunnyEarsHeight ?? 30)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsHeight: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Độ bo tròn — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsRoundness', globalConfig, globalConfig.bubbleBunnyEarsRoundness ?? 0)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsRoundness', globalConfig, globalConfig.bubbleBunnyEarsRoundness ?? 0)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsRoundness: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Vị trí X (cách mép) — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetX', globalConfig, globalConfig.bubbleBunnyEarsOffsetX ?? 20)}px`}>
            <input
              type="range"
              min={0}
              max={100}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetX', globalConfig, globalConfig.bubbleBunnyEarsOffsetX ?? 20)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsOffsetX: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Vị trí Y (nhô lên trên) — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetY', globalConfig, globalConfig.bubbleBunnyEarsOffsetY ?? 28)}px`}>
            <input
              type="range"
              min={0}
              max={100}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetY', globalConfig, globalConfig.bubbleBunnyEarsOffsetY ?? 28)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsOffsetY: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Vị trí Z (lớp hiển thị) — ${slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsZIndex', globalConfig, globalConfig.bubbleBunnyEarsZIndex ?? -1)}`}>
            <input
              type="range"
              min={-5}
              max={5}
              value={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsZIndex', globalConfig, globalConfig.bubbleBunnyEarsZIndex ?? -1)}
              onChange={(e) => pushSlotUpdate(slot, { bubbleBunnyEarsZIndex: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

export default function CustomizePanel({ api, config, slotStyleConfig }) {
  const [tab, setTab] = useState('global');
  const [local, setLocal] = useState(config);
  const [slotLocal, setSlotLocal] = useState(slotStyleConfig || { slots: {} });
  const debounceRef = useRef(null);
  const slotDebounceRef = useRef(null);

  useEffect(() => {
    setLocal(config);
  }, [config]);

  useEffect(() => {
    setSlotLocal(slotStyleConfig || { slots: {} });
  }, [slotStyleConfig]);

  function pushUpdate(partial) {
    setLocal((prev) => ({ ...prev, ...partial }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => api.updateConfig(partial), 100);
  }

  function pushSlotUpdate(slot, patch) {
    setSlotLocal((prev) => mergeSlot(prev, slot, patch));
    clearTimeout(slotDebounceRef.current);
    slotDebounceRef.current = setTimeout(() => {
      api.updateSlotStyle({ slots: { [slot]: patch } });
    }, 100);
  }

  if (!local) return null;

  const { hex: bubbleHex, alpha: bubbleAlpha } = rgbaToHexAlpha(local.bubbleBg);

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Tuỳ chỉnh</h2>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Reset toàn bộ tuỳ chỉnh về preset hiện tại?')) return;
            const result = await api.resetPreset?.();
            if (result?.ok) {
              setLocal(result.config);
              setSlotLocal(result.slotStyleConfig || { slots: {} });
            }
          }}
          className="shrink-0 px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
        >
          Reset preset
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 rounded-md text-xs ${
              tab === t.id ? 'bg-focusAccent text-white' : 'bg-panelAlt text-inkMuted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'global' && (
        <>
          <Field label="Font mặc định">
            <select
              className={inputClass}
              value={local.fontFamily}
              onChange={(e) => pushUpdate({ fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Cỡ chữ mặc định — ${local.fontSize}px`}>
              <input
                type="range"
                min={12}
                max={28}
                value={local.fontSize}
                onChange={(e) => pushUpdate({ fontSize: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Bo góc bubble — ${local.bubbleRadius}px`}>
              <input
                type="range"
                min={0}
                max={32}
                value={local.bubbleRadius}
                onChange={(e) => pushUpdate({ bubbleRadius: Number(e.target.value) })}
              />
            </Field>
            <Field label="Màu chữ mặc định">
              <input
                type="color"
                className="h-8 w-full rounded-lg border border-line bg-panelAlt"
                value={local.textColor}
                onChange={(e) => pushUpdate({ textColor: e.target.value })}
              />
            </Field>
            <Field label="Màu tên mặc định">
              <input
                type="color"
                className="h-8 w-full rounded-lg border border-line bg-panelAlt"
                value={local.authorColor}
                onChange={(e) => pushUpdate({ authorColor: e.target.value })}
              />
            </Field>
            <Field label="Màu nền bubble">
              <input
                type="color"
                className="h-8 w-full rounded-lg border border-line bg-panelAlt"
                value={bubbleHex}
                onChange={(e) => pushUpdate({ bubbleBg: hexAlphaToRgba(e.target.value, bubbleAlpha) })}
              />
            </Field>
            <Field label={`Độ trong nền — ${Math.round(bubbleAlpha * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bubbleAlpha}
                onChange={(e) => pushUpdate({ bubbleBg: hexAlphaToRgba(bubbleHex, Number(e.target.value)) })}
              />
            </Field>
            <Field label={`Độ mờ bubble — ${Math.round(local.bubbleOpacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={local.bubbleOpacity}
                onChange={(e) => pushUpdate({ bubbleOpacity: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Số tin tối đa — ${local.maxMessages}`}>
              <input
                type="range"
                min={5}
                max={100}
                value={local.maxMessages}
                onChange={(e) => pushUpdate({ maxMessages: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Tốc độ hiệu ứng — ${local.animationMs ?? 220}ms`}>
              <input
                type="range"
                min={0}
                max={800}
                step={20}
                value={local.animationMs ?? 220}
                onChange={(e) => pushUpdate({ animationMs: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <TextureFields
              localValue={{
                bubbleTextureUrl: local.bubbleTextureUrl,
                bubbleTextureSize: local.bubbleTextureSize,
                bubbleTextureRepeat: local.bubbleTextureRepeat,
                bubbleTextureOpacity: local.bubbleTextureOpacity,
              }}
              onChange={(patch) => pushUpdate(patch)}
            />
            <div className="col-span-2 border-t border-line/60 pt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center">
                <SlotToggle
                  label="Bật tai thỏ (Bunny Ears)"
                  checked={local.bubbleBunnyEars || false}
                  onChange={(e) => pushUpdate({ bubbleBunnyEars: e.target.checked })}
                />
              </div>

              <Field label={`Độ rộng tối thiểu của bubble — ${local.bubbleMinWidth ?? 0}px`}>
                <input
                  type="range"
                  min={0}
                  max={320}
                  step={10}
                  value={local.bubbleMinWidth ?? 0}
                  onChange={(e) => pushUpdate({ bubbleMinWidth: Number(e.target.value) })}
                />
              </Field>

              <Field label={`Chiều rộng tai — ${local.bubbleBunnyEarsWidth ?? 32}px`}>
                <input
                  type="range"
                  min={8}
                  max={80}
                  value={local.bubbleBunnyEarsWidth ?? 32}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsWidth: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Chiều cao tai — ${local.bubbleBunnyEarsHeight ?? 30}px`}>
                <input
                  type="range"
                  min={8}
                  max={80}
                  value={local.bubbleBunnyEarsHeight ?? 30}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsHeight: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Độ bo tròn — ${local.bubbleBunnyEarsRoundness ?? 0}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local.bubbleBunnyEarsRoundness ?? 0}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsRoundness: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Vị trí X (cách mép) — ${local.bubbleBunnyEarsOffsetX ?? 20}px`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local.bubbleBunnyEarsOffsetX ?? 20}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsOffsetX: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Vị trí Y (nhô lên trên) — ${local.bubbleBunnyEarsOffsetY ?? 28}px`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={local.bubbleBunnyEarsOffsetY ?? 28}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsOffsetY: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Vị trí Z (lớp hiển thị) — ${local.bubbleBunnyEarsZIndex ?? -1}`}>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  value={local.bubbleBunnyEarsZIndex ?? -1}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsZIndex: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Độ nghiêng — ${local.bubbleBunnyEarsRotate ?? 0}°`}>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  value={local.bubbleBunnyEarsRotate ?? 0}
                  onChange={(e) => pushUpdate({ bubbleBunnyEarsRotate: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>

          <Field label="Vị trí tin mới">
            <select
              className={inputClass}
              value={local.position}
              onChange={(e) => pushUpdate({ position: e.target.value })}
            >
              <option value="bottom-up">Tin mới ở dưới</option>
              <option value="top-down">Tin mới ở trên</option>
            </select>
          </Field>

          <div className="border-t border-line pt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-inkMuted uppercase tracking-wide">Bubble cả tin nhắn</h3>
              <button
                type="button"
                onClick={() =>
                  pushUpdate({
                    bubbleBorderWidth: null,
                    bubbleBorderStyle: null,
                    bubbleBorderColor: null,
                    bubbleBoxShadow: null,
                    bubblePadding: null,
                    bubblePaddingX: null,
                    bubblePaddingY: null,
                  })
                }
                className="text-[10px] text-inkMuted hover:text-ink underline"
              >
                Dùng preset
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <PresetButton
                label="Viền đứt khúc"
                onClick={() => pushUpdate({ bubbleBorderStyle: 'dashed', bubbleBorderWidth: 2 })}
              />
              <PresetButton
                label="Không viền"
                onClick={() => pushUpdate({ bubbleBorderStyle: 'none', bubbleBorderWidth: 0 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  <span className="flex items-center gap-2">
                    {`Độ dày viền — ${configVal(local, 'bubbleBorderWidth', 0)}px`}
                    {!isUserSet(local, 'bubbleBorderWidth') && <PresetBadge />}
                  </span>
                }
              >
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={configVal(local, 'bubbleBorderWidth', 0)}
                  onChange={(e) => pushUpdate({ bubbleBorderWidth: Number(e.target.value) })}
                />
              </Field>
              <Field label="Kiểu viền">
                <select
                  className={inputClass}
                  value={configVal(local, 'bubbleBorderStyle', 'solid')}
                  onChange={(e) => pushUpdate({ bubbleBorderStyle: e.target.value })}
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
                  value={configVal(local, 'bubbleBorderColor', local.textColor)}
                  onChange={(e) => pushUpdate({ bubbleBorderColor: e.target.value })}
                />
              </Field>
              <Field label={`Padding ngang — ${configVal(local, 'bubblePaddingX', configVal(local, 'bubblePadding', 14))}px`}>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={configVal(local, 'bubblePaddingX', configVal(local, 'bubblePadding', 14))}
                  onChange={(e) => pushUpdate({ bubblePaddingX: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Padding dọc — ${configVal(local, 'bubblePaddingY', configVal(local, 'bubblePadding', 10))}px`}>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={configVal(local, 'bubblePaddingY', configVal(local, 'bubblePadding', 10))}
                  onChange={(e) => pushUpdate({ bubblePaddingY: Number(e.target.value) })}
                />
              </Field>
              <Field label="Shadow">
                <select
                  className={inputClass}
                  value={
                    SHADOW_PRESETS.find((p) => p.value === local.bubbleBoxShadow)?.id ||
                    (local.bubbleBoxShadow ? 'custom' : 'none')
                  }
                  onChange={(e) => {
                    const preset = SHADOW_PRESETS.find((p) => p.id === e.target.value);
                    if (preset) pushUpdate({ bubbleBoxShadow: preset.value });
                  }}
                >
                  {SHADOW_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Tuỳ chỉnh</option>
                </select>
              </Field>
              <Field label="Shadow tuỳ chỉnh (CSS)">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="0 4px 14px rgba(0,0,0,0.25)"
                  value={configVal(local, 'bubbleBoxShadow', '')}
                  onChange={(e) => pushUpdate({ bubbleBoxShadow: e.target.value || null })}
                />
              </Field>
            </div>
          </div>
        </>
      )}

      {tab === 'avatar' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SlotToggle
              label="Hiện avatar"
              checked={slotVal(slotLocal, 'avatar', 'visible', local.showAvatar)}
              onChange={(e) => pushSlotUpdate('avatar', { visible: e.target.checked })}
            />
            <Field label={`Cỡ — ${slotVal(slotLocal, 'avatar', 'size', local.avatarSize)}px`}>
              <input
                type="range"
                min={0}
                max={56}
                value={slotVal(slotLocal, 'avatar', 'size', local.avatarSize)}
                onChange={(e) => pushSlotUpdate('avatar', { size: Number(e.target.value) })}
              />
            </Field>
            <Field
              label={`Bo góc — ${
                typeof slotVal(slotLocal, 'avatar', 'borderRadius', null) === 'string'
                  ? slotVal(slotLocal, 'avatar', 'borderRadius', '50%')
                  : `${slotVal(slotLocal, 'avatar', 'borderRadius', 50)}%`
              }`}
            >
              <input
                type="range"
                min={0}
                max={50}
                value={
                  typeof slotVal(slotLocal, 'avatar', 'borderRadius', null) === 'string'
                    ? 50
                    : slotVal(slotLocal, 'avatar', 'borderRadius', 50)
                }
                onChange={(e) => pushSlotUpdate('avatar', { borderRadius: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'avatar', 'opacity', 1) * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={slotVal(slotLocal, 'avatar', 'opacity', 1)}
                onChange={(e) => pushSlotUpdate('avatar', { opacity: Number(e.target.value) })}
              />
            </Field>
            <TransformFields slotLocal={slotLocal} slot="avatar" pushSlotUpdate={pushSlotUpdate} />
          </div>

          <div className="border-t border-line pt-3 flex flex-col gap-3">
            <h3 className="text-xs font-medium text-inkMuted uppercase tracking-wide">Viền avatar</h3>
            <div className="flex flex-wrap gap-2">
              <PresetButton
                label="Bo tròn"
                onClick={() => pushSlotUpdate('avatar', { borderRadius: '50%', borderStyle: 'none', borderWidth: 0 })}
              />
              <PresetButton
                label="Khung vuông"
                onClick={() => pushSlotUpdate('avatar', { borderRadius: 0, borderStyle: 'solid', borderWidth: 2 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Độ dày viền — ${slotVal(slotLocal, 'avatar', 'borderWidth', 0)}px`}>
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={slotVal(slotLocal, 'avatar', 'borderWidth', 0)}
                  onChange={(e) => pushSlotUpdate('avatar', { borderWidth: Number(e.target.value) })}
                />
              </Field>
              <Field label="Kiểu viền">
                <select
                  className={inputClass}
                  value={slotVal(slotLocal, 'avatar', 'borderStyle', 'solid')}
                  onChange={(e) => pushSlotUpdate('avatar', { borderStyle: e.target.value })}
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
                  value={slotVal(slotLocal, 'avatar', 'borderColor', local.authorColor)}
                  onChange={(e) => pushSlotUpdate('avatar', { borderColor: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {tab === 'author' && (
        <div className="grid grid-cols-2 gap-3">
          <SlotToggle
            label="Hiện tên"
            checked={slotVal(slotLocal, 'author', 'visible', true)}
            onChange={(e) => pushSlotUpdate('author', { visible: e.target.checked })}
          />
          <Field label="Font">
            <select
              className={inputClass}
              value={slotVal(slotLocal, 'author', 'fontFamily', local.fontFamily)}
              onChange={(e) => pushSlotUpdate('author', { fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Cỡ — ${slotVal(slotLocal, 'author', 'fontSize', Math.round(local.fontSize * 0.9))}px`}>
            <input
              type="range"
              min={10}
              max={28}
              value={slotVal(slotLocal, 'author', 'fontSize', Math.round(local.fontSize * 0.9))}
              onChange={(e) => pushSlotUpdate('author', { fontSize: Number(e.target.value) })}
            />
          </Field>
          <Field label="Màu">
            <input
              type="color"
              className="h-8 w-full rounded-lg border border-line bg-panelAlt"
              value={slotVal(slotLocal, 'author', 'color', local.authorColor)}
              onChange={(e) => pushSlotUpdate('author', { color: e.target.value })}
            />
          </Field>
          <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'author', 'opacity', 1) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={slotVal(slotLocal, 'author', 'opacity', 1)}
              onChange={(e) => pushSlotUpdate('author', { opacity: Number(e.target.value) })}
            />
          </Field>
          <TransformFields slotLocal={slotLocal} slot="author" pushSlotUpdate={pushSlotUpdate} />
          <SlotBubbleFields
            title="Bubble tên (bọc riêng)"
            slot="author"
            slotLocal={slotLocal}
            globalConfig={local}
            pushSlotUpdate={pushSlotUpdate}
          />
        </div>
      )}

      {tab === 'message' && (
        <div className="grid grid-cols-2 gap-3">
          <SlotToggle
            label="Hiện nội dung"
            checked={slotVal(slotLocal, 'message', 'visible', true)}
            onChange={(e) => pushSlotUpdate('message', { visible: e.target.checked })}
          />
          <Field label="Font">
            <select
              className={inputClass}
              value={slotVal(slotLocal, 'message', 'fontFamily', local.fontFamily)}
              onChange={(e) => pushSlotUpdate('message', { fontFamily: e.target.value })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Cỡ — ${slotVal(slotLocal, 'message', 'fontSize', local.fontSize)}px`}>
            <input
              type="range"
              min={10}
              max={32}
              value={slotVal(slotLocal, 'message', 'fontSize', local.fontSize)}
              onChange={(e) => pushSlotUpdate('message', { fontSize: Number(e.target.value) })}
            />
          </Field>
          <Field label="Màu">
            <input
              type="color"
              className="h-8 w-full rounded-lg border border-line bg-panelAlt"
              value={slotVal(slotLocal, 'message', 'color', local.textColor)}
              onChange={(e) => pushSlotUpdate('message', { color: e.target.value })}
            />
          </Field>
          <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'message', 'opacity', 1) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={slotVal(slotLocal, 'message', 'opacity', 1)}
              onChange={(e) => pushSlotUpdate('message', { opacity: Number(e.target.value) })}
            />
          </Field>
          <TransformFields slotLocal={slotLocal} slot="message" pushSlotUpdate={pushSlotUpdate} />
          <SlotBubbleFields
            title="Bubble nội dung (bọc riêng)"
            slot="message"
            slotLocal={slotLocal}
            globalConfig={local}
            pushSlotUpdate={pushSlotUpdate}
          />
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-2 gap-3">
          <SlotToggle
            label="Hiện badge"
            checked={slotVal(slotLocal, 'badges', 'visible', local.showBadges)}
            onChange={(e) => pushSlotUpdate('badges', { visible: e.target.checked })}
          />
          <Field label={`Cỡ — ${slotVal(slotLocal, 'badges', 'fontSize', Math.round(local.fontSize * 0.65))}px`}>
            <input
              type="range"
              min={8}
              max={20}
              value={slotVal(slotLocal, 'badges', 'fontSize', Math.round(local.fontSize * 0.65))}
              onChange={(e) => pushSlotUpdate('badges', { fontSize: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'badges', 'opacity', 1) * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={slotVal(slotLocal, 'badges', 'opacity', 1)}
              onChange={(e) => pushSlotUpdate('badges', { opacity: Number(e.target.value) })}
            />
          </Field>
          <TransformFields slotLocal={slotLocal} slot="badges" pushSlotUpdate={pushSlotUpdate} />
        </div>
      )}
    </section>
  );
}