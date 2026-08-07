import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { ANIMATION_STYLE_PRESETS } from '../../../../../shared/animation-config.js';

const ANIMATION_STYLE_OPTIONS = Object.entries(ANIMATION_STYLE_PRESETS).map(([value, preset]) => ({
  value,
  label: value === 'slide' ? `${preset.label} (mặc định)` : preset.label,
}));

export default function AnimationSection({ local, onChange, animLocal, onAnimationChange }) {
  const displayMode = ['danmaku', 'ticker', 'horizontal-bar'].includes(local.displayMode) ? local.displayMode : 'stack';
  const isDanmaku = displayMode === 'danmaku';
  const isTicker = displayMode === 'ticker';
  const isHorizontalBar = displayMode === 'horizontal-bar';

  return (
    <>
      <div className="col-span-2">
        <Field label="Kiểu hiển thị chat">
          <select className={inputClass} value={displayMode} onChange={(e) => onChange({ displayMode: e.target.value })}>
            <option value="stack">Xếp chồng (mặc định)</option>
            <option value="danmaku">Đạn bay (Danmaku) — bay tự do trên màn hình</option>
            <option value="ticker">Chat Ticker — cuộn ngang nối đuôi có hàng đợi (Queue)</option>
            <option value="horizontal-bar">Horizontal Bar — xếp chồng theo hàng ngang, tin mới đẩy tin cũ ra khỏi màn hình</option>
          </select>
        </Field>
      </div>
      {isDanmaku ? (
        <>
          <Field label={`Tốc độ bay — x${(local.danmakuSpeed ?? 1).toFixed(1)}`}>
            <input
              type="range"
              min={0.1}
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
      ) : isTicker ? (
        <>
          <Field label={`Tốc độ cuộn Ticker — x${(local.tickerSpeed ?? 1).toFixed(1)}`}>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={local.tickerSpeed ?? 1}
              onChange={(e) => onChange({ tickerSpeed: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Khoảng cách tin nhắn — ${local.tickerGap ?? 32}px`}>
            <input
              type="range"
              min={12}
              max={120}
              step={4}
              value={local.tickerGap ?? 32}
              onChange={(e) => onChange({ tickerGap: Number(e.target.value) })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Vị trí thanh Ticker">
              <select
                className={inputClass}
                value={local.tickerPosition ?? 'bottom'}
                onChange={(e) => onChange({ tickerPosition: e.target.value })}
              >
                <option value="bottom">Cạnh dưới màn hình (Bottom)</option>
                <option value="top">Cạnh trên màn hình (Top)</option>
              </select>
            </Field>
          </div>
        </>
      ) : isHorizontalBar ? (
        <>
          <div className="col-span-2">
            <Field label="Vị trí thanh Horizontal Bar">
              <select
                className={inputClass}
                value={local.horizontalBarPosition ?? 'bottom'}
                onChange={(e) => onChange({ horizontalBarPosition: e.target.value })}
              >
                <option value="bottom">Cạnh dưới màn hình (Bottom)</option>
                <option value="top">Cạnh trên màn hình (Top)</option>
              </select>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Vị trí tin mới">
              <select className={inputClass} value={local.position} onChange={(e) => onChange({ position: e.target.value })}>
                <option value="bottom-up">Tin mới bên phải</option>
                <option value="top-down">Tin mới bên trái</option>
              </select>
            </Field>
          </div>
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
      {/* Pool Size (Warmup) — ẩn khỏi UI theo yêu cầu; giá trị local.poolWarmupSize
          vẫn giữ nguyên (mặc định 20) và vẫn được overlay dùng bình thường. */}
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

      {/* Idle animation — only useful in stack mode; danmaku/ticker have their own movement.
          Shimmer used to be a 3rd option here, but it doesn't touch `transform` (it animates
          ::after's background-position), so it never actually conflicted with float/slidex —
          it's now a separate, independently-toggleable control below. */}
      <div className="col-span-2">
        <Field label="Hiệu ứng liên tục (Idle) — Float / Slide X">
          <select
            className={inputClass}
            value={local.idleAnimation ?? 'none'}
            onChange={(e) => onChange({ idleAnimation: e.target.value })}
          >
            <option value="none">Không có</option>
            <option value="float">Float / Bob — lên xuống nhẹ nhàng</option>
            <option value="slidex">Slide X — lắc trái phải</option>
            <option value="scale">Scale — phóng to/thu nhỏ nhịp nhàng</option>
          </select>
        </Field>
      </div>

      {(local.idleAnimation && local.idleAnimation !== 'none') && (<>
        <Field label={`Tốc độ — ${local.idleAnimationSpeed ?? 3}s / chu kỳ`}>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={local.idleAnimationSpeed ?? 3}
            onChange={(e) => onChange({ idleAnimationSpeed: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Biên độ — ${local.idleAnimationIntensity ?? 5}${local.idleAnimation === 'scale' ? '%' : 'px'}`}>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={local.idleAnimationIntensity ?? 5}
            onChange={(e) => onChange({ idleAnimationIntensity: Number(e.target.value) })}
          />
        </Field>
      </>)}

      {/* Shimmer — độc lập hoàn toàn với Float/Slide X ở trên, có thể bật đồng thời
          vì shimmer chỉ chạy trên ::after (quét background-position), không đụng
          `transform` nên không giành quyền điều khiển transform với float/slidex. */}
      <div className="col-span-2">
        <EnableToggle
          label="Bật Shimmer — ánh sáng quét qua bubble"
          checked={!!local.idleShimmerEnabled}
          onChange={(e) => onChange({ idleShimmerEnabled: e.target.checked })}
        />
      </div>

      {local.idleShimmerEnabled && (<>
        <Field label={`Tốc độ Shimmer — ${local.idleShimmerSpeed ?? 3}s / chu kỳ`}>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={local.idleShimmerSpeed ?? 3}
            onChange={(e) => onChange({ idleShimmerSpeed: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Độ sáng Shimmer — ${local.idleShimmerIntensity ?? 5}%`}>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={local.idleShimmerIntensity ?? 5}
            onChange={(e) => onChange({ idleShimmerIntensity: Number(e.target.value) })}
          />
        </Field>
      </>)}
    </>
  );
}