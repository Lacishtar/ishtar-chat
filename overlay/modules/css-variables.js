// Compiles layout/slot-style/animation/role-style/decoration config objects
// into CSS custom properties, and applies them to :root. This is the JS
// mirror of the shared/*-config.js "compileXToCssVariables" functions —
// see the "Keep in sync with ..." comments above each function.

import { state, listEl } from './state.js';
import { px, toImageProxyUrl } from './utils.js';
import { syncThemeModeClass } from './state.js';
import { refreshAllSlotVisibility } from './message-renderer.js';

const ALIGN_TO_FLEX = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  left: 'flex-start',
  right: 'flex-end',
};

function directionToFlex(direction) {
  return direction === 'vertical' ? 'column' : 'row';
}

function flexDirectionForRow(rowDirection, mirrorHorizontal) {
  if (rowDirection === 'vertical') return 'column';
  return mirrorHorizontal ? 'row-reverse' : 'row';
}

// Keep in sync with shared/layout-config.js#mirrorAlign.
function mirrorAlign(align, shouldMirror) {
  if (!shouldMirror) return align;
  if (align === 'start' || align === 'left') return 'end';
  if (align === 'end' || align === 'right') return 'start';
  if (align === 'stretch') return 'end';
  return align;
}

// Keep in sync with shared/layout-config.js#normalizeBubbleWrapScreen.
export function normalizeBubbleWrapScreen(screen) {
  const s = screen || {};

  if (
    s.bubbleScope === 'message'
    && s.bubbleWrapRow == null
    && !s.bubbleWrapAuthor
    && !s.bubbleWrapMessage
  ) {
    return {
      ...s,
      bubbleWrapRow: false,
      bubbleWrapAuthor: false,
      bubbleWrapMessage: true,
      bubbleScope: null,
    };
  }

  if (s.bubbleWrapRow === false || s.bubbleWrapAuthor === true || s.bubbleWrapMessage === true) {
    return {
      ...s,
      bubbleWrapRow: false,
      bubbleWrapAuthor: Boolean(s.bubbleWrapAuthor),
      bubbleWrapMessage: Boolean(s.bubbleWrapMessage),
      bubbleScope: null,
    };
  }

  return {
    ...s,
    bubbleWrapRow: true,
    bubbleWrapAuthor: false,
    bubbleWrapMessage: false,
    bubbleScope: null,
  };
}

export function isRowBubbleWrap(screen) {
  return normalizeBubbleWrapScreen(screen).bubbleWrapRow === true;
}

// Keep in sync with shared/layout-config.js#compileLayoutToCssVariables.
function compileLayoutToCssVariables(layout) {
  const l = layout || {};
  const mr = l.messageRow || {};
  const meta = l.metaRow || {};
  const body = l.bodyColumn || {};
  const slots = l.slots || {};
  const screen = normalizeBubbleWrapScreen(l.screen || {});
  const mirrorHorizontal = screen.contentDirection === 'rtl';

  return {
    '--ovs-layout-message-direction': flexDirectionForRow(mr.direction || 'horizontal', mirrorHorizontal),
    '--ovs-layout-message-gap': px(mr.gap ?? 10),
    '--ovs-layout-message-align': ALIGN_TO_FLEX[mirrorAlign(mr.align, mirrorHorizontal && (mr.direction || 'horizontal') !== 'horizontal')] || 'flex-start',
    '--ovs-layout-message-padding': px(mr.padding ?? 0),
    '--ovs-layout-message-margin': px(mr.margin ?? 0),

    '--ovs-layout-meta-direction': flexDirectionForRow(meta.direction || 'horizontal', mirrorHorizontal),
    '--ovs-layout-meta-gap': px(meta.gap ?? 6),
    '--ovs-layout-meta-align': ALIGN_TO_FLEX[mirrorAlign(meta.align, mirrorHorizontal && (meta.direction || 'horizontal') !== 'horizontal')] || 'center',
    '--ovs-layout-meta-padding': px(meta.padding ?? 0),
    '--ovs-layout-meta-margin': px(meta.margin ?? 0),

    '--ovs-layout-body-direction': flexDirectionForRow(body.direction || 'vertical', mirrorHorizontal),
    '--ovs-layout-body-gap': px(body.gap ?? 2),
    '--ovs-layout-body-align': ALIGN_TO_FLEX[mirrorAlign(body.align, mirrorHorizontal && (body.direction || 'vertical') !== 'horizontal')] || 'stretch',
    '--ovs-layout-body-padding': px(body.padding ?? 0),
    '--ovs-layout-body-margin': px(body.margin ?? 0),

    '--ovs-layout-slot-avatar-order': String(slots.avatar?.order ?? 0),
    '--ovs-layout-slot-avatar-padding': px(slots.avatar?.padding ?? 0),
    '--ovs-layout-slot-avatar-margin': px(slots.avatar?.margin ?? 0),
    '--ovs-layout-slot-avatar-position': slots.avatar?.position === 'absolute' ? 'absolute' : 'static',
    '--ovs-layout-slot-avatar-top': offsetVarLocal(slots.avatar?.top),
    '--ovs-layout-slot-avatar-left': offsetVarLocal(slots.avatar?.left),
    '--ovs-layout-slot-avatar-right': offsetVarLocal(slots.avatar?.right),
    '--ovs-layout-slot-avatar-bottom': offsetVarLocal(slots.avatar?.bottom),
    '--ovs-layout-slot-avatar-z-index': zIndexVarLocal(slots.avatar?.zIndex),

    '--ovs-layout-slot-author-order': String(slots.author?.order ?? 0),
    '--ovs-layout-slot-author-padding': px(slots.author?.padding ?? 0),
    '--ovs-layout-slot-author-margin': px(slots.author?.margin ?? 0),
    '--ovs-layout-slot-author-position': slots.author?.position === 'absolute' ? 'absolute' : 'static',
    '--ovs-layout-slot-author-top': offsetVarLocal(slots.author?.top),
    '--ovs-layout-slot-author-left': offsetVarLocal(slots.author?.left),
    '--ovs-layout-slot-author-right': offsetVarLocal(slots.author?.right),
    '--ovs-layout-slot-author-bottom': offsetVarLocal(slots.author?.bottom),
    '--ovs-layout-slot-author-z-index': zIndexVarLocal(slots.author?.zIndex),

    '--ovs-layout-slot-badges-order': String(slots.badges?.order ?? 1),
    '--ovs-layout-slot-badges-padding': px(slots.badges?.padding ?? 0),
    '--ovs-layout-slot-badges-margin': px(slots.badges?.margin ?? 0),
    '--ovs-layout-slot-badges-position': slots.badges?.position === 'absolute' ? 'absolute' : 'static',
    '--ovs-layout-slot-badges-top': offsetVarLocal(slots.badges?.top),
    '--ovs-layout-slot-badges-left': offsetVarLocal(slots.badges?.left),
    '--ovs-layout-slot-badges-right': offsetVarLocal(slots.badges?.right),
    '--ovs-layout-slot-badges-bottom': offsetVarLocal(slots.badges?.bottom),
    '--ovs-layout-slot-badges-z-index': zIndexVarLocal(slots.badges?.zIndex),

    '--ovs-layout-slot-message-order': String(slots.message?.order ?? 1),
    '--ovs-layout-slot-message-padding': px(slots.message?.padding ?? 0),
    '--ovs-layout-slot-message-margin': px(slots.message?.margin ?? 0),
    '--ovs-layout-slot-message-position': slots.message?.position === 'absolute' ? 'absolute' : 'static',
    '--ovs-layout-slot-message-top': offsetVarLocal(slots.message?.top),
    '--ovs-layout-slot-message-left': offsetVarLocal(slots.message?.left),
    '--ovs-layout-slot-message-right': offsetVarLocal(slots.message?.right),
    '--ovs-layout-slot-message-bottom': offsetVarLocal(slots.message?.bottom),
    '--ovs-layout-slot-message-z-index': zIndexVarLocal(slots.message?.zIndex),

    '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
    '--ovs-layout-chat-gap': px(screen.chatGap ?? 10),
    '--ovs-layout-content-direction': 'ltr',
    '--ovs-bubble-wrap-row': isRowBubbleWrap(screen) ? '1' : '0',
    '--ovs-bubble-wrap-author': !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? '1' : '0',
    '--ovs-bubble-wrap-message': !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? '1' : '0',
  };
}

// Local aliases so this file doesn't need to re-import offsetVar/zIndexVar
// under names that collide with layout-config's own historical names.
function offsetVarLocal(value) {
  return value != null && Number.isFinite(Number(value)) ? px(value) : 'auto';
}
function zIndexVarLocal(value) {
  return value != null && Number.isFinite(Number(value)) ? String(value) : 'auto';
}

// Keep in sync with shared/slot-style-config.js#resolveEffectiveSlotStyle.
export function resolveEffectiveSlotStyle(slotStyle, customizeConfig) {
  const cfg = customizeConfig || {};
  const slots = (slotStyle && slotStyle.slots) || {};
  const g = (key, fallback) => (slots[key] && slots[key][fallback] !== undefined && slots[key][fallback] !== null
    ? slots[key][fallback]
    : undefined);

  const slotVis = (slotKey, globalKey, defaultVal) => {
    const layoutVis = state.currentLayout.slots?.[slotKey]?.visible;
    const styleVis = g(slotKey, 'visible');
    if (layoutVis !== undefined && layoutVis !== null) return Boolean(layoutVis);
    if (styleVis !== undefined && styleVis !== null) return Boolean(styleVis);
    if (cfg[globalKey] !== undefined) return Boolean(cfg[globalKey]);
    return defaultVal;
  };

  return {
    avatar: {
      visible: slotVis('avatar', 'showAvatar', true),
      size: g('avatar', 'size') ?? cfg.avatarSize ?? 32,
    },
    author: { visible: slotVis('author', null, true) },
    badges: { visible: slotVis('badges', 'showBadges', true) },
    message: { visible: slotVis('message', null, true) },
  };
}

// Keep in sync with shared/slot-bubble-config.js#compileSlotBubbleDecoration.
function compileSlotBubbleDecoration(prefix, slot, globalConfig) {
  const cfg = globalConfig || {};
  const isSetLocal = (v) => v !== undefined && v !== null;
  const resolve = (key) => (isSetLocal(slot?.[key]) ? slot[key] : cfg[key]);
  const vars = {};
  const pxLocal = (v) => (Number.isFinite(Number(v)) ? `${Number(v)}px` : undefined);

  const bg = resolve('bubbleBg');
  if (bg) vars[`--ovs-slot-${prefix}-bubble-bg`] = bg;
  if (resolve('bubbleRadius') != null) vars[`--ovs-slot-${prefix}-bubble-radius`] = pxLocal(resolve('bubbleRadius'));
  if (resolve('bubbleOpacity') != null) vars[`--ovs-slot-${prefix}-bubble-opacity`] = String(resolve('bubbleOpacity'));
  if (isSetLocal(resolve('bubbleBorderWidth'))) vars[`--ovs-slot-${prefix}-bubble-border-width`] = pxLocal(resolve('bubbleBorderWidth'));
  if (isSetLocal(resolve('bubbleBorderStyle'))) vars[`--ovs-slot-${prefix}-bubble-border-style`] = resolve('bubbleBorderStyle');
  if (isSetLocal(resolve('bubbleBorderColor'))) vars[`--ovs-slot-${prefix}-bubble-border-color`] = resolve('bubbleBorderColor');
  if (isSetLocal(resolve('bubbleBorderOffset'))) vars[`--ovs-slot-${prefix}-bubble-border-offset`] = pxLocal(resolve('bubbleBorderOffset'));
  if (isSetLocal(resolve('bubbleBoxShadow'))) vars[`--ovs-slot-${prefix}-bubble-box-shadow`] = resolve('bubbleBoxShadow');
  if (isSetLocal(resolve('bubbleGlow'))) vars[`--ovs-slot-${prefix}-bubble-glow`] = resolve('bubbleGlow');

  const padX = isSetLocal(resolve('bubblePaddingX'))
    ? resolve('bubblePaddingX')
    : (isSetLocal(resolve('bubblePadding')) ? resolve('bubblePadding') : null);
  const padY = isSetLocal(resolve('bubblePaddingY'))
    ? resolve('bubblePaddingY')
    : (isSetLocal(resolve('bubblePadding')) ? resolve('bubblePadding') : null);
  if (padX != null) vars[`--ovs-slot-${prefix}-bubble-pad-x`] = pxLocal(padX);
  if (padY != null) vars[`--ovs-slot-${prefix}-bubble-pad-y`] = pxLocal(padY);

  const padTop = isSetLocal(resolve('bubblePaddingTop')) ? resolve('bubblePaddingTop') : padY;
  const padRight = isSetLocal(resolve('bubblePaddingRight')) ? resolve('bubblePaddingRight') : padX;
  const padBottom = isSetLocal(resolve('bubblePaddingBottom')) ? resolve('bubblePaddingBottom') : padY;
  const padLeft = isSetLocal(resolve('bubblePaddingLeft')) ? resolve('bubblePaddingLeft') : padX;
  if (padTop != null) vars[`--ovs-slot-${prefix}-bubble-pad-top`] = pxLocal(padTop);
  if (padRight != null) vars[`--ovs-slot-${prefix}-bubble-pad-right`] = pxLocal(padRight);
  if (padBottom != null) vars[`--ovs-slot-${prefix}-bubble-pad-bottom`] = pxLocal(padBottom);
  if (padLeft != null) vars[`--ovs-slot-${prefix}-bubble-pad-left`] = pxLocal(padLeft);

  if (resolve('bubbleMinWidth') != null) vars[`--ovs-slot-${prefix}-bubble-min-width`] = pxLocal(resolve('bubbleMinWidth'));

  const clampPctLocal = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
  };
  if (resolve('bubbleBunnyEarsWidth') != null) vars[`--ovs-slot-${prefix}-bunny-ears-width`] = pxLocal(resolve('bubbleBunnyEarsWidth'));
  if (resolve('bubbleBunnyEarsHeight') != null) vars[`--ovs-slot-${prefix}-bunny-ears-height`] = pxLocal(resolve('bubbleBunnyEarsHeight'));
  if (resolve('bubbleBunnyEarsRoundness') != null) vars[`--ovs-slot-${prefix}-bunny-ears-radius-v`] = `${clampPctLocal(resolve('bubbleBunnyEarsRoundness'))}%`;
  if (resolve('bubbleBunnyEarsOffsetX') != null) vars[`--ovs-slot-${prefix}-bunny-ears-offset-x`] = pxLocal(resolve('bubbleBunnyEarsOffsetX'));
  if (resolve('bubbleBunnyEarsOffsetY') != null) vars[`--ovs-slot-${prefix}-bunny-ears-top`] = pxLocal(-Math.abs(Number(resolve('bubbleBunnyEarsOffsetY')) || 0));
  if (resolve('bubbleBunnyEarsZIndex') != null) vars[`--ovs-slot-${prefix}-bunny-ears-z`] = String(Math.round(Number(resolve('bubbleBunnyEarsZIndex')) || 0));
  return vars;
}

// Keep in sync with shared/slot-style-config.js#compileSlotStyleToCssVariables.
function compileSlotStyleToCssVariables(slotStyle, customizeConfig, layoutConfig) {
  const cfg = customizeConfig || {};
  const slots = (slotStyle && slotStyle.slots) || {};
  const pick = (slot, key) => (slots[slot] && slots[slot][key] != null ? slots[slot][key] : null);
  const pickTransform = (slot) => {
    let defaultOrigin = 'center center';
    if (slot === 'message') {
      const isRtl = layoutConfig?.screen?.contentDirection === 'rtl';
      defaultOrigin = isRtl ? 'right center' : 'left center';
    }
    return {
      rotate: pick(slot, 'rotate') ?? 0,
      translateX: pick(slot, 'translateX') ?? 0,
      translateY: pick(slot, 'translateY') ?? 0,
      transformOrigin: pick(slot, 'transformOrigin') ?? defaultOrigin,
      zIndex: pick(slot, 'zIndex') ?? null,
    };
  };
  const assignTransform = (prefix, t) => {
    vars[`--ovs-slot-${prefix}-rotate`] = `${t.rotate}deg`;
    vars[`--ovs-slot-${prefix}-translate-x`] = px(t.translateX);
    vars[`--ovs-slot-${prefix}-translate-y`] = px(t.translateY);
    vars[`--ovs-slot-${prefix}-transform-origin`] = t.transformOrigin;
    if (t.zIndex != null) {
      vars[`--ovs-slot-${prefix}-z-index`] = String(t.zIndex);
    }
  };
  const vars = {};

  const avatarSize = pick('avatar', 'size') ?? cfg.avatarSize;
  if (avatarSize != null) vars['--ovs-slot-avatar-size'] = px(avatarSize);
  const avatarRadius = pick('avatar', 'borderRadius');
  if (avatarRadius != null) {
    vars['--ovs-slot-avatar-border-radius'] = typeof avatarRadius === 'string' && avatarRadius.includes('%')
      ? avatarRadius
      : px(avatarRadius);
  }
  if (pick('avatar', 'borderWidth') != null) vars['--ovs-slot-avatar-border-width'] = px(pick('avatar', 'borderWidth'));
  if (pick('avatar', 'borderStyle') != null) vars['--ovs-slot-avatar-border-style'] = pick('avatar', 'borderStyle');
  if (pick('avatar', 'borderColor') != null) vars['--ovs-slot-avatar-border-color'] = pick('avatar', 'borderColor');
  if (pick('avatar', 'borderOffset') != null) vars['--ovs-slot-avatar-border-offset'] = px(pick('avatar', 'borderOffset'));
  if (pick('avatar', 'opacity') != null) vars['--ovs-slot-avatar-opacity'] = String(pick('avatar', 'opacity'));
  if (pick('avatar', 'margin') != null) vars['--ovs-slot-avatar-margin'] = px(pick('avatar', 'margin'));
  assignTransform('avatar', pickTransform('avatar'));

  const authorFont = pick('author', 'fontFamily') ?? cfg.fontFamily;
  const authorSize = pick('author', 'fontSize') ?? (cfg.fontSize != null ? Math.round(cfg.fontSize * 0.9) : null);
  if (authorFont) vars['--ovs-slot-author-font-family'] = authorFont;
  if (authorSize != null) vars['--ovs-slot-author-font-size'] = px(authorSize);
  if (pick('author', 'color') ?? cfg.authorColor) vars['--ovs-slot-author-color'] = pick('author', 'color') ?? cfg.authorColor;
  if (pick('author', 'fontWeight') != null) vars['--ovs-slot-author-font-weight'] = String(pick('author', 'fontWeight'));
  if (pick('author', 'opacity') != null) vars['--ovs-slot-author-opacity'] = String(pick('author', 'opacity'));
  if (pick('author', 'margin') != null) vars['--ovs-slot-author-margin'] = px(pick('author', 'margin'));
  assignTransform('author', pickTransform('author'));

  const badgesSize = pick('badges', 'fontSize') ?? (cfg.fontSize != null ? Math.round(cfg.fontSize * 0.65) : null);
  if (badgesSize != null) vars['--ovs-slot-badges-font-size'] = px(badgesSize);
  if (pick('badges', 'opacity') != null) vars['--ovs-slot-badges-opacity'] = String(pick('badges', 'opacity'));
  if (pick('badges', 'margin') != null) vars['--ovs-slot-badges-margin'] = px(pick('badges', 'margin'));
  assignTransform('badges', pickTransform('badges'));

  const msgFont = pick('message', 'fontFamily') ?? cfg.fontFamily;
  const msgSize = pick('message', 'fontSize') ?? cfg.fontSize;
  if (msgFont) vars['--ovs-slot-message-font-family'] = msgFont;
  if (msgSize != null) vars['--ovs-slot-message-font-size'] = px(msgSize);
  if (pick('message', 'color') ?? cfg.textColor) vars['--ovs-slot-message-color'] = pick('message', 'color') ?? cfg.textColor;
  if (pick('message', 'fontWeight') != null) vars['--ovs-slot-message-font-weight'] = String(pick('message', 'fontWeight'));
  if (pick('message', 'opacity') != null) vars['--ovs-slot-message-opacity'] = String(pick('message', 'opacity'));
  if (pick('message', 'margin') != null) vars['--ovs-slot-message-margin'] = px(pick('message', 'margin'));
  assignTransform('message', pickTransform('message'));

  Object.assign(vars, compileSlotBubbleDecoration('author', slots.author, cfg));
  Object.assign(vars, compileSlotBubbleDecoration('message', slots.message, cfg));

  return vars;
}

// Keep in sync with shared/animation-config.js#compileAnimationToCssVariables.
function compileAnimationToCssVariables(animationConfig, customizeConfig) {
  const cfg = customizeConfig || {};
  const anim = animationConfig || {};
  const targets = anim.targets || {};
  const base = cfg.animationMs ?? 220;
  const enabled = anim.enabled !== false;
  const vars = { '--ovs-anim-enabled': enabled ? '1' : '0' };

  ['avatar', 'author', 'badges', 'message'].forEach((slot) => {
    const t = targets[slot] || {};
    vars[`--ovs-anim-${slot}-duration`] = `${t.durationMs ?? base}ms`;
    vars[`--ovs-anim-${slot}-delay`] = `${t.delayMs ?? 0}ms`;
    vars[`--ovs-anim-${slot}-easing`] = t.easing || 'ease-out';
    vars[`--ovs-anim-${slot}-translate-x`] = `${t.translateX ?? 0}px`;
    vars[`--ovs-anim-${slot}-translate-y`] = `${t.translateY ?? 0}px`;
    vars[`--ovs-anim-${slot}-scale`] = String(t.scale ?? 1);
    vars[`--ovs-anim-${slot}-blur`] = `${t.blur ?? 0}px`;
  });
  return vars;
}

function compileBubbleDecorationToCssVariables(config) {
  const c = config || {};
  const vars = {};
  const pxLocal = (v) => (Number.isFinite(Number(v)) ? `${Number(v)}px` : undefined);
  const isSetLocal = (v) => v !== undefined && v !== null;

  if (isSetLocal(c.bubbleBorderWidth)) vars['--ovs-bubble-border-width'] = pxLocal(c.bubbleBorderWidth);
  if (isSetLocal(c.bubbleBorderStyle)) vars['--ovs-bubble-border-style'] = c.bubbleBorderStyle;
  if (isSetLocal(c.bubbleBorderColor)) vars['--ovs-bubble-border-color'] = c.bubbleBorderColor;
  if (isSetLocal(c.bubbleBoxShadow)) vars['--ovs-bubble-box-shadow'] = c.bubbleBoxShadow;
  if (isSetLocal(c.bubbleGlow)) vars['--ovs-bubble-glow'] = c.bubbleGlow;

  const padX = isSetLocal(c.bubblePaddingX) ? c.bubblePaddingX : (isSetLocal(c.bubblePadding) ? c.bubblePadding : null);
  const padY = isSetLocal(c.bubblePaddingY) ? c.bubblePaddingY : (isSetLocal(c.bubblePadding) ? c.bubblePadding : null);
  if (padX != null) vars['--ovs-bubble-pad-x'] = pxLocal(padX);
  if (padY != null) vars['--ovs-bubble-pad-y'] = pxLocal(padY);

  const padTop = isSetLocal(c.bubblePaddingTop) ? c.bubblePaddingTop : padY;
  const padRight = isSetLocal(c.bubblePaddingRight) ? c.bubblePaddingRight : padX;
  const padBottom = isSetLocal(c.bubblePaddingBottom) ? c.bubblePaddingBottom : padY;
  const padLeft = isSetLocal(c.bubblePaddingLeft) ? c.bubblePaddingLeft : padX;
  if (padTop != null) vars['--ovs-bubble-pad-top'] = pxLocal(padTop);
  if (padRight != null) vars['--ovs-bubble-pad-right'] = pxLocal(padRight);
  if (padBottom != null) vars['--ovs-bubble-pad-bottom'] = pxLocal(padBottom);
  if (padLeft != null) vars['--ovs-bubble-pad-left'] = pxLocal(padLeft);

  const clampPctLocal = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
  };
  if (isSetLocal(c.bubbleBunnyEarsWidth)) vars['--ovs-bunny-ears-width'] = pxLocal(c.bubbleBunnyEarsWidth);
  if (isSetLocal(c.bubbleBunnyEarsHeight)) vars['--ovs-bunny-ears-height'] = pxLocal(c.bubbleBunnyEarsHeight);
  if (isSetLocal(c.bubbleBunnyEarsRoundness)) vars['--ovs-bunny-ears-radius-v'] = `${clampPctLocal(c.bubbleBunnyEarsRoundness)}%`;
  if (isSetLocal(c.bubbleBunnyEarsOffsetX)) vars['--ovs-bunny-ears-offset-x'] = pxLocal(c.bubbleBunnyEarsOffsetX);
  if (isSetLocal(c.bubbleBunnyEarsOffsetY)) vars['--ovs-bunny-ears-top'] = pxLocal(-Math.abs(Number(c.bubbleBunnyEarsOffsetY) || 0));
  if (isSetLocal(c.bubbleBunnyEarsRotate)) vars['--ovs-bunny-ears-rotate'] = `${Number(c.bubbleBunnyEarsRotate) || 0}deg`;
  if (isSetLocal(c.bubbleBunnyEarsZIndex)) vars['--ovs-bunny-ears-z'] = String(Math.round(Number(c.bubbleBunnyEarsZIndex) || 0));

  return vars;
}

// Keep in sync with shared/role-style-config.js#compileRoleStyleToCssVariables.
function compileRoleStyleToCssVariables(roleStyle) {
  const roles = roleStyle?.roles || {};
  const vars = {};
  const rootFlags = {};
  const defs = {
    moderator: {
      prefix: 'mod',
      authorColor: '#fca5a5',
      messageBg: '#f87171',
      messageTextColor: '#ffffff',
      badge: 'MOD',
      badgePosition: 'before',
    },
    member: {
      prefix: 'member',
      authorColor: '#93c5fd',
      messageBg: '#60a5fa',
      messageTextColor: '#ffffff',
      badge: '★',
      badgePosition: 'before',
    },
    superchat: {
      prefix: 'superchat',
      authorColor: '#fde047',
      messageBg: '#facc15',
      messageTextColor: '#1f2937',
      badge: '✦',
      badgePosition: 'before',
      showAmount: true,
    },
  };

  Object.keys(defs).forEach((roleKey) => {
    const def = defs[roleKey];
    const role = { ...def, ...(roles[roleKey] || {}) };
    const prefix = def.prefix;
    const enabled = role.enabled !== false;
    rootFlags[`ovsRole${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}Enabled`] = enabled ? 'true' : 'false';

    if (!enabled) return;

    const messageBg = role.messageBg || role.messageBgColor;
    const rowBg = role.rowBg || role.rowBgColor;

    if (role.authorColor) vars[`--ovs-role-${prefix}-author-color`] = role.authorColor;
    if (role.authorBg) {
      vars[`--ovs-role-${prefix}-author-bg`] = role.authorBg;
      rootFlags[`ovsRole${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}AuthorBg`] = 'true';
    } else {
      rootFlags[`ovsRole${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}AuthorBg`] = 'false';
    }
    if (role.authorBorderColor) vars[`--ovs-role-${prefix}-author-border-color`] = role.authorBorderColor;
    if (messageBg) vars[`--ovs-role-${prefix}-message-bg`] = messageBg;
    if (role.messageBorderColor) vars[`--ovs-role-${prefix}-message-border-color`] = role.messageBorderColor;
    if (role.messageTextColor) vars[`--ovs-role-${prefix}-message-text-color`] = role.messageTextColor;
    if (rowBg) vars[`--ovs-role-${prefix}-row-bg`] = rowBg;
    if (role.rowBorderColor) vars[`--ovs-role-${prefix}-row-border-color`] = role.rowBorderColor;
    vars[`--ovs-role-${prefix}-badge-before-content`] = role.badgeBefore
      ? `"${String(role.badgeBefore).replace(/"/g, '\\"')}"`
      : 'none';
    vars[`--ovs-role-${prefix}-badge-after-content`] = role.badgeAfter
      ? `"${String(role.badgeAfter).replace(/"/g, '\\"')}"`
      : 'none';

    if (roleKey === 'superchat') {
      rootFlags.ovsRoleSuperchatShowAmount = role.showAmount === false ? 'false' : 'true';
    }
  });

  return { vars, rootFlags };
}

function applyRoleStyleFlags(rootFlags) {
  const root = document.documentElement;
  const map = {
    ovsRoleModEnabled: 'data-ovs-role-mod-enabled',
    ovsRoleMemberEnabled: 'data-ovs-role-member-enabled',
    ovsRoleSuperchatEnabled: 'data-ovs-role-superchat-enabled',
    ovsRoleSuperchatShowAmount: 'data-ovs-role-superchat-show-amount',
    ovsRoleModAuthorBg: 'data-ovs-role-mod-author-bg',
    ovsRoleMemberAuthorBg: 'data-ovs-role-member-author-bg',
    ovsRoleSuperchatAuthorBg: 'data-ovs-role-superchat-author-bg',
  };
  Object.entries(map).forEach(([key, attr]) => {
    if (rootFlags[key] !== undefined) root.setAttribute(attr, rootFlags[key]);
  });
}

export function applyCssVariables(config, layout, slotStyle, animationConfig, roleStyle) {
  const cfg = config || {};
  const root = document.documentElement;
  const roleCompiled = compileRoleStyleToCssVariables(roleStyle || state.currentRoleStyle);
  const map = {
    '--ovs-font-family': cfg.fontFamily,
    '--ovs-font-size': cfg.fontSize != null ? `${cfg.fontSize}px` : undefined,
    '--ovs-text-color': cfg.textColor,
    '--ovs-author-color': cfg.authorColor,
    '--ovs-bubble-bg': cfg.bubbleBg,
    '--ovs-bubble-radius': cfg.bubbleRadius != null ? `${cfg.bubbleRadius}px` : undefined,
    '--ovs-bubble-opacity': cfg.bubbleOpacity != null ? String(cfg.bubbleOpacity) : undefined,
    '--ovs-avatar-size': cfg.avatarSize != null ? `${cfg.avatarSize}px` : undefined,
    '--ovs-animation-ms': cfg.animationMs != null ? `${cfg.animationMs}ms` : undefined,
    '--ovs-bubble-texture-url': cfg.bubbleTextureUrl && typeof cfg.bubbleTextureUrl === 'string' && cfg.bubbleTextureUrl.trim()
      ? `url("${toImageProxyUrl(cfg.bubbleTextureUrl) || cfg.bubbleTextureUrl.trim()}")`
      : 'none',
    '--ovs-bubble-texture-repeat': cfg.bubbleTextureRepeat || 'repeat',
    '--ovs-bubble-texture-size': typeof cfg.bubbleTextureSize === 'number' ? `${cfg.bubbleTextureSize}px` : (cfg.bubbleTextureSize || 'auto'),
    '--ovs-bubble-texture-opacity': cfg.bubbleTextureOpacity != null ? String(cfg.bubbleTextureOpacity) : undefined,
    '--ovs-bubble-min-width': cfg.bubbleMinWidth != null ? `${cfg.bubbleMinWidth}px` : undefined,
    ...compileBubbleDecorationToCssVariables(cfg),
    ...compileLayoutToCssVariables(layout),
    ...compileSlotStyleToCssVariables(slotStyle || state.currentSlotStyle, cfg, layout || state.currentLayout),
    ...compileAnimationToCssVariables(animationConfig || state.currentAnimation, cfg),
    ...roleCompiled.vars,
  };
  Object.entries(map).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== 'undefinedpx') {
      root.style.setProperty(key, value);
    }
  });
  applyRoleStyleFlags(roleCompiled.rootFlags);

  const screen = normalizeBubbleWrapScreen(layout?.screen || {});
  root.dataset.ovsBubbleWrapRow = isRowBubbleWrap(screen) ? 'true' : 'false';
  root.dataset.ovsBubbleWrapAuthor = !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? 'true' : 'false';
  root.dataset.ovsBubbleWrapMessage = !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? 'true' : 'false';
  delete root.dataset.ovsBubbleScope;

  listEl.classList.toggle('ovs-position-top-down', config.position === 'top-down');
  syncThemeModeClass();
  refreshAllSlotVisibility();
}
