import { Field, inputClass } from '../shared/fields.jsx';
import { ANIMATION_STYLE_PRESETS } from '../../../../../shared/animation-config.js';

// Built straight from ANIMATION_STYLE_PRESETS (which already carries a
// Vietnamese `label` per style), so the dropdown can never drift out of sync
// with the set of styles the compiler actually understands.
const ANIMATION_STYLE_OPTIONS = Object.entries(ANIMATION_STYLE_PRESETS).map(([value, preset]) => ({
  value,
  label: value === 'slide' ? `${preset.label} (mặc định)` : preset.label,
}));

export default function AnimationSection({ local, onChange, animLocal, onAnimationChange }) {
  const displayMode = local.displayMode === 'danmaku' ? 'danmaku' : 'stack';
  const isDanmaku = displayMode === 'danmaku';

  return (
    <>
      <div className="col-span-2">
        <Field label="Kiểu hiển thị chat">
          <select className={inputClass} value={displayMode} onChange={(e) => onChange({ displayMode: e.target.value })}>
            <option value="stack">Xếp chồng (mặc định)</option>
            <option value="danmaku">Đạn bay (Danmaku) — bay ngang màn hình</option>
          </select>
        </Field>
      </div>
      {isDanmaku ? (
        <>
          <Field label={`Tốc độ bay — x${(local.danmakuSpeed ?? 1).toFixed(1)}`}>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={local.danmakuSpeed ?? 1}
              onChange={(e) => onChange({ danmakuSpeed: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Số làn (lanes) — ${local.danmakuLanes ?? 12}`}>
            <input
              type="range"
              min={3}
              max={30}
              value={local.danmakuLanes ?? 12}
              onChange={(e) => onChange({ danmakuLanes: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Chừa trống phía trên — ${local.danmakuAreaTopPct ?? 4}%`}>
            <input
              type="range"
              min={0}
              max={40}
              value={local.danmakuAreaTopPct ?? 4}
              onChange={(e) => onChange({ danmakuAreaTopPct: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Chừa trống phía dưới — ${local.danmakuAreaBottomPct ?? 4}%`}>
            <input
              type="range"
              min={0}
              max={40}
              value={local.danmakuAreaBottomPct ?? 4}
              onChange={(e) => onChange({ danmakuAreaBottomPct: Number(e.target.value) })}
            />
          </Field>
        </>
      ) : (
        <div className="col-span-2">
          <Field label="Vị trí tin mới">
            <select className={inputClass} value={local.position} onChange={(e) => onChange({ position: e.target.value })}>
              <option value="bottom-up">Tin mới ở dưới</option>
              <option value="top-down">Tin mới ở trên</option>
            </select>
          </Field>
        </div>
      )}
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
