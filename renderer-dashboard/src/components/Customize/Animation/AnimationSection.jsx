import { Field, inputClass } from '../shared/fields.jsx';

// Keep in sync with shared/animation-config.js#ANIMATION_STYLE_PRESETS.
const ANIMATION_STYLE_OPTIONS = [
  { value: 'slide', label: 'Trượt nhẹ (mặc định)' },
  { value: 'bounce', label: 'Nảy' },
  { value: 'zoom', label: 'Phóng to' },
  { value: 'slideStrong', label: 'Trượt ngang mạnh' },
  { value: 'blurZoom', label: 'Mờ dần + zoom' },
];

export default function AnimationSection({ local, onChange, animLocal, onAnimationChange }) {
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
      <div className="col-span-2">
        <Field label="Kiểu hiệu ứng xuất hiện">
          <select
            className={inputClass}
            value={animLocal?.style ?? 'slide'}
            onChange={(e) => onAnimationChange?.({ style: e.target.value })}
          >
            {ANIMATION_STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
