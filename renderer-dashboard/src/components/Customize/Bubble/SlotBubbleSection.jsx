import { useState } from 'react';
import { slotBubbleVal, isSlotBubbleUserSet } from '../shared/configHelpers.js';
import BackgroundSection from '../Appearance/BackgroundSection.jsx';
import BorderSection from '../Appearance/BorderSection.jsx';
import ShadowSection from '../Appearance/ShadowSection.jsx';
import GlowSection from '../Appearance/GlowSection.jsx';
import BubbleShapeSection from './BubbleShapeSection.jsx';
import BubbleTextureSection from './BubbleTextureSection.jsx';
import BunnySection from './BunnySection.jsx';
import { PresetBadge } from '../shared/fields.jsx';

export default function SlotBubbleSection({ slot, slotLocal, globalConfig, pushSlotUpdate }) {
  const [tab, setTab] = useState('shape');

  const bg = slotBubbleVal(slotLocal, slot, 'bubbleBg', globalConfig, globalConfig.bubbleBg);
  const padX = slotBubbleVal(
    slotLocal,
    slot,
    'bubblePaddingX',
    globalConfig,
    slotBubbleVal(slotLocal, slot, 'bubblePadding', globalConfig, 14),
  );
  const padY = slotBubbleVal(
    slotLocal,
    slot,
    'bubblePaddingY',
    globalConfig,
    slotBubbleVal(slotLocal, slot, 'bubblePadding', globalConfig, 10),
  );
  const padTop = slotBubbleVal(slotLocal, slot, 'bubblePaddingTop', globalConfig, padY);
  const padRight = slotBubbleVal(slotLocal, slot, 'bubblePaddingRight', globalConfig, padX);
  const padBottom = slotBubbleVal(slotLocal, slot, 'bubblePaddingBottom', globalConfig, padY);
  const padLeft = slotBubbleVal(slotLocal, slot, 'bubblePaddingLeft', globalConfig, padX);

  const textureVal = {
    bubbleTextureUrl: slotBubbleVal(slotLocal, slot, 'bubbleTextureUrl', globalConfig, null),
    bubbleTextureSize: slotBubbleVal(slotLocal, slot, 'bubbleTextureSize', globalConfig, 'auto'),
    bubbleTextureRepeat: slotBubbleVal(slotLocal, slot, 'bubbleTextureRepeat', globalConfig, 'repeat'),
    bubbleTextureOpacity: slotBubbleVal(slotLocal, slot, 'bubbleTextureOpacity', globalConfig, 1),
  };

  const bunnyTriState =
    slotLocal?.slots?.[slot]?.bubbleBunnyEars === true
      ? 'true'
      : slotLocal?.slots?.[slot]?.bubbleBunnyEars === false
      ? 'false'
      : 'default';

  const handleResetAll = () =>
    pushSlotUpdate(slot, {
      bubbleBg: null,
      bubbleRadius: null,
      bubbleOpacity: null,
      bubbleBorderWidth: null,
      bubbleBorderStyle: null,
      bubbleBorderColor: null,
      bubbleBorderOffset: null,
      bubbleBoxShadow: null,
      bubbleGlow: null,
      bubblePadding: null,
      bubblePaddingX: null,
      bubblePaddingY: null,
      bubblePaddingTop: null,
      bubblePaddingRight: null,
      bubblePaddingBottom: null,
      bubblePaddingLeft: null,
      bubbleTextureUrl: null,
      bubbleTextureSize: null,
      bubbleTextureRepeat: null,
      bubbleTextureOpacity: null,
      bubbleMinWidth: null,
      bubbleBunnyEars: null,
      bubbleBunnyEarsWidth: null,
      bubbleBunnyEarsHeight: null,
      bubbleBunnyEarsRoundness: null,
      bubbleBunnyEarsOffsetX: null,
      bubbleBunnyEarsOffsetY: null,
      bubbleBunnyEarsZIndex: null,
    });

  const SUBTABS = [
    { id: 'shape', label: 'Hình dạng' },
    { id: 'border', label: 'Viền' },
    { id: 'shadow', label: 'Shadow' },
    { id: 'glow', label: 'Glow' },
    { id: 'texture', label: 'Texture' },
    { id: 'bunny', label: 'Tai thỏ' },
  ];

  return (
    <div className="col-span-2 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-inkMuted">
          Các setting dưới đây tự kế thừa từ Bubble (Chung) trừ khi bạn chỉnh riêng.
        </span>
        <button type="button" onClick={handleResetAll} className="text-[10px] text-inkMuted hover:text-ink underline shrink-0">
          Dùng mặc định chung
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2 py-1 rounded-md text-[11px] ${
              tab === t.id ? 'bg-focusAccent text-white' : 'bg-panelAlt text-inkMuted hover:bg-line'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tab === 'shape' && (
          <>
            <BackgroundSection rgba={bg} onChange={(v) => pushSlotUpdate(slot, { bubbleBg: v })} />
            <BubbleShapeSection
              radius={slotBubbleVal(slotLocal, slot, 'bubbleRadius', globalConfig, globalConfig.bubbleRadius ?? 14)}
              opacity={slotBubbleVal(slotLocal, slot, 'bubbleOpacity', globalConfig, globalConfig.bubbleOpacity ?? 1)}
              padTop={padTop}
              padRight={padRight}
              padBottom={padBottom}
              padLeft={padLeft}
              minWidth={slotBubbleVal(slotLocal, slot, 'bubbleMinWidth', globalConfig, globalConfig.bubbleMinWidth ?? 0)}
              onChange={(patch) =>
                pushSlotUpdate(slot, {
                  ...(patch.radius !== undefined ? { bubbleRadius: patch.radius } : {}),
                  ...(patch.opacity !== undefined ? { bubbleOpacity: patch.opacity } : {}),
                  ...(patch.padTop !== undefined ? { bubblePaddingTop: patch.padTop } : {}),
                  ...(patch.padRight !== undefined ? { bubblePaddingRight: patch.padRight } : {}),
                  ...(patch.padBottom !== undefined ? { bubblePaddingBottom: patch.padBottom } : {}),
                  ...(patch.padLeft !== undefined ? { bubblePaddingLeft: patch.padLeft } : {}),
                  ...(patch.minWidth !== undefined ? { bubbleMinWidth: patch.minWidth } : {}),
                })
              }
            />
          </>
        )}

        {tab === 'border' && (
          <>
            {!isSlotBubbleUserSet(slotLocal, slot, 'bubbleBorderWidth') && (
              <div className="col-span-2">
                <PresetBadge />
              </div>
            )}
            <BorderSection
              width={slotBubbleVal(slotLocal, slot, 'bubbleBorderWidth', globalConfig, 0)}
              style={slotBubbleVal(slotLocal, slot, 'bubbleBorderStyle', globalConfig, 'solid')}
              color={slotBubbleVal(slotLocal, slot, 'bubbleBorderColor', globalConfig, globalConfig.textColor)}
              defaultColor={globalConfig.textColor}
              offset={slotBubbleVal(slotLocal, slot, 'bubbleBorderOffset', globalConfig, 0)}
              onChange={(patch) =>
                pushSlotUpdate(slot, {
                  ...(patch.width !== undefined ? { bubbleBorderWidth: patch.width } : {}),
                  ...(patch.style !== undefined ? { bubbleBorderStyle: patch.style } : {}),
                  ...(patch.color !== undefined ? { bubbleBorderColor: patch.color } : {}),
                  ...(patch.offset !== undefined ? { bubbleBorderOffset: patch.offset } : {}),
                })
              }
            />
          </>
        )}

        {tab === 'shadow' && (
          <ShadowSection
            value={slotBubbleVal(slotLocal, slot, 'bubbleBoxShadow', globalConfig, 'none')}
            onChange={(v) => pushSlotUpdate(slot, { bubbleBoxShadow: v })}
          />
        )}

        {tab === 'glow' && (
          <GlowSection
            value={slotBubbleVal(slotLocal, slot, 'bubbleGlow', globalConfig, 'none')}
            onChange={(v) => pushSlotUpdate(slot, { bubbleGlow: v })}
          />
        )}

        {tab === 'texture' && (
          <BubbleTextureSection
            value={textureVal}
            onChange={(patch) => pushSlotUpdate(slot, patch)}
            onReset={() =>
              pushSlotUpdate(slot, {
                bubbleTextureUrl: null,
                bubbleTextureSize: null,
                bubbleTextureRepeat: null,
                bubbleTextureOpacity: null,
              })
            }
          />
        )}

        {tab === 'bunny' && (
          <BunnySection
            triState={bunnyTriState}
            onTriStateChange={(val) =>
              pushSlotUpdate(slot, { bubbleBunnyEars: val === 'true' ? true : val === 'false' ? false : null })
            }
            inheritedLabel={globalConfig.bubbleBunnyEars ? 'Bật' : 'Tắt'}
            width={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsWidth', globalConfig, globalConfig.bubbleBunnyEarsWidth ?? 32)}
            height={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsHeight', globalConfig, globalConfig.bubbleBunnyEarsHeight ?? 30)}
            roundness={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsRoundness', globalConfig, globalConfig.bubbleBunnyEarsRoundness ?? 0)}
            offsetX={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetX', globalConfig, globalConfig.bubbleBunnyEarsOffsetX ?? 20)}
            offsetY={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsOffsetY', globalConfig, globalConfig.bubbleBunnyEarsOffsetY ?? 28)}
            zIndex={slotBubbleVal(slotLocal, slot, 'bubbleBunnyEarsZIndex', globalConfig, globalConfig.bubbleBunnyEarsZIndex ?? -1)}
            onChange={(patch) =>
              pushSlotUpdate(slot, {
                ...(patch.width !== undefined ? { bubbleBunnyEarsWidth: patch.width } : {}),
                ...(patch.height !== undefined ? { bubbleBunnyEarsHeight: patch.height } : {}),
                ...(patch.roundness !== undefined ? { bubbleBunnyEarsRoundness: patch.roundness } : {}),
                ...(patch.offsetX !== undefined ? { bubbleBunnyEarsOffsetX: patch.offsetX } : {}),
                ...(patch.offsetY !== undefined ? { bubbleBunnyEarsOffsetY: patch.offsetY } : {}),
                ...(patch.zIndex !== undefined ? { bubbleBunnyEarsZIndex: patch.zIndex } : {}),
              })
            }
          />
        )}
      </div>
    </div>
  );
}
