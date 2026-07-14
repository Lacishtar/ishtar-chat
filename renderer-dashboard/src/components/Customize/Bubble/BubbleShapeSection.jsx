import { Field } from '../shared/fields.jsx';

export default function BubbleShapeSection({
  radius,
  opacity,
  padTop,
  padRight,
  padBottom,
  padLeft,
  onChange,
}) {
  const applyToAllSides = (value) =>
    onChange({ padTop: value, padRight: value, padBottom: value, padLeft: value });

  return (
    <>
      <Field label={`Bo góc — ${radius}px`}>
        <input type="range" min={0} max={32} value={radius} onChange={(e) => onChange({ radius: Number(e.target.value) })} />
      </Field>
      <Field label={`Độ mờ bubble — ${Math.round(opacity * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
        />
      </Field>

      <div className="col-span-2 flex items-center justify-between">
        <span className="text-xs text-inkMuted">Padding — khoảng đệm 4 cạnh trong bubble</span>
        <button
          type="button"
          onClick={() => applyToAllSides(padTop)}
          className="text-[10px] text-inkMuted hover:text-ink underline shrink-0"
          title="Đặt padding trên/phải/dưới/trái bằng nhau (dùng giá trị Padding trên hiện tại)"
        >
          Áp dụng đều 4 cạnh
        </button>
      </div>
      <Field label={`Padding trên — ${padTop}px`}>
        <input type="range" min={0} max={40} value={padTop} onChange={(e) => onChange({ padTop: Number(e.target.value) })} />
      </Field>
      <Field label={`Padding phải — ${padRight}px`}>
        <input type="range" min={0} max={40} value={padRight} onChange={(e) => onChange({ padRight: Number(e.target.value) })} />
      </Field>
      <Field label={`Padding dưới — ${padBottom}px`}>
        <input type="range" min={0} max={40} value={padBottom} onChange={(e) => onChange({ padBottom: Number(e.target.value) })} />
      </Field>
      <Field label={`Padding trái — ${padLeft}px`}>
        <input type="range" min={0} max={40} value={padLeft} onChange={(e) => onChange({ padLeft: Number(e.target.value) })} />
      </Field>
    </>
  );
}
