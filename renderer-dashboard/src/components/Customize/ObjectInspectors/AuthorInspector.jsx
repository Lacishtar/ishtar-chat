import AccordionSection from '../Inspector/AccordionSection.jsx';
import FontSection from '../Typography/FontSection.jsx';
import TransformSection from '../Transform/TransformSection.jsx';
import SlotBubbleSection from '../Bubble/SlotBubbleSection.jsx';
import { SlotToggle } from '../shared/fields.jsx';
import { slotVal } from '../shared/configHelpers.js';

const OBJECT_ID = 'author';

export default function AuthorInspector({ local, slotLocal, pushSlotUpdate, state }) {
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
          label="Hiện tên"
          checked={slotVal(slotLocal, 'author', 'visible', true)}
          onChange={(e) => pushSlotUpdate('author', { visible: e.target.checked })}
        />
      </AccordionSection>

      <AccordionSection title="Kiểu chữ" {...sec('typography', true)}>
        <FontSection
          fontFamily={slotVal(slotLocal, 'author', 'fontFamily', local.fontFamily)}
          fontSize={slotVal(slotLocal, 'author', 'fontSize', Math.round(local.fontSize * 0.9))}
          color={slotVal(slotLocal, 'author', 'color', local.authorColor)}
          opacity={slotVal(slotLocal, 'author', 'opacity', 1)}
          textAlign={slotVal(slotLocal, 'author', 'textAlign', '')}
          sizeRange={[10, 28]}
          onChange={(patch) => pushSlotUpdate('author', patch)}
        />
      </AccordionSection>

      <AccordionSection title="Biến đổi" {...sec('transform')}>
        <TransformSection slotLocal={slotLocal} slot="author" pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>

      <AccordionSection title="Trang trí — Bubble riêng" {...sec('bubble')}>
        <SlotBubbleSection slot="author" slotLocal={slotLocal} globalConfig={local} pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>
    </div>
  );
}
