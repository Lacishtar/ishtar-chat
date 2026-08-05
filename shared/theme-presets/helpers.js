// helpers.js — shared builder functions for BUILTIN_THEMES.

const { createGroupConfig } = require('../fan-service-config');
const { DEFAULT_LAYOUT_CONFIG, mergeLayoutConfig } = require('../layout-config');
const { DEFAULT_SLOT_STYLE_CONFIG, mergeSlotStyleConfig } = require('../slot-style-config');

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Default role styling (classic dark). Identity-only after the Super
function defaultRoles() {
  return {
    roles: {
      moderator: {
        enabled: true,
        authorColor: '#fca5a5',
        authorBorderColor: 'rgba(248, 113, 113, 0.7)',
        authorBg: null,
        messageBg: 'rgba(86, 50, 54, 1)',
        messageBorderColor: 'rgba(248, 113, 113, 0.45)',
        messageTextColor: null,
        rowBg: null,
        rowBorderColor: null,
        badgeBefore: null,
        badgeAfter: null,
      },
      member: {
        enabled: true,
        authorColor: '#93c5fd',
        authorBorderColor: 'rgba(96, 165, 250, 0.55)',
        authorBg: null,
        messageBg: null,
        messageBorderColor: 'rgba(96, 165, 250, 0.45)',
        messageTextColor: null,
        rowBg: null,
        rowBorderColor: null,
        badgeBefore: null,
        badgeAfter: null,
      },
    },
  };
}

/**
 * Default layout (horizontal, avatar-left, message-below).
 *
 * `overrides` is deep-merged on top via the same mergeLayoutConfig() used at
 * runtime, so a theme can flip just e.g. `screen.bubbleWrapRow` /
 * `slots.avatar.visible` without having to restate the whole shape. This is
 * what lets individual presets opt into "Chia đôi bubble" (split
 * author/message wrap), hiding the avatar slot, etc. — see shared/layout-config.js.
 */
function defaultLayout(overrides = {}) {
  return mergeLayoutConfig(DEFAULT_LAYOUT_CONFIG, overrides);
}

/**
 * Default slot-style (all nulls → inherits from customizeConfig).
 *
 * `overrides` is deep-merged via mergeSlotStyleConfig() — used by themes that
 * want a per-slot rotate/translate ("xoay trục X/Y") or a dedicated
 * author/message bubble color (the color half of "Bubble riêng" / header-body
 * split), without redeclaring every null field. See shared/slot-style-config.js.
 */
function defaultSlotStyle(overrides = {}) {
  return mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, overrides);
}

/** Default animation (slide, bottom-up stagger). */
function defaultAnimation() {
  return {
    enabled: true,
    style: 'slide',
    targets: {
      avatar:  { durationMs: null, delayMs: 0,  easing: 'ease-out', translateX: 0,  translateY: 8, scale: 1, blur: 0 },
      author:  { durationMs: null, delayMs: 40, easing: 'ease-out', translateX: -6, translateY: 0, scale: 1, blur: 0 },
      message: { durationMs: null, delayMs: 80, easing: 'ease-out', translateX: 0,  translateY: 6, scale: 1, blur: 0 },
    },
  };
}

/** No decoration layers. */
function emptyDecorations() {
  return { layers: [] };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Per-theme Fan Service baseline (Option B from
function fanServiceGroupDefaults(overrides = {}) {
  return createGroupConfig({
    enabled: true,
    authorAlign: 'center',
    monthsAlign: 'center',
    amountAlign: 'center',
    avatarScale: 1.25,
    authorFontScale: 1.2,
    messageFontScale: 1.2,
    monthsFontScale: 1.4,
    amountFontScale: 1.15,
    paddingTopScale: 1.15,
    paddingRightScale: 1.15,
    paddingBottomScale: 1.15,
    paddingLeftScale: 1.15,
    ...overrides,
  });
}

// Builds a full `{ superchat, membership }` fanServiceConfig for one theme.
function defaultThemeFanService({ superchat = {}, membership = {} } = {}) {
  return {
    superchat: fanServiceGroupDefaults(superchat),
    membership: fanServiceGroupDefaults(membership),
  };
}

module.exports = {
  defaultRoles,
  defaultLayout,
  defaultSlotStyle,
  defaultAnimation,
  emptyDecorations,
  fanServiceGroupDefaults,
  defaultThemeFanService,
};
