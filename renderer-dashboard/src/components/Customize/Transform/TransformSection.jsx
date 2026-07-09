import { Field } from '../shared/fields.jsx';
import { slotVal } from '../shared/configHelpers.js';

export default function TransformSection({ slotLocal, slot, pushSlotUpdate }) {
  const zIndex = slotVal(slotLocal, slot, 'zIndex', null);
  const displayZIndex = zIndex !== null ? zIndex : 'Mặc định (auto)';

  return (
    <>
      <Field label={`Góc xoay — ${slotVal(slotLocal, slot, 'rotate', 0)}°`}>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={slotVal(slotLocal, slot, 'rotate', 0)}
          onChange={(e) => pushSlotUpdate(slot, { rotate: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Offset X — ${slotVal(slotLocal, slot, 'translateX', 0)}px`}>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={slotVal(slotLocal, slot, 'translateX', 0)}
          onChange={(e) => pushSlotUpdate(slot, { translateX: Number(e.target.value) })}
        />
      </Field>
      <Field label={`Offset Y — ${slotVal(slotLocal, slot, 'translateY', 0)}px`}>
        <input
          type="range"
          min={-40}
          max={40}
          step={1}
          value={slotVal(slotLocal, slot, 'translateY', 0)}
          onChange={(e) => pushSlotUpdate(slot, { translateY: Number(e.target.value) })}
        />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            <span>Z-index — {displayZIndex}</span>
            {zIndex !== null && (
              <button
                type="button"
                onClick={() => pushSlotUpdate(slot, { zIndex: null })}
                className="text-[10px] text-inkMuted hover:text-ink underline ml-1"
              >
                Mặc định
              </button>
            )}
          </span>
        }
      >
        <input
          type="range"
          min={-10}
          max={20}
          step={1}
          value={zIndex !== null ? zIndex : 0}
          onChange={(e) => pushSlotUpdate(slot, { zIndex: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}
