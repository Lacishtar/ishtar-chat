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
import { toImageProxyUrl } from './utils.js';
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

export { normalizeBubbleWrapScreen, isRowBubbleWrap, resolveEffectiveSlotStyle };

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
  root.dataset.ovsHeaderSplit = isRowBubbleWrap(screen) && screen.headerSplit ? 'true' : 'false';
  delete root.dataset.ovsBubbleScope;

  listEl.classList.toggle('ovs-position-top-down', config.position === 'top-down');
  syncThemeModeClass();
  refreshAllSlotVisibility();
}
