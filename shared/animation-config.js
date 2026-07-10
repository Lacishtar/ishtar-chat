/**
 * AnimationConfig — per-slot entrance animation (Avatar, Username, Badges, Message).
 * Compiled to --ovs-anim-* CSS variables. Falls back to CustomizeConfig.animationMs.
 */

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');

function createSlotAnimDefaults(overrides = {}) {
  return {
    durationMs: null,
    delayMs: 0,
    easing: 'ease-out',
    translateX: 0,
    translateY: 0,
    scale: 1,
    blur: 0,
    ...overrides,
  };
}

const DEFAULT_ANIMATION_CONFIG = {
  enabled: true,
  style: 'slide',
  targets: {
    avatar: createSlotAnimDefaults({ delayMs: 0, translateY: 8 }),
    author: createSlotAnimDefaults({ delayMs: 40, translateX: -6 }),
    badges: createSlotAnimDefaults({ delayMs: 60, translateX: -4 }),
    message: createSlotAnimDefaults({ delayMs: 80, translateY: 6 }),
  },
};

// Base entrance direction per slot at translateScale=1 — the "shape" every
// style preset scales up/down/away from. Keeps the avatar dropping in from
// above, author/badges sliding in from the left, and message rising up,
// regardless of which style is active.
const BASE_TARGET_DIRECTIONS = {
  avatar: { delayMs: 0, translateX: 0, translateY: 8 },
  author: { delayMs: 40, translateX: -6, translateY: 0 },
  badges: { delayMs: 60, translateX: -4, translateY: 0 },
  message: { delayMs: 80, translateX: 0, translateY: 6 },
};

/**
 * Named animation "styles" pickable from the Customize Panel. Each one is a
 * small transform on top of BASE_TARGET_DIRECTIONS: how far things travel,
 * what they scale from, how blurry they start, and what easing sells the
 * motion (e.g. a back-out curve for the bounce/zoom overshoot).
 */
const ANIMATION_STYLE_PRESETS = {
  slide: { label: 'Trượt nhẹ', easing: 'ease-out', translateScale: 1, scale: 1, blur: 0 },
  bounce: { label: 'Nảy', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', translateScale: 2, scale: 0.85, blur: 0 },
  zoom: { label: 'Phóng to', easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)', translateScale: 0, scale: 0.4, blur: 0 },
  slideStrong: { label: 'Trượt ngang mạnh', easing: 'cubic-bezier(0.16, 1, 0.3, 1)', translateScale: 6, scale: 1, blur: 0 },
  blurZoom: { label: 'Mờ dần + zoom', easing: 'ease-out', translateScale: 0, scale: 1.08, blur: 10 },
};

/** Expands a named style into full per-slot targets (used whenever `style` changes). */
function expandAnimationStyle(style) {
  const preset = ANIMATION_STYLE_PRESETS[style] || ANIMATION_STYLE_PRESETS.slide;

  const targets = {};
  Object.entries(BASE_TARGET_DIRECTIONS).forEach(([slot, dir]) => {
    targets[slot] = createSlotAnimDefaults({
      // durationMs stays null (not a fixed snapshot) so the "Tốc độ hiệu ứng"
      // slider (customizeConfig.animationMs) keeps driving speed even after
      // a style has been picked — see resolveEffectiveAnimation's fallback.
      delayMs: dir.delayMs,
      easing: preset.easing,
      translateX: dir.translateX * preset.translateScale,
      translateY: dir.translateY * preset.translateScale,
      scale: preset.scale,
      blur: preset.blur,
    });
  });

  return { style, targets };
}

function mergeAnimationConfig(base, overrides) {
  const b = base || DEFAULT_ANIMATION_CONFIG;
  let o = overrides || {};

  // Picking a new named style (without explicit per-slot overrides) expands
  // it into concrete targets so the CSS vars/keyframes below have real
  // numbers to animate — the caller just needs to send `{ style: 'bounce' }`.
  if (o.style && o.style !== b.style && !o.targets) {
    o = { ...o, targets: expandAnimationStyle(o.style).targets };
  }

  const mergeTarget = (key) => ({
    ...b.targets[key],
    ...(o.targets?.[key] || {}),
  });
  return {
    enabled: o.enabled !== undefined ? o.enabled : b.enabled,
    style: o.style !== undefined ? o.style : (b.style || 'slide'),
    targets: {
      avatar: mergeTarget('avatar'),
      author: mergeTarget('author'),
      badges: mergeTarget('badges'),
      message: mergeTarget('message'),
    },
  };
}

function resolveEffectiveAnimation(animationConfig, customizeConfig) {
  const cfg = { ...DEFAULT_CUSTOMIZE_CONFIG, ...customizeConfig };
  const anim = mergeAnimationConfig(DEFAULT_ANIMATION_CONFIG, animationConfig);
  const baseDuration = cfg.animationMs ?? 220;

  const resolve = (target) => ({
    durationMs: target.durationMs ?? baseDuration,
    delayMs: target.delayMs ?? 0,
    easing: target.easing || 'ease-out',
    translateX: target.translateX ?? 0,
    translateY: target.translateY ?? 0,
    scale: target.scale ?? 1,
    blur: target.blur ?? 0,
  });

  return {
    enabled: anim.enabled !== false,
    style: anim.style || 'slide',
    targets: {
      avatar: resolve(anim.targets.avatar),
      author: resolve(anim.targets.author),
      badges: resolve(anim.targets.badges),
      message: resolve(anim.targets.message),
    },
  };
}

function compileAnimationToCssVariables(animationConfig, customizeConfig) {
  const e = resolveEffectiveAnimation(animationConfig, customizeConfig);
  const vars = {
    '--ovs-anim-enabled': e.enabled ? '1' : '0',
  };

  ['avatar', 'author', 'badges', 'message'].forEach((slot) => {
    const t = e.targets[slot];
    vars[`--ovs-anim-${slot}-duration`] = `${t.durationMs}ms`;
    vars[`--ovs-anim-${slot}-delay`] = `${t.delayMs}ms`;
    vars[`--ovs-anim-${slot}-easing`] = t.easing;
    vars[`--ovs-anim-${slot}-translate-x`] = `${t.translateX}px`;
    vars[`--ovs-anim-${slot}-translate-y`] = `${t.translateY}px`;
    vars[`--ovs-anim-${slot}-scale`] = String(t.scale);
    vars[`--ovs-anim-${slot}-blur`] = `${t.blur}px`;
  });

  return vars;
}

/** Simplified shape for AnimationPanel UI. */
function contractSimpleAnimation(animationConfig, customizeConfig) {
  const e = resolveEffectiveAnimation(animationConfig, customizeConfig);
  return {
    enabled: e.enabled,
    avatarDuration: e.targets.avatar.durationMs,
    avatarDelay: e.targets.avatar.delayMs,
    authorDuration: e.targets.author.durationMs,
    authorDelay: e.targets.author.delayMs,
    badgesDuration: e.targets.badges.durationMs,
    badgesDelay: e.targets.badges.delayMs,
    messageDuration: e.targets.message.durationMs,
    messageDelay: e.targets.message.delayMs,
  };
}

function expandSimpleAnimation(simple, customizeConfig) {
  const cfg = { ...DEFAULT_CUSTOMIZE_CONFIG, ...customizeConfig };
  const base = cfg.animationMs ?? 220;
  const s = {
    enabled: true,
    avatarDuration: base,
    avatarDelay: 0,
    authorDuration: base,
    authorDelay: 40,
    badgesDuration: base,
    badgesDelay: 60,
    messageDuration: base,
    messageDelay: 80,
    ...simple,
  };

  return {
    enabled: s.enabled,
    targets: {
      avatar: { durationMs: s.avatarDuration, delayMs: s.avatarDelay, translateY: 8 },
      author: { durationMs: s.authorDuration, delayMs: s.authorDelay, translateX: -6 },
      badges: { durationMs: s.badgesDuration, delayMs: s.badgesDelay, translateX: -4 },
      message: { durationMs: s.messageDuration, delayMs: s.messageDelay, translateY: 6 },
    },
  };
}

module.exports = {
  DEFAULT_ANIMATION_CONFIG,
  ANIMATION_STYLE_PRESETS,
  expandAnimationStyle,
  mergeAnimationConfig,
  resolveEffectiveAnimation,
  compileAnimationToCssVariables,
  contractSimpleAnimation,
  expandSimpleAnimation,
};
