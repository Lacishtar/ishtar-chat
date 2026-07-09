import AccordionSection from '../Inspector/AccordionSection.jsx';
import QuickStylePresets from '../Presets/QuickStylePresets.jsx';
import FontSection from '../Typography/FontSection.jsx';
import BackgroundSection from '../Appearance/BackgroundSection.jsx';
import BorderSection from '../Appearance/BorderSection.jsx';
import ShadowSection from '../Appearance/ShadowSection.jsx';
import BubbleShapeSection from '../Bubble/BubbleShapeSection.jsx';
import BubbleTextureSection from '../Bubble/BubbleTextureSection.jsx';
import BunnySection from '../Bubble/BunnySection.jsx';
import AnimationSection from '../Animation/AnimationSection.jsx';
import { Field, PresetButton, PresetBadge } from '../shared/fields.jsx';
import { configVal, isUserSet } from '../shared/configHelpers.js';

const OBJECT_ID = 'global';

export default function GlobalInspector({ local, pushUpdate, state }) {
  const sec = (id) => ({
    id: `section-${OBJECT_ID}-${id}`,
    open: state.isExpanded(OBJECT_ID, id, id === 'typography' || id === 'bubbleAppearance'),
    onToggle: () => state.toggleSection(OBJECT_ID, id, id === 'typography' || id === 'bubbleAppearance'),
    favoriteKey: `${OBJECT_ID}:${id}`,
    isFavorite: state.isFavorite(`${OBJECT_ID}:${id}`),
    onToggleFavorite: state.toggleFavorite,
    matched: state.highlightSection === id,
  });

  return (
    <div className="flex flex-col gap-3">
      <QuickStylePresets onApply={pushUpdate} />

      <AccordionSection title="Typography" {...sec('typography')}>
        <FontSection
          fontFamily={local.fontFamily}
          fontSize={local.fontSize}
          color={local.textColor}
          opacity={1}
          showOpacity={false}
          sizeRange={[12, 28]}
          onChange={(patch) =>
            pushUpdate({
              ...(patch.fontFamily !== undefined ? { fontFamily: patch.fontFamily } : {}),
              ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
              ...(patch.color !== undefined ? { textColor: patch.color } : {}),
            })
          }
        />
        <Field label="Màu tên mặc định">
          <input
            type="color"
            className="h-8 w-full rounded-lg border border-line bg-panelAlt"
            value={local.authorColor}
            onChange={(e) => pushUpdate({ authorColor: e.target.value })}
          />
        </Field>
      </AccordionSection>

      <AccordionSection title="Bubble — Hình dạng" {...sec('bubbleAppearance')}>
        <BackgroundSection rgba={local.bubbleBg} onChange={(v) => pushUpdate({ bubbleBg: v })} />
        <BubbleShapeSection
          radius={local.bubbleRadius}
          opacity={local.bubbleOpacity}
          padX={configVal(local, 'bubblePaddingX', configVal(local, 'bubblePadding', 14))}
          padY={configVal(local, 'bubblePaddingY', configVal(local, 'bubblePadding', 10))}
          minWidth={local.bubbleMinWidth ?? 0}
          onChange={(patch) =>
            pushUpdate({
              ...(patch.radius !== undefined ? { bubbleRadius: patch.radius } : {}),
              ...(patch.opacity !== undefined ? { bubbleOpacity: patch.opacity } : {}),
              ...(patch.padX !== undefined ? { bubblePaddingX: patch.padX } : {}),
              ...(patch.padY !== undefined ? { bubblePaddingY: patch.padY } : {}),
              ...(patch.minWidth !== undefined ? { bubbleMinWidth: patch.minWidth } : {}),
            })
          }
        />
      </AccordionSection>

      <AccordionSection title="Border" {...sec('border')}>
        {!isUserSet(local, 'bubbleBorderWidth') && (
          <div className="col-span-2">
            <PresetBadge />
          </div>
        )}
        <div className="col-span-2 flex flex-wrap gap-2">
          <PresetButton label="Viền đứt khúc" onClick={() => pushUpdate({ bubbleBorderStyle: 'dashed', bubbleBorderWidth: 2 })} />
          <PresetButton label="Không viền" onClick={() => pushUpdate({ bubbleBorderStyle: 'none', bubbleBorderWidth: 0 })} />
        </div>
        <BorderSection
          width={configVal(local, 'bubbleBorderWidth', 0)}
          style={configVal(local, 'bubbleBorderStyle', 'solid')}
          color={configVal(local, 'bubbleBorderColor', local.textColor)}
          defaultColor={local.textColor}
          onChange={(patch) =>
            pushUpdate({
              ...(patch.width !== undefined ? { bubbleBorderWidth: patch.width } : {}),
              ...(patch.style !== undefined ? { bubbleBorderStyle: patch.style } : {}),
              ...(patch.color !== undefined ? { bubbleBorderColor: patch.color } : {}),
            })
          }
        />
      </AccordionSection>

      <AccordionSection title="Shadow" {...sec('shadow')}>
        <ShadowSection value={local.bubbleBoxShadow} onChange={(v) => pushUpdate({ bubbleBoxShadow: v })} allowCustomCss />
      </AccordionSection>

      <AccordionSection title="Texture" {...sec('texture')}>
        <BubbleTextureSection
          value={{
            bubbleTextureUrl: local.bubbleTextureUrl,
            bubbleTextureSize: local.bubbleTextureSize,
            bubbleTextureRepeat: local.bubbleTextureRepeat,
            bubbleTextureOpacity: local.bubbleTextureOpacity,
          }}
          onChange={pushUpdate}
        />
      </AccordionSection>

      <AccordionSection title="Decoration — Tai thỏ" {...sec('bunny')}>
        <BunnySection
          enabled={local.bubbleBunnyEars || false}
          onToggle={(e) => pushUpdate({ bubbleBunnyEars: e.target.checked })}
          width={local.bubbleBunnyEarsWidth ?? 32}
          height={local.bubbleBunnyEarsHeight ?? 30}
          roundness={local.bubbleBunnyEarsRoundness ?? 0}
          offsetX={local.bubbleBunnyEarsOffsetX ?? 20}
          offsetY={local.bubbleBunnyEarsOffsetY ?? 28}
          zIndex={local.bubbleBunnyEarsZIndex ?? -1}
          rotate={local.bubbleBunnyEarsRotate ?? 0}
          onChange={(patch) =>
            pushUpdate({
              ...(patch.width !== undefined ? { bubbleBunnyEarsWidth: patch.width } : {}),
              ...(patch.height !== undefined ? { bubbleBunnyEarsHeight: patch.height } : {}),
              ...(patch.roundness !== undefined ? { bubbleBunnyEarsRoundness: patch.roundness } : {}),
              ...(patch.offsetX !== undefined ? { bubbleBunnyEarsOffsetX: patch.offsetX } : {}),
              ...(patch.offsetY !== undefined ? { bubbleBunnyEarsOffsetY: patch.offsetY } : {}),
              ...(patch.zIndex !== undefined ? { bubbleBunnyEarsZIndex: patch.zIndex } : {}),
              ...(patch.rotate !== undefined ? { bubbleBunnyEarsRotate: patch.rotate } : {}),
            })
          }
        />
      </AccordionSection>

      <AccordionSection title="Advanced — Behavior & Animation" {...sec('behavior')}>
        <AnimationSection local={local} onChange={pushUpdate} />
      </AccordionSection>
    </div>
  );
}
