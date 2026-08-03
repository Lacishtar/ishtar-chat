import { useEffect, useRef, useState } from 'react';
import {
  parseAnyColor,
  hexAlphaToRgba,
  isGradient,
  parseGradient,
  serializeGradient,
  defaultGradientFrom,
  parseColorInputStrict,
} from './colorUtils.js';

const tabBtn = (active) =>
  `px-2 py-1 rounded text-[11px] font-medium transition-colors ${
    active ? 'bg-focusAccent text-white' : 'text-inkMuted hover:text-ink'
  }`;

// Text field for typing/pasting a hex (or rgba) color code. The native
// `<input type="color">` swatch can't be typed or pasted into, so this is
// the only way to paste a color code straight in. Keeps its own draft text
// while focused so partial input (e.g. "#1a") isn't clobbered by re-renders,
// and only calls onCommit once the text parses to a valid color.
function HexInput({ hex, alpha, onCommit, className = '' }) {
  const [draft, setDraft] = useState(hex);
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(hex);
  }, [hex]);

  function tryCommit(text) {
    const parsed = parseColorInputStrict(text);
    if (!parsed) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    onCommit(parsed);
    return true;
  }

  return (
    <input
      type="text"
      value={draft}
      spellCheck={false}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text');
        // Let the paste land in the field, then try to commit it.
        setTimeout(() => tryCommit(text), 0);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={(e) => {
        focused.current = false;
        if (!tryCommit(e.target.value)) {
          // Revert to the last valid color instead of leaving bad text sitting.
          setDraft(hex);
          setInvalid(false);
        }
      }}
      placeholder="#RRGGBB"
      title="Dán hoặc gõ mã màu (hex hoặc rgba)"
      className={`min-w-0 rounded-md border bg-panelAlt px-1.5 py-1 text-[11px] font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-focusAccent ${
        invalid ? 'border-red-400 text-red-400' : 'border-line text-ink'
      } ${className}`}
    />
  );
}

// Unified color picker used everywhere in the Customize panel.
// - "Màu đơn" (solid): hex + alpha slider → always outputs `rgba(r, g, b, a)`.
export default function ColorPicker({ value, onChange, allowGradient = true }) {
  const lastEmitted = useRef(value);
  const [mode, setMode] = useState(allowGradient && isGradient(value) ? 'gradient' : 'solid');
  const [gradient, setGradient] = useState(() => parseGradient(value) || defaultGradientFrom(value));

  // Re-sync only when `value` changes for a reason other than us echoing it
  // back (theme preset applied, undo/redo, switching selected object, etc.).
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (!allowGradient) {
      setMode('solid');
      return;
    }
    if (isGradient(value)) {
      setMode('gradient');
      setGradient(parseGradient(value) || defaultGradientFrom(value));
    } else {
      setMode('solid');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allowGradient]);

  function emit(nextValue) {
    lastEmitted.current = nextValue;
    onChange(nextValue);
  }

  function switchToSolid() {
    const first = gradient.stops[0];
    setMode('solid');
    emit(hexAlphaToRgba(first.hex, first.alpha));
  }

  function switchToGradient() {
    const g = defaultGradientFrom(value);
    setGradient(g);
    setMode('gradient');
    emit(serializeGradient(g));
  }

  function commitGradient(patch) {
    const next = { ...gradient, ...patch };
    setGradient(next);
    emit(serializeGradient(next));
  }

  if (mode === 'gradient' && allowGradient) {
    const { stops } = gradient;

    const updateStop = (id, patch) =>
      commitGradient({ stops: stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    const addStop = () => {
      const last = stops[stops.length - 1];
      commitGradient({
        stops: [
          ...stops,
          { id: `stop-${Date.now()}`, hex: last?.hex || '#ffffff', alpha: last?.alpha ?? 1, position: 100 },
        ],
      });
    };
    const removeStop = (id) => {
      if (stops.length <= 2) return;
      commitGradient({ stops: stops.filter((s) => s.id !== id) });
    };

    return (
      <div key="gradient" className="flex flex-col gap-2 rounded-lg border border-line bg-panelAlt/60 p-2.5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 p-0.5 rounded-md bg-panelAlt border border-line">
            <button type="button" className={tabBtn(false)} onClick={switchToSolid}>
              Màu đơn
            </button>
            <button type="button" className={tabBtn(true)}>
              Chuyển sắc
            </button>
          </div>
          <select
            className="text-[11px] rounded-md bg-panelAlt border border-line px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-focusAccent"
            value={gradient.type}
            onChange={(e) => commitGradient({ type: e.target.value })}
          >
            <option value="linear">Thẳng (linear)</option>
            <option value="radial">Toả tròn (radial)</option>
          </select>
        </div>

        <div
          className="h-8 w-full rounded-lg border border-line"
          style={{ background: serializeGradient(gradient) }}
        />

        {gradient.type === 'linear' && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-inkMuted">Góc gradient — {Math.round(gradient.angle)}°</span>
            <input
              type="range"
              min={0}
              max={360}
              value={gradient.angle}
              onChange={(e) => commitGradient({ angle: Number(e.target.value) })}
            />
          </label>
        )}

        <div className="flex flex-col gap-2">
          {stops.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-1 rounded-md border border-line/60 bg-panel/40 p-1.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={s.hex}
                  onChange={(e) => updateStop(s.id, { hex: e.target.value })}
                  className="h-7 w-8 shrink-0 rounded border border-line bg-panelAlt cursor-pointer"
                  title="Màu"
                />
                <HexInput
                  hex={s.hex}
                  alpha={s.alpha}
                  onCommit={(parsed) => updateStop(s.id, { hex: parsed.hex, alpha: parsed.alpha })}
                  className="w-20 h-7 shrink-0"
                />
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] text-inkMuted">Độ trong suốt — {Math.round(s.alpha * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={s.alpha}
                    onChange={(e) => updateStop(s.id, { alpha: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <span className="shrink-0 text-[10px] text-inkMuted">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeStop(s.id)}
                  disabled={stops.length <= 2}
                  className="shrink-0 px-1 text-[11px] text-inkMuted hover:text-red-400 disabled:opacity-30"
                  title="Xoá điểm màu"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 w-16 text-[10px] text-inkMuted">Vị trí — {Math.round(s.position)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={s.position}
                  onChange={(e) => updateStop(s.id, { position: Number(e.target.value) })}
                  className="flex-1 min-w-0"
                  title={`Vị trí — ${Math.round(s.position)}%`}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStop}
          className="self-start rounded-md border border-line bg-panelAlt px-2 py-1 text-[11px] text-inkMuted hover:bg-line"
        >
          + Thêm điểm màu
        </button>
      </div>
    );
  }

  const { hex, alpha } = parseAnyColor(value);

  return (
    <div key="solid" className="flex flex-col gap-2 min-w-0">
      {allowGradient && (
        <div className="flex flex-wrap gap-1 self-start rounded-md border border-line bg-panelAlt p-0.5">
          <button type="button" className={tabBtn(true)}>
            Màu đơn
          </button>
          <button type="button" className={tabBtn(false)} onClick={switchToGradient}>
            Chuyển sắc
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="color"
          value={hex}
          onChange={(e) => emit(hexAlphaToRgba(e.target.value, alpha))}
          className="h-8 w-14 shrink-0 rounded-lg border border-line bg-panelAlt cursor-pointer"
        />
        <HexInput
          hex={hex}
          alpha={alpha}
          onCommit={(parsed) => emit(hexAlphaToRgba(parsed.hex, parsed.alpha))}
          className="w-24 h-8"
        />
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <span className="text-[10px] text-inkMuted">Độ trong suốt — {Math.round(alpha * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={alpha}
            onChange={(e) => emit(hexAlphaToRgba(hex, Number(e.target.value)))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
