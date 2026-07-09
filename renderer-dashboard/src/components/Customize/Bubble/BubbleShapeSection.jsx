import { Field } from '../shared/fields.jsx';

export default function BubbleShapeSection({ radius, opacity, padX, padY, minWidth, onChange }) {
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
      <Field label={`Padding ngang — ${padX}px`}>
        <input type="range" min={0} max={40} value={padX} onChange={(e) => onChange({ padX: Number(e.target.value) })} />
      </Field>
      <Field label={`Padding dọc — ${padY}px`}>
        <input type="range" min={0} max={40} value={padY} onChange={(e) => onChange({ padY: Number(e.target.value) })} />
      </Field>
      {minWidth !== undefined && (
        <div className="col-span-2">
          <Field label={`Độ rộng tối thiểu — ${minWidth}px`}>
            <input
              type="range"
              min={0}
              max={320}
              step={10}
              value={minWidth}
              onChange={(e) => onChange({ minWidth: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}
    </>
  );
}
