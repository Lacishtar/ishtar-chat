
import { state, listEl } from './state.js';
import { syncThemeModeClass } from './state.js';
import { refreshAllSlotVisibility } from './message-renderer.js';

import {
  normalizeBubbleWrapScreen,
  isRowBubbleWrap,
  compileLayoutToCssVariables,
} from '/shared/layout-config.mjs';
import {
  resolveEffectiveSlotStyle,
  compileSlotStyleToCssVariables,
} from '/shared/slot-style-config.mjs';
import { compileAnimationToCssVariables } from '/shared/animation-config.mjs';
import { compileRoleStyleToCssVariables } from '/shared/role-style-config.mjs';
import { compileBubbleDecorationToCssVariables } from '/shared/customize-config.mjs';
import { compileFanServiceCss } from '/shared/fan-service-config.mjs';

export { normalizeBubbleWrapScreen, isRowBubbleWrap, resolveEffectiveSlotStyle };

const FAN_SERVICE_STYLE_ID = 'ovs-fan-service-style';

// Fan Service (see shared/fan-service-config.js) works by injecting a
export function applyFanServiceStyle(fanServiceConfig) {
  let styleEl = document.getElementById(FAN_SERVICE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = FAN_SERVICE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = compileFanServiceCss(fanServiceConfig);
}

/** Inline :root vars for optional size caps — must be removed when disabled (0). */
const RESET_WHEN_UNSET = new Set([
  '--ovs-bubble-max-width',
  '--ovs-bubble-fixed-width',
  '--ovs-bubble-min-height',
  '--ovs-bubble-max-height',
  '--ovs-bubble-fixed-height',
  '--ovs-slot-author-bubble-max-width',
  '--ovs-slot-author-bubble-fixed-width',
  '--ovs-slot-author-bubble-min-height',
  '--ovs-slot-author-bubble-max-height',
  '--ovs-slot-author-bubble-fixed-height',
  '--ovs-slot-message-bubble-max-width',
  '--ovs-slot-message-bubble-fixed-width',
  '--ovs-slot-message-bubble-min-height',
  '--ovs-slot-message-bubble-max-height',
  '--ovs-slot-message-bubble-fixed-height',
]);

function applyRoleStyleFlags(rootFlags) {
  const root = document.documentElement;
  Object.entries(rootFlags).forEach(([attr, value]) => {
    if (value !== undefined) root.setAttribute(attr, value);
  });
}

export function applyCssVariables(config, layout, slotStyle, animationConfig, roleStyle) {
  const cfg = config || {};
  const root = document.documentElement;

  // Clear any existing role-specific custom properties from root style first
  const keysToRemove = [];
  for (let i = 0; i < root.style.length; i++) {
    const name = root.style[i];
    if (name.startsWith('--ovs-role-')) {
      keysToRemove.push(name);
    }
  }
  keysToRemove.forEach((key) => root.style.removeProperty(key));

  const roleCompiled = compileRoleStyleToCssVariables(roleStyle || state.currentRoleStyle);
  const map = {
    '--ovs-font-family': cfg.fontFamily,
    '--ovs-text-align': cfg.textAlign,
    '--ovs-font-size': cfg.fontSize != null ? `${cfg.fontSize}px` : undefined,
    '--ovs-text-color': cfg.textColor,
    '--ovs-author-color': cfg.authorColor,
    '--ovs-bubble-bg': cfg.bubbleBg,
    '--ovs-bubble-radius': cfg.bubbleRadius != null ? `${cfg.bubbleRadius}px` : undefined,
    '--ovs-bubble-opacity': cfg.bubbleOpacity != null ? String(cfg.bubbleOpacity) : undefined,
    '--ovs-avatar-size': cfg.avatarSize != null ? `${cfg.avatarSize}px` : undefined,
    '--ovs-animation-ms': cfg.animationMs != null ? `${cfg.animationMs}ms` : undefined,
    '--ovs-bubble-min-width': cfg.bubbleMinWidth != null ? `${cfg.bubbleMinWidth}px` : undefined,
    '--ovs-bubble-max-width': cfg.bubbleMaxWidth > 0 ? `${cfg.bubbleMaxWidth}px` : null,
    '--ovs-bubble-fixed-width': cfg.bubbleFixedWidth > 0 ? `${cfg.bubbleFixedWidth}px` : null,
    '--ovs-bubble-min-height': cfg.bubbleMinHeight > 0 ? `${cfg.bubbleMinHeight}px` : null,
    '--ovs-bubble-max-height': cfg.bubbleMaxHeight > 0 ? `${cfg.bubbleMaxHeight}px` : null,
    '--ovs-bubble-fixed-height': cfg.bubbleFixedHeight > 0 ? `${cfg.bubbleFixedHeight}px` : null,
    ...compileBubbleDecorationToCssVariables(cfg),
    ...compileLayoutToCssVariables(layout),
    ...compileSlotStyleToCssVariables(slotStyle || state.currentSlotStyle, cfg, layout || state.currentLayout),
    ...compileAnimationToCssVariables(animationConfig || state.currentAnimation, cfg),
    ...roleCompiled.vars,
    // Idle animation CSS variables (float/slidex)
    '--ovs-idle-animation-duration': cfg.idleAnimationSpeed != null ? `${cfg.idleAnimationSpeed}s` : '3s',
    '--ovs-idle-float-amplitude': cfg.idleAnimationIntensity != null ? `-${Math.abs(cfg.idleAnimationIntensity)}px` : '-5px',
    '--ovs-idle-slidex-amplitude': cfg.idleAnimationIntensity != null ? `${Math.abs(cfg.idleAnimationIntensity)}px` : '5px',
    '--ovs-idle-scale-amplitude': cfg.idleAnimationIntensity != null ? String(1 + Math.abs(cfg.idleAnimationIntensity) / 100) : '1.05',
    '--ovs-idle-shimmer-duration': cfg.idleShimmerSpeed != null ? `${cfg.idleShimmerSpeed}s` : '3s',
    '--ovs-idle-shimmer-opacity': cfg.idleShimmerIntensity != null
      ? String(Math.round(Math.min(Math.max(cfg.idleShimmerIntensity, 0), 20) * 10) / 1000)
      : '0.05',
  };
  Object.entries(map).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== 'undefinedpx') {
      root.style.setProperty(key, value);
    } else if (RESET_WHEN_UNSET.has(key)) {
      root.style.removeProperty(key);
    }
  });
  applyRoleStyleFlags(roleCompiled.rootFlags);

  root.dataset.ovsRowHeightCapped =
    map['--ovs-bubble-max-height'] != null || map['--ovs-bubble-fixed-height'] != null ? 'true' : 'false';
  root.dataset.ovsAuthorHeightCapped =
    map['--ovs-slot-author-bubble-max-height'] != null || map['--ovs-slot-author-bubble-fixed-height'] != null
      ? 'true'
      : 'false';
  root.dataset.ovsMessageHeightCapped =
    map['--ovs-slot-message-bubble-max-height'] != null || map['--ovs-slot-message-bubble-fixed-height'] != null
      ? 'true'
      : 'false';

  const screen = normalizeBubbleWrapScreen(layout?.screen || {});
  root.dataset.ovsBubbleWrapRow = isRowBubbleWrap(screen) ? 'true' : 'false';
  root.dataset.ovsBubbleWrapAuthor = !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? 'true' : 'false';
  root.dataset.ovsBubbleWrapMessage = !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? 'true' : 'false';
  root.dataset.ovsHeaderSplit = isRowBubbleWrap(screen) && screen.headerSplit ? 'true' : 'false';
  delete root.dataset.ovsBubbleScope;

  listEl.classList.toggle('ovs-position-top-down', config.position === 'top-down');
  // Which screen edge the Horizontal Bar row docks to — read by
  // overlay/horizontal-bar.css. Harmless to set even outside that mode.
  listEl.dataset.ovsHorizontalBarPosition = cfg.horizontalBarPosition === 'top' ? 'top' : 'bottom';

  // Set idle animation type on list element — CSS selector gates on this attribute
  const idleAnim = cfg.idleAnimation || 'none';
  listEl.dataset.ovsIdleAnimation = idleAnim;
  // Shimmer is independent — its own attribute, so it can be 'true' at the
  // same time data-ovs-idle-animation is 'float' or 'slidex'.
  listEl.dataset.ovsIdleShimmer = cfg.idleShimmerEnabled ? 'true' : 'false';
  // Stamp --ovs-idle-index on each existing message for staggered delay
  Array.from(listEl.children).forEach((el, i) => {
    el.style.setProperty('--ovs-idle-index', String(i));
  });

  syncThemeModeClass();
  refreshAllSlotVisibility();
}