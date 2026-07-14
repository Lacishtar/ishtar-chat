import AccordionSection from '../Inspector/AccordionSection.jsx';
import FontSection from '../Typography/FontSection.jsx';
import TransformSection from '../Transform/TransformSection.jsx';
import SlotBubbleSection from '../Bubble/SlotBubbleSection.jsx';
import { SlotToggle } from '../shared/fields.jsx';
import { slotVal } from '../shared/configHelpers.js';

const OBJECT_ID = 'message';

export default function MessageInspector({ local, slotLocal, pushSlotUpdate, state }) {
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
          label="Hiện nội dung"
          checked={slotVal(slotLocal, 'message', 'visible', true)}
          onChange={(e) => pushSlotUpdate('message', { visible: e.target.checked })}
        />
      </AccordionSection>

      <AccordionSection title="Kiểu chữ" {...sec('typography', true)}>
        <FontSection
          fontFamily={slotVal(slotLocal, 'message', 'fontFamily', local.fontFamily)}
          fontSize={slotVal(slotLocal, 'message', 'fontSize', local.fontSize)}
          color={slotVal(slotLocal, 'message', 'color', local.textColor)}
          opacity={slotVal(slotLocal, 'message', 'opacity', 1)}
          textAlign={slotVal(slotLocal, 'message', 'textAlign', '')}
          sizeRange={[10, 32]}
          onChange={(patch) => pushSlotUpdate('message', patch)}
        />
      </AccordionSection>

      <AccordionSection title="Biến đổi" {...sec('transform')}>
        <TransformSection slotLocal={slotLocal} slot="message" pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>

      <AccordionSection title="Trang trí — Bubble riêng" {...sec('bubble')}>
        <SlotBubbleSection slot="message" slotLocal={slotLocal} globalConfig={local} pushSlotUpdate={pushSlotUpdate} />
      </AccordionSection>
    </div>
  );
}
