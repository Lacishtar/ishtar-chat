import AccordionSection from '../Inspector/AccordionSection.jsx';
import TransformSection from '../Transform/TransformSection.jsx';
import { Field, SlotToggle } from '../shared/fields.jsx';
import { slotVal } from '../shared/configHelpers.js';

const OBJECT_ID = 'badges';

export default function BadgesInspector({ local, slotLocal, pushSlotUpdate, state }) {
  const sec = (id, defaultOpen = false) => ({
    id: `section-${OBJECT_ID}-${id}`,
    open: state.isExpanded(OBJECT_ID, id, defaultOpen),
    onToggle: () => state.toggleSection(OBJECT_ID, id, defaultOpen),
    favoriteKey: `${OBJECT_ID}:${id}`,
    isFavorite: state.isFavorite(`${OBJECT_ID}:${id}`),
    onToggleFavorite: state.toggleFavorite,
    matched: state.highlightSection === id,
  });

  return (
    <div className="flex flex-col gap-3">
      <AccordionSection title="Hình thức" {...sec('appearance', true)}>
        <SlotToggle
          label="Hiện badge"
          checked={slotVal(slotLocal, 'badges', 'visible', local.showBadges)}
          onChange={(e) => pushSlotUpdate('badges', { visible: e.target.checked })}
        />
        <Field label={`Cỡ — ${slotVal(slotLocal, 'badges', 'fontSize', Math.round(local.fontSize * 0.65))}px`}>
          <input
            type="range"
            min={8}
            max={20}
            value={slotVal(slotLocal, 'badges', 'fontSize', Math.round(local.fontSize * 0.65))}
            onChange={(e) => pushSlotUpdate('badges', { fontSize: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Opacity — ${Math.round(slotVal(slotLocal, 'badges', 'opacity', 1) * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={slotVal(slotLocal, 'badges', 'opacity', 1)}
            onChange={(e) => pushSlotUpdate('badges', { opacity: Number(e.target.value) })}
          />
        </Field>
      </AccordionSection>

      <AccordionSection title="Biến đổi" {...sec('transform')}>
        <TransformSection slotLocal={slotLocal} slot="badges" pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>
    </div>
  );
}
