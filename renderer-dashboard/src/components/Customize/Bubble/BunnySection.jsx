import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';

export default function BunnySection({
  // Either pass `enabled` + `onToggle` (global, plain boolean)…
  enabled,
  onToggle,
  // …or pass `triState` ('default' | 'true' | 'false') + `onTriStateChange` (per-slot, inherits from global)
  triState,
  onTriStateChange,
  inheritedLabel,
  width,
  height,
  roundness,
  offsetX,
  offsetY,
  zIndex,
  rotate,
  onChange,
}) {
  const isOn = triState !== undefined ? triState === 'true' : !!enabled;

  return (
    <>
      <div className="col-span-2">
        {triState !== undefined ? (
          <Field label="Tai thỏ (Bunny Ears)">
            <select className={inputClass} value={triState} onChange={(e) => onTriStateChange(e.target.value)}>
              <option value="default">Kế thừa chung ({inheritedLabel})</option>
              <option value="true">Bật</option>
              <option value="false">Tắt</option>
            </select>
          </Field>
        ) : (
          <EnableToggle label="Bật tai thỏ (Bunny Ears)" checked={enabled} onChange={onToggle} />
        )}
      </div>

      {isOn && (
        <>
          <Field label={`Chiều rộng tai — ${width}px`}>
            <input type="range" min={8} max={80} value={width} onChange={(e) => onChange({ width: Number(e.target.value) })} />
          </Field>
          <Field label={`Chiều cao tai — ${height}px`}>
            <input type="range" min={8} max={80} value={height} onChange={(e) => onChange({ height: Number(e.target.value) })} />
          </Field>
          <Field label={`Độ bo tròn — ${roundness}%`}>
            <input type="range" min={0} max={100} value={roundness} onChange={(e) => onChange({ roundness: Number(e.target.value) })} />
          </Field>
          <Field label={`Vị trí X (cách mép) — ${offsetX}px`}>
            <input type="range" min={0} max={100} value={offsetX} onChange={(e) => onChange({ offsetX: Number(e.target.value) })} />
          </Field>
          <Field label={`Vị trí Y (nhô lên trên) — ${offsetY}px`}>
            <input type="range" min={0} max={100} value={offsetY} onChange={(e) => onChange({ offsetY: Number(e.target.value) })} />
          </Field>
          <Field label={`Vị trí Z (lớp hiển thị) — ${zIndex}`}>
            <input type="range" min={-5} max={5} value={zIndex} onChange={(e) => onChange({ zIndex: Number(e.target.value) })} />
          </Field>
          {rotate !== undefined && (
            <Field label={`Độ nghiêng — ${rotate}°`}>
              <input type="range" min={-45} max={45} value={rotate} onChange={(e) => onChange({ rotate: Number(e.target.value) })} />
            </Field>
          )}
        </>
      )}
    </>
  );
}
