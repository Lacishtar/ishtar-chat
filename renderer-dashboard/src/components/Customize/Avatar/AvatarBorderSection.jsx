import { PresetButton } from '../shared/fields.jsx';
import BorderSection from '../Appearance/BorderSection.jsx';
import { slotVal } from '../shared/configHelpers.js';

export default function AvatarBorderSection({ local, slotLocal, pushSlotUpdate }) {
  return (
    <>
      <div className="col-span-2 flex flex-wrap gap-2">
        <PresetButton
          label="Bo tròn"
          onClick={() => pushSlotUpdate('avatar', { borderRadius: '50%', borderStyle: 'none', borderWidth: 0 })}
        />
        <PresetButton
          label="Khung vuông"
          onClick={() => pushSlotUpdate('avatar', { borderRadius: 0, borderStyle: 'solid', borderWidth: 2 })}
        />
      </div>
      <BorderSection
        width={slotVal(slotLocal, 'avatar', 'borderWidth', 0)}
        style={slotVal(slotLocal, 'avatar', 'borderStyle', 'solid')}
        color={slotVal(slotLocal, 'avatar', 'borderColor', local.authorColor)}
        defaultColor={local.authorColor}
        offset={slotVal(slotLocal, 'avatar', 'borderOffset', 0)}
        onChange={(patch) =>
          pushSlotUpdate('avatar', {
            ...(patch.width !== undefined ? { borderWidth: patch.width } : {}),
            ...(patch.style !== undefined ? { borderStyle: patch.style } : {}),
            ...(patch.color !== undefined ? { borderColor: patch.color } : {}),
            ...(patch.offset !== undefined ? { borderOffset: patch.offset } : {}),
          })
        }
      />
    </>
  );
}
