/**
 * SlotStyleConfig — per-slot visual properties (Avatar, Username, Badges, Message).
 * Compiled to --ovs-slot-* CSS variables. Slot overrides fall back to CustomizeConfig.
 */

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');
const { compileSlotBubblesToCssVariables, createSlotBubbleDefaults } = require('./slot-bubble-config');

function createTransformDefaults(overrides = {}) {
  return {
    rotate: 0,
    translateX: 0,
    translateY: 0,
    transformOrigin: null,
    zIndex: null,
    ...overrides,
  };
}

function createTextSlotDefaults(overrides = {}) {
  return {
    visible: null,
    fontFamily: null,
    fontSize: null,
    color: null,
    fontWeight: null,
    opacity: null,
    margin: 0,
    ...createTransformDefaults(),
    ...overrides,
  };
}

const DEFAULT_SLOT_STYLE_CONFIG = {
  slots: {
    avatar: {
      visible: null,
      size: null,
      borderRadius: null,
      borderWidth: null,
      borderStyle: null,
      borderColor: null,
      opacity: null,
      margin: 0,
      ...createTransformDefaults(),
    },
    author: { ...createTextSlotDefaults(), ...createSlotBubbleDefaults() },
    badges: {
      visible: null,
      fontSize: null,
      opacity: null,
      margin: 0,
      ...createTransformDefaults(),
    },
    message: { ...createTextSlotDefaults(), ...createSlotBubbleDefaults() },
  },
};

function mergeSlotStyleConfig(base, overrides) {
  const b = base || DEFAULT_SLOT_STYLE_CONFIG;
  const o = overrides || {};
  const mergeSlot = (key) => ({ ...b.slots[key], ...(o.slots?.[key] || {}) });
  return {
    slots: {
      avatar: mergeSlot('avatar'),
      author: mergeSlot('author'),
      badges: mergeSlot('badges'),
      message: mergeSlot('message'),
    },
  };
}

function isSet(value) {
  return value !== undefined && value !== null;
}

function resolveSlotVisibility(slotVisible, globalVisible) {
  if (isSet(slotVisible)) return Boolean(slotVisible);
  if (isSet(globalVisible)) return Boolean(globalVisible);
  return true;
}

/**
 * Resolves effective slot values with CustomizeConfig fallbacks.
 */
function resolveEffectiveSlotStyle(slotStyle, customizeConfig, layoutConfig) {
  const cfg = { ...DEFAULT_CUSTOMIZE_CONFIG, ...customizeConfig };
  const s = mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, slotStyle);
  const { slots } = s;
  const isRtl = layoutConfig?.screen?.contentDirection === 'rtl';

  return {
    avatar: {
      visible: resolveSlotVisibility(slots.avatar.visible, cfg.showAvatar),
      size: slots.avatar.size ?? cfg.avatarSize,
      borderRadius: slots.avatar.borderRadius ?? null,
      borderWidth: slots.avatar.borderWidth ?? null,
      borderStyle: slots.avatar.borderStyle ?? null,
      borderColor: slots.avatar.borderColor ?? null,
      opacity: slots.avatar.opacity ?? 1,
      margin: slots.avatar.margin ?? 0,
      ...resolveTransform(slots.avatar, false, isRtl),
    },
    author: {
      visible: resolveSlotVisibility(slots.author.visible, true),
      fontFamily: slots.author.fontFamily ?? cfg.fontFamily,
      fontSize: slots.author.fontSize ?? Math.round(cfg.fontSize * 0.9),
      color: slots.author.color ?? cfg.authorColor,
      fontWeight: slots.author.fontWeight ?? 700,
      opacity: slots.author.opacity ?? 1,
      margin: slots.author.margin ?? 0,
      ...resolveTransform(slots.author, false, isRtl),
    },
    badges: {
      visible: resolveSlotVisibility(slots.badges.visible, cfg.showBadges),
      fontSize: slots.badges.fontSize ?? Math.round(cfg.fontSize * 0.65),
      opacity: slots.badges.opacity ?? 1,
      margin: slots.badges.margin ?? 0,
      ...resolveTransform(slots.badges, false, isRtl),
    },
    message: {
      visible: resolveSlotVisibility(slots.message.visible, true),
      fontFamily: slots.message.fontFamily ?? cfg.fontFamily,
      fontSize: slots.message.fontSize ?? cfg.fontSize,
      color: slots.message.color ?? cfg.textColor,
      fontWeight: slots.message.fontWeight ?? null,
      opacity: slots.message.opacity ?? 1,
      margin: slots.message.margin ?? 0,
      ...resolveTransform(slots.message, true, isRtl),
    },
  };
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

function formatBorderRadius(value) {
  if (!isSet(value)) return null;
  if (typeof value === 'string' && value.includes('%')) return value;
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : String(value);
}

function resolveTransform(slot, isMessageSlot, isRtl) {
  let defaultOrigin = 'center center';
  if (isMessageSlot) {
    defaultOrigin = isRtl ? 'right center' : 'left center';
  }
  return {
    rotate: slot.rotate ?? 0,
    translateX: slot.translateX ?? 0,
    translateY: slot.translateY ?? 0,
    transformOrigin: slot.transformOrigin ?? defaultOrigin,
    zIndex: slot.zIndex ?? null,
  };
}

function compileTransformVars(prefix, transform, isRtl) {
  const t = resolveTransform(transform, prefix === 'message', isRtl);
  const vars = {
    [`--ovs-slot-${prefix}-rotate`]: `${t.rotate}deg`,
    [`--ovs-slot-${prefix}-translate-x`]: px(t.translateX),
    [`--ovs-slot-${prefix}-translate-y`]: px(t.translateY),
    [`--ovs-slot-${prefix}-transform-origin`]: t.transformOrigin,
  };
  if (t.zIndex != null) {
    vars[`--ovs-slot-${prefix}-z-index`] = String(t.zIndex);
  }
  return vars;
}

function compileSlotStyleToCssVariables(slotStyle, customizeConfig, layoutConfig) {
  const s = mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, slotStyle);
  const e = resolveEffectiveSlotStyle(slotStyle, customizeConfig, layoutConfig);
  const vars = {};
  const { avatar } = s.slots;
  const isRtl = layoutConfig?.screen?.contentDirection === 'rtl';

  if (e.avatar.size != null) vars['--ovs-slot-avatar-size'] = px(e.avatar.size);
  const radius = formatBorderRadius(avatar.borderRadius);
  if (radius != null) vars['--ovs-slot-avatar-border-radius'] = radius;
  if (isSet(avatar.borderWidth)) vars['--ovs-slot-avatar-border-width'] = px(avatar.borderWidth);
  if (isSet(avatar.borderStyle)) vars['--ovs-slot-avatar-border-style'] = avatar.borderStyle;
  if (isSet(avatar.borderColor)) vars['--ovs-slot-avatar-border-color'] = avatar.borderColor;
  if (e.avatar.opacity != null) vars['--ovs-slot-avatar-opacity'] = String(e.avatar.opacity);
  if (e.avatar.margin != null) vars['--ovs-slot-avatar-margin'] = px(e.avatar.margin);
  Object.assign(vars, compileTransformVars('avatar', e.avatar, isRtl));

  if (e.author.fontFamily) vars['--ovs-slot-author-font-family'] = e.author.fontFamily;
  if (e.author.fontSize != null) vars['--ovs-slot-author-font-size'] = px(e.author.fontSize);
  if (e.author.color) vars['--ovs-slot-author-color'] = e.author.color;
  if (e.author.fontWeight != null) vars['--ovs-slot-author-font-weight'] = String(e.author.fontWeight);
  if (e.author.opacity != null) vars['--ovs-slot-author-opacity'] = String(e.author.opacity);
  if (e.author.margin != null) vars['--ovs-slot-author-margin'] = px(e.author.margin);
  Object.assign(vars, compileTransformVars('author', e.author, isRtl));

  if (e.badges.fontSize != null) vars['--ovs-slot-badges-font-size'] = px(e.badges.fontSize);
  if (e.badges.opacity != null) vars['--ovs-slot-badges-opacity'] = String(e.badges.opacity);
  if (e.badges.margin != null) vars['--ovs-slot-badges-margin'] = px(e.badges.margin);
  Object.assign(vars, compileTransformVars('badges', e.badges, isRtl));

  if (e.message.fontFamily) vars['--ovs-slot-message-font-family'] = e.message.fontFamily;
  if (e.message.fontSize != null) vars['--ovs-slot-message-font-size'] = px(e.message.fontSize);
  if (e.message.color) vars['--ovs-slot-message-color'] = e.message.color;
  if (e.message.fontWeight != null) vars['--ovs-slot-message-font-weight'] = String(e.message.fontWeight);
  if (e.message.opacity != null) vars['--ovs-slot-message-opacity'] = String(e.message.opacity);
  if (e.message.margin != null) vars['--ovs-slot-message-margin'] = px(e.message.margin);
  Object.assign(vars, compileTransformVars('message', e.message, isRtl));

  Object.assign(vars, compileSlotBubblesToCssVariables(s, customizeConfig));

  return vars;
}

function componentOverridesToSlotStyle(componentOverrides) {
  const co = componentOverrides || {};
  const mapTransform = (src, target) => {
    if (src.rotate != null) target.rotate = src.rotate;
    if (src.translateX != null) target.translateX = src.translateX;
    if (src.translateY != null) target.translateY = src.translateY;
    if (src.transformOrigin != null) target.transformOrigin = src.transformOrigin;
    if (src.zIndex != null) target.zIndex = src.zIndex;
  };

  const mapText = (key, target) => {
    const src = co[key] || {};
    if (src.fontFamily != null) target.fontFamily = src.fontFamily;
    if (src.fontSize != null) target.fontSize = src.fontSize;
    if (src.color != null) target.color = src.color;
    if (src.fontWeight != null) target.fontWeight = src.fontWeight;
    if (src.opacity != null) target.opacity = src.opacity;
    if (src.visible != null) target.visible = src.visible;
    if (src.margin != null) target.margin = src.margin;
    mapTransform(src, target);
  };

  const slots = {
    avatar: {},
    author: {},
    badges: {},
    message: {},
  };

  mapText('Avatar', slots.avatar);
  mapText('Username', slots.author);
  mapText('Badges', slots.badges);
  mapText('Message', slots.message);

  if (co.Avatar?.size != null) slots.avatar.size = co.Avatar.size;
  if (co.Avatar?.borderRadius != null) slots.avatar.borderRadius = co.Avatar.borderRadius;
  if (co.Avatar?.borderWidth != null) slots.avatar.borderWidth = co.Avatar.borderWidth;
  if (co.Avatar?.borderStyle != null) slots.avatar.borderStyle = co.Avatar.borderStyle;
  if (co.Avatar?.borderColor != null) slots.avatar.borderColor = co.Avatar.borderColor;

  return { slots };
}

module.exports = {
  DEFAULT_SLOT_STYLE_CONFIG,
  mergeSlotStyleConfig,
  resolveEffectiveSlotStyle,
  resolveSlotVisibility,
  compileSlotStyleToCssVariables,
  componentOverridesToSlotStyle,
};
