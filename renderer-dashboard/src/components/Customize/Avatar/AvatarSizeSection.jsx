import { Field, SlotToggle } from '../shared/fields.jsx';
import { slotVal } from '../shared/configHelpers.js';

export default function AvatarSizeSection({ local, slotLocal, pushSlotUpdate }) {
  const borderRadius = slotVal(slotLocal, 'avatar', 'borderRadius', 50);
  const isPercentRadius = typeof borderRadius === 'string';

  return (
    <>
      <SlotToggle
        label="Hiện avatar"
        checked={slotVal(slotLocal, 'avatar', 'visible', local.showAvatar)}
        onChange={(e) => pushSlotUpdate('avatar', { visible: e.target.checked })}
      />
      <Field label={`Cỡ — ${slotVal(slotLocal, 'avatar', 'size', local.avatarSize)}px`}>
        <input
          type="range"
          min={0}
          max={56}
          value={slotVal(slotLocal, 'avatar', 'size', local.avatarSize)}
          onChange={(e) => pushSlotUpdate('avatar', { size: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Bo góc — ${isPercentRadius ? borderRadius : `${borderRadius}%`}`}>
        <input
          type="range"
          min={0}
          max={50}
          value={isPercentRadius ? 50 : borderRadius}
          onChange={(e) => pushSlotUpdate('avatar', { borderRadius: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'avatar', 'opacity', 1) * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={slotVal(slotLocal, 'avatar', 'opacity', 1)}
          onChange={(e) => pushSlotUpdate('avatar', { opacity: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}
