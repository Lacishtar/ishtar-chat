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
    ...overrides,
  };
}

const DEFAULT_ANIMATION_CONFIG = {
  enabled: true,
  targets: {
    avatar: createSlotAnimDefaults({ delayMs: 0, translateY: 8 }),
    author: createSlotAnimDefaults({ delayMs: 40, translateX: -6 }),
    badges: createSlotAnimDefaults({ delayMs: 60, translateX: -4 }),
    message: createSlotAnimDefaults({ delayMs: 80, translateY: 6 }),
  },
};

function mergeAnimationConfig(base, overrides) {
  const b = base || DEFAULT_ANIMATION_CONFIG;
  const o = overrides || {};
  const mergeTarget = (key) => ({
    ...b.targets[key],
    ...(o.targets?.[key] || {}),
  });
  return {
    enabled: o.enabled !== undefined ? o.enabled : b.enabled,
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
  });

  return {
    enabled: anim.enabled !== false,
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
  mergeAnimationConfig,
  resolveEffectiveAnimation,
  compileAnimationToCssVariables,
  contractSimpleAnimation,
  expandSimpleAnimation,
};
