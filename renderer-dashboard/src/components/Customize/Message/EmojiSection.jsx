import { Field, PresetButton, EnableToggle } from '../shared/fields.jsx';
import GlowSection from '../Appearance/GlowSection.jsx';
import ColorPicker from '../shared/ColorPicker.jsx';

// Customizes the square "chip" that wraps every glyph of an emoji-only
export default function EmojiSection({ enabled, bg, radius, opacity, glow, onChange }) {
  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật ô emoji"
          checked={enabled}
          onChange={(e) => onChange({ emojiGlyphEnabled: e.target.checked })}
        />
      </div>

      {enabled && (
        <>
          <div className="col-span-2 flex flex-wrap gap-2">
            <PresetButton label="Bo tròn hết cỡ" onClick={() => onChange({ emojiGlyphRadius: 999 })} />
            <PresetButton label="Vuông vức" onClick={() => onChange({ emojiGlyphRadius: 0 })} />
            <PresetButton label="Ẩn nền chip" onClick={() => onChange({ emojiGlyphBg: 'rgba(0,0,0,0)' })} />
          </div>

          <Field label="Màu nền ô emoji" full>
            <ColorPicker value={bg} onChange={(v) => onChange({ emojiGlyphBg: v })} allowGradient />
          </Field>

          <Field label={`Bo góc — ${Math.min(radius, 40)}px${radius > 40 ? ' (tròn)' : ''}`}>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.min(radius, 40)}
              onChange={(e) => onChange({ emojiGlyphRadius: Number(e.target.value) })}
            />
          </Field>

          <Field label={`Độ mờ — ${Math.round(opacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => onChange({ emojiGlyphOpacity: Number(e.target.value) })}
            />
          </Field>

          <div className="col-span-2">
            <GlowSection
              value={glow}
              onChange={(v) => onChange({ emojiGlyphGlow: v === 'none' ? null : v })}
              allowCustomCss
            />
          </div>
        </>
      )}
    </>
  );
}
