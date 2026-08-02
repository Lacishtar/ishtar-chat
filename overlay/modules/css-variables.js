// Applies layout/slot-style/animation/role-style/decoration config objects
// to :root as CSS custom properties.
//
// The compile* functions used to be hand-copied mirrors of shared/*-config.js
// (each one previously carried a "Keep in sync with shared/X.js#fn" comment).
// They're now imported straight from the generated ESM bridge at /shared
// (see main/server/shared-esm-bridge.js), which serves shared/*.js — the same
// source the main process and dashboard use — converted to ES modules. There
// is now exactly one implementation of each; nothing here needs manual sync.

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

/**
 * Fan Service (see shared/fan-service-config.js) works by injecting a
 * *scoped* <style> block instead of writing to :root like the rest of this
 * file — its whole point is styling only Super Chat / membership rows
 * without touching everyone else's. A single <style> tag is created once
 * and its textContent replaced on every update, so re-applying doesn't leak
 * duplicate tags.
 */
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
  // rootFlags keys coming from shared/role-style-config.js are already the
  // real `data-ovs-role-*` attribute names, so no lookup table is needed here
  // (the old hand-copied version kept its own camelCase -> attribute map,
  // which was one more place to drift out of sync).
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
    // Shimmer — independent on/off + own speed/intensity, can run alongside float/slidex
    // (see shared/customize-config.js idleShimmerEnabled comment for why this is safe).
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

  // Overflow is only clipped on a bubble when it actually has a max/fixed
  // height cap in effect — clipping unconditionally would make flex items'
  // default content-protecting `min-height: auto` resolve to 0 instead
  // (per the flexbox spec, that automatic minimum only applies when
  // overflow is visible), collapsing bubbles that have no cap at all.
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