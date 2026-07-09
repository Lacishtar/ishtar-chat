import { useRef } from 'react';
import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';

export default function BubbleTextureSection({ value, onChange, onReset }) {
  const { bubbleTextureUrl, bubbleTextureSize, bubbleTextureRepeat, bubbleTextureOpacity } = value;
  const enabled = !!bubbleTextureUrl;
  // Remember the last URL typed so unchecking "Enable Texture" (which clears
  // the url so the effect actually turns off) doesn't lose the user's work
  // if they flip it back on.
  const lastUrlRef = useRef(bubbleTextureUrl || '');
  if (bubbleTextureUrl) lastUrlRef.current = bubbleTextureUrl;

  return (
    <>
      <div className="col-span-2 flex items-center justify-between gap-2">
        <EnableToggle
          label="Bật texture nền bubble"
          checked={enabled}
          onChange={(e) => onChange({ bubbleTextureUrl: e.target.checked ? lastUrlRef.current || '' : null })}
        />
        {onReset && (
          <button type="button" onClick={onReset} className="text-[10px] text-inkMuted hover:text-ink underline shrink-0">
            Dùng mặc định chung
          </button>
        )}
      </div>

      {enabled && (
        <>
          <div className="col-span-2">
            <Field label="URL Texture (Ảnh lặp nền)">
              <input
                type="text"
                className={inputClass}
                placeholder="Ví dụ: /overlay/assets/texture.png hoặc url ảnh"
                value={bubbleTextureUrl || ''}
                onChange={(e) => onChange({ bubbleTextureUrl: e.target.value.trim() || null })}
              />
            </Field>
          </div>
          <Field label="Chế độ lặp">
            <select
              className={inputClass}
              value={bubbleTextureRepeat || 'repeat'}
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
              value={['auto', 'contain', 'cover'].includes(bubbleTextureSize) ? bubbleTextureSize : 'custom'}
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
          {bubbleTextureSize && !['auto', 'contain', 'cover'].includes(bubbleTextureSize) && (
            <div className="col-span-2">
              <Field label="Kích thước tự chọn (CSS background-size)">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ví dụ: 32px hoặc 50% 50%"
                  value={bubbleTextureSize || ''}
                  onChange={(e) => onChange({ bubbleTextureSize: e.target.value })}
                />
              </Field>
            </div>
          )}
          <div className="col-span-2">
            <Field label={`Độ hiển thị texture — ${Math.round((bubbleTextureOpacity ?? 1) * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bubbleTextureOpacity ?? 1}
                onChange={(e) => onChange({ bubbleTextureOpacity: Number(e.target.value) })}
                className="w-full accent-focusAccent"
              />
            </Field>
          </div>
        </>
      )}
    </>
  );
}
