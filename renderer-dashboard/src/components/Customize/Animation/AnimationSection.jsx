import { Field, inputClass } from '../shared/fields.jsx';

export default function AnimationSection({ local, onChange }) {
  return (
    <>
      <div className="col-span-2">
        <Field label="Vị trí tin mới">
          <select className={inputClass} value={local.position} onChange={(e) => onChange({ position: e.target.value })}>
            <option value="bottom-up">Tin mới ở dưới</option>
            <option value="top-down">Tin mới ở trên</option>
          </select>
        </Field>
      </div>
      <Field label={`Số tin tối đa — ${local.maxMessages}`}>
        <input
          type="range"
          min={5}
          max={100}
          value={local.maxMessages}
          onChange={(e) => onChange({ maxMessages: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Tốc độ hiệu ứng — ${local.animationMs ?? 220}ms`}>
        <input
          type="range"
          min={0}
          max={800}
          step={20}
          value={local.animationMs ?? 220}
          onChange={(e) => onChange({ animationMs: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}
