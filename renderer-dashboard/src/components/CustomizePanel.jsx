import { useEffect, useRef, useState } from 'react';

const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (mặc định)' },
  { value: '"Space Grotesk", system-ui, sans-serif', label: 'Space Grotesk' },
  { value: 'ui-monospace, "JetBrains Mono", monospace', label: 'Mono' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
];

// bubbleBg is stored as a single rgba() string end-to-end (that's what the
// theme's CSS variable expects) but a color-picker input needs a plain hex
// value + a separate alpha slider — these two helpers bridge that gap.
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

export default function CustomizePanel({ api, config }) {
  const [local, setLocal] = useState(config);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocal(config);
  }, [config]);

  function pushUpdate(partial) {
    setLocal((prev) => ({ ...prev, ...partial }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.updateConfig(partial);
    }, 100);
  }

  if (!local) return null;

  const { hex: bubbleHex, alpha: bubbleAlpha } = rgbaToHexAlpha(local.bubbleBg);

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Tuỳ chỉnh</h2>

      <Field label="Font chữ">
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
        <Field label={`Cỡ chữ — ${local.fontSize}px`}>
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

        <Field label="Màu chữ">
          <input
            type="color"
            className="h-8 w-full rounded-lg border border-line bg-panelAlt"
            value={local.textColor}
            onChange={(e) => pushUpdate({ textColor: e.target.value })}
          />
        </Field>

        <Field label="Màu tên người chat">
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

        <Field label={`Độ mờ toàn bubble — ${Math.round(local.bubbleOpacity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={local.bubbleOpacity}
            onChange={(e) => pushUpdate({ bubbleOpacity: Number(e.target.value) })}
          />
        </Field>

        <Field label={`Cỡ avatar — ${local.avatarSize}px`}>
          <input
            type="range"
            min={0}
            max={56}
            value={local.avatarSize}
            onChange={(e) => pushUpdate({ avatarSize: Number(e.target.value) })}
          />
        </Field>

        <Field label={`Tốc độ animation — ${local.animationMs}ms`}>
          <input
            type="range"
            min={0}
            max={600}
            step={20}
            value={local.animationMs}
            onChange={(e) => pushUpdate({ animationMs: Number(e.target.value) })}
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
      </div>

      <Field label="Vị trí tin mới">
        <select
          className={inputClass}
          value={local.position}
          onChange={(e) => pushUpdate({ position: e.target.value })}
        >
          <option value="bottom-up">Tin mới ở dưới, trôi lên</option>
          <option value="top-down">Tin mới ở trên, trôi xuống</option>
        </select>
      </Field>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={local.showAvatar}
            onChange={(e) => pushUpdate({ showAvatar: e.target.checked })}
            className="accent-focusAccent"
          />
          Hiện avatar
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={local.showBadges}
            onChange={(e) => pushUpdate({ showBadges: e.target.checked })}
            className="accent-focusAccent"
          />
          Hiện badge
        </label>
      </div>
    </section>
  );
}
