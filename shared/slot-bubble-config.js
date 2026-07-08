/**
 * Per-slot bubble decoration (author / message). Values fall back to CustomizeConfig.
 */

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');
const { toImageProxyUrl } = require('./image-url');

const BUBBLE_KEYS = [
  'bubbleBg',
  'bubbleRadius',
  'bubbleOpacity',
  'bubbleBorderWidth',
  'bubbleBorderStyle',
  'bubbleBorderColor',
  'bubbleBoxShadow',
  'bubblePadding',
  'bubblePaddingX',
  'bubblePaddingY',
  'bubbleTextureUrl',
  'bubbleTextureSize',
  'bubbleTextureRepeat',
  'bubbleTextureOpacity',
  'bubbleBunnyEars',
  'bubbleBunnyEarsWidth',
  'bubbleBunnyEarsHeight',
  'bubbleBunnyEarsRoundness',
  'bubbleBunnyEarsOffsetX',
  'bubbleBunnyEarsOffsetY',
  'bubbleBunnyEarsZIndex',
  'bubbleMinWidth',
];

function createSlotBubbleDefaults(overrides = {}) {
  const base = Object.fromEntries(BUBBLE_KEYS.map((key) => [key, null]));
  return { ...base, ...overrides };
}

function isSet(value) {
  return value !== undefined && value !== null;
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

function clampPct(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 100);
}

function resolveSlotBubbleValue(slot, key, globalConfig) {
  const g = { ...DEFAULT_CUSTOMIZE_CONFIG, ...globalConfig };
  if (isSet(slot?.[key])) return slot[key];
  return g[key];
}

function compileSlotBubbleDecoration(prefix, slot, globalConfig) {
  const vars = {};
  const bg = resolveSlotBubbleValue(slot, 'bubbleBg', globalConfig);
  const radius = resolveSlotBubbleValue(slot, 'bubbleRadius', globalConfig);
  const opacity = resolveSlotBubbleValue(slot, 'bubbleOpacity', globalConfig);

  if (bg) vars[`--ovs-slot-${prefix}-bubble-bg`] = bg;
  if (radius != null) vars[`--ovs-slot-${prefix}-bubble-radius`] = px(radius);
  if (opacity != null) vars[`--ovs-slot-${prefix}-bubble-opacity`] = String(opacity);

  const texUrl = resolveSlotBubbleValue(slot, 'bubbleTextureUrl', globalConfig);
  const texRepeat = resolveSlotBubbleValue(slot, 'bubbleTextureRepeat', globalConfig);
  const texSize = resolveSlotBubbleValue(slot, 'bubbleTextureSize', globalConfig);
  const texOpacity = resolveSlotBubbleValue(slot, 'bubbleTextureOpacity', globalConfig);

  if (texUrl && typeof texUrl === 'string' && texUrl.trim()) {
    const proxied = toImageProxyUrl(texUrl);
    vars[`--ovs-slot-${prefix}-bubble-texture-url`] = `url("${proxied || texUrl.trim()}")`;
  } else {
    vars[`--ovs-slot-${prefix}-bubble-texture-url`] = 'none';
  }
  if (isSet(texRepeat)) {
    vars[`--ovs-slot-${prefix}-bubble-texture-repeat`] = texRepeat;
  }
  if (isSet(texSize)) {
    vars[`--ovs-slot-${prefix}-bubble-texture-size`] = typeof texSize === 'number' ? px(texSize) : texSize;
  }
  if (isSet(texOpacity)) {
    vars[`--ovs-slot-${prefix}-bubble-texture-opacity`] = String(texOpacity);
  }

  if (isSet(resolveSlotBubbleValue(slot, 'bubbleBorderWidth', globalConfig))) {
    vars[`--ovs-slot-${prefix}-bubble-border-width`] = px(
      resolveSlotBubbleValue(slot, 'bubbleBorderWidth', globalConfig),
    );
  }
  if (isSet(resolveSlotBubbleValue(slot, 'bubbleBorderStyle', globalConfig))) {
    vars[`--ovs-slot-${prefix}-bubble-border-style`] = resolveSlotBubbleValue(
      slot,
      'bubbleBorderStyle',
      globalConfig,
    );
  }
  if (isSet(resolveSlotBubbleValue(slot, 'bubbleBorderColor', globalConfig))) {
    vars[`--ovs-slot-${prefix}-bubble-border-color`] = resolveSlotBubbleValue(
      slot,
      'bubbleBorderColor',
      globalConfig,
    );
  }
  if (isSet(resolveSlotBubbleValue(slot, 'bubbleBoxShadow', globalConfig))) {
    vars[`--ovs-slot-${prefix}-bubble-box-shadow`] = resolveSlotBubbleValue(
      slot,
      'bubbleBoxShadow',
      globalConfig,
    );
  }

  const padX = resolveSlotBubbleValue(slot, 'bubblePaddingX', globalConfig)
    ?? (isSet(resolveSlotBubbleValue(slot, 'bubblePadding', globalConfig))
      ? resolveSlotBubbleValue(slot, 'bubblePadding', globalConfig)
      : null);
  const padY = resolveSlotBubbleValue(slot, 'bubblePaddingY', globalConfig)
    ?? (isSet(resolveSlotBubbleValue(slot, 'bubblePadding', globalConfig))
      ? resolveSlotBubbleValue(slot, 'bubblePadding', globalConfig)
      : null);
  if (padX != null) vars[`--ovs-slot-${prefix}-bubble-pad-x`] = px(padX);
  if (padY != null) vars[`--ovs-slot-${prefix}-bubble-pad-y`] = px(padY);

  const minWidth = resolveSlotBubbleValue(slot, 'bubbleMinWidth', globalConfig);
  if (minWidth != null) vars[`--ovs-slot-${prefix}-bubble-min-width`] = px(minWidth);

  const earsWidth = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsWidth', globalConfig);
  if (earsWidth != null) vars[`--ovs-slot-${prefix}-bunny-ears-width`] = px(earsWidth);

  const earsHeight = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsHeight', globalConfig);
  if (earsHeight != null) vars[`--ovs-slot-${prefix}-bunny-ears-height`] = px(earsHeight);

  const earsRoundness = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsRoundness', globalConfig);
  if (earsRoundness != null) vars[`--ovs-slot-${prefix}-bunny-ears-radius-v`] = `${clampPct(earsRoundness, 0)}%`;

  const earsOffsetX = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsOffsetX', globalConfig);
  if (earsOffsetX != null) vars[`--ovs-slot-${prefix}-bunny-ears-offset-x`] = px(earsOffsetX);

  const earsOffsetY = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsOffsetY', globalConfig);
  if (earsOffsetY != null) vars[`--ovs-slot-${prefix}-bunny-ears-top`] = px(-Math.abs(Number(earsOffsetY) || 0));

  const earsZ = resolveSlotBubbleValue(slot, 'bubbleBunnyEarsZIndex', globalConfig);
  if (earsZ != null) vars[`--ovs-slot-${prefix}-bunny-ears-z`] = String(Math.round(Number(earsZ) || 0));

  return vars;
}

function compileSlotBubblesToCssVariables(slotStyle, globalConfig) {
  const slots = slotStyle?.slots || {};
  return {
    ...compileSlotBubbleDecoration('author', slots.author, globalConfig),
    ...compileSlotBubbleDecoration('message', slots.message, globalConfig),
  };
}

module.exports = {
  BUBBLE_KEYS,
  createSlotBubbleDefaults,
  compileSlotBubbleDecoration,
  compileSlotBubblesToCssVariables,
  resolveSlotBubbleValue,
};