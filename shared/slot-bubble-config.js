/**
 * Per-slot bubble decoration (author / message). Values fall back to CustomizeConfig.
 */

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');

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
