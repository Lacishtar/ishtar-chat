import AccordionSection from '../Inspector/AccordionSection.jsx';
import AvatarSizeSection from '../Avatar/AvatarSizeSection.jsx';
import AvatarBorderSection from '../Avatar/AvatarBorderSection.jsx';
import TransformSection from '../Transform/TransformSection.jsx';

const OBJECT_ID = 'avatar';

export default function AvatarInspector({ local, slotLocal, pushSlotUpdate, state }) {
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
      <AccordionSection title="Appearance" {...sec('appearance', true)}>
        <AvatarSizeSection local={local} slotLocal={slotLocal} pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>

      <AccordionSection title="Border" {...sec('border')}>
        <AvatarBorderSection local={local} slotLocal={slotLocal} pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>

      <AccordionSection title="Transform" {...sec('transform')}>
        <TransformSection slotLocal={slotLocal} slot="avatar" pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>
    </div>
  );
}
