/**
 * helpers.js — shared builder functions for BUILTIN_THEMES.
 *
 * Centralised so every theme preset in themes/*.js can compose the same
 * baseline layout / slot-style / animation / decoration / role /
 * fan-service shape without repeating boilerplate. Keep this file free of
 * DOM/UI logic.
 */

const { createGroupConfig } = require('../fan-service-config');

// ---------------------------------------------------------------------------
// Shared role-style helpers
// ---------------------------------------------------------------------------

/** Default role styling (classic dark). Identity-only after the Super
 * Chat -> Fan Service refactor — see docs/refactor-superchat-to-fanservice.md.
 * Super Chat's default look now lives in shared/fan-service-config.js's
 * DEFAULT_FAN_SERVICE_CONFIG.superchat instead (Fan Service is deliberately
 * NOT part of the theme-baseline system — see main/store/config-store.js —
 * so no per-theme superchat payload is needed here; see the refactor doc's
 * Open Question OQ-1 for why). */
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

/** Default layout (horizontal, avatar-left, message-below). */
function defaultLayout() {
  return {
    messageRow: { direction: 'horizontal', gap: 10, align: 'start', padding: 8, margin: 0 },
    metaRow: { direction: 'horizontal', gap: 6, align: 'center', padding: 0, margin: 2 },
    bodyColumn: { direction: 'vertical', gap: 2, align: 'stretch', padding: 0, margin: 0 },
    slots: {
      avatar: { order: 0, padding: 0, margin: 0, visible: null, position: 'static', top: null, left: null, right: null, bottom: null, zIndex: null },
      author: { order: 0, padding: 0, margin: 0, visible: null, position: 'static', top: null, left: null, right: null, bottom: null, zIndex: null },
      message: { order: 1, padding: 0, margin: 0, visible: null, position: 'static', top: null, left: null, right: null, bottom: null, zIndex: null },
    },
    screen: {
      chatAlign: 'left',
      contentDirection: 'ltr',
      chatGap: 10,
      bubbleScope: null,
      bubbleWrapRow: true,
      bubbleWrapAuthor: false,
      bubbleWrapMessage: false,
    },
  };
}

/** Default slot-style (all nulls → inherits from customizeConfig). */
function defaultSlotStyle() {
  return {
    slots: {
      avatar: {
        visible: null, size: null, borderRadius: null, borderWidth: null,
        borderStyle: null, borderColor: null, borderOffset: null,
        opacity: null, margin: 0,
        rotate: 0, translateX: 0, translateY: 0, transformOrigin: null, zIndex: null,
      },
      author: {
        visible: null, fontFamily: null, fontSize: null, color: null,
        fontWeight: null, opacity: null, margin: 0, textAlign: null,
        rotate: 0, translateX: 0, translateY: 0, transformOrigin: null, zIndex: null,
        bubbleBg: null, bubbleRadius: null, bubbleOpacity: null, bubbleBorderWidth: null,
        bubbleBorderStyle: null, bubbleBorderColor: null, bubbleBorderOffset: null,
        bubbleBoxShadow: null, bubbleGlow: null, bubblePadding: null,
        bubblePaddingX: null, bubblePaddingY: null, bubblePaddingTop: null,
        bubblePaddingRight: null, bubblePaddingBottom: null, bubblePaddingLeft: null,
        bubbleTextureUrl: null, bubbleTextureSize: 'auto', bubbleTextureRepeat: 'repeat',
        bubbleTextureOpacity: 1, bubbleBunnyEars: null, bubbleBunnyEarsWidth: null,
        bubbleBunnyEarsHeight: null, bubbleBunnyEarsRoundness: null, bubbleBunnyEarsOffsetX: null,
        bubbleBunnyEarsOffsetY: null, bubbleBunnyEarsZIndex: null, bubbleMinWidth: null,
        bubbleMaxWidth: null, bubbleFixedWidth: null,
        bubbleMinHeight: null, bubbleMaxHeight: null, bubbleFixedHeight: null,
      },
      message: {
        visible: null, fontFamily: null, fontSize: null, color: null,
        fontWeight: null, opacity: null, margin: 0, textAlign: null,
        rotate: 0, translateX: 0, translateY: 0, transformOrigin: null, zIndex: null,
        bubbleBg: null, bubbleRadius: null, bubbleOpacity: null, bubbleBorderWidth: null,
        bubbleBorderStyle: null, bubbleBorderColor: null, bubbleBorderOffset: null,
        bubbleBoxShadow: null, bubbleGlow: null, bubblePadding: null,
        bubblePaddingX: null, bubblePaddingY: null, bubblePaddingTop: null,
        bubblePaddingRight: null, bubblePaddingBottom: null, bubblePaddingLeft: null,
        bubbleTextureUrl: null, bubbleTextureSize: 'auto', bubbleTextureRepeat: 'repeat',
        bubbleTextureOpacity: 1, bubbleBunnyEars: null, bubbleBunnyEarsWidth: null,
        bubbleBunnyEarsHeight: null, bubbleBunnyEarsRoundness: null, bubbleBunnyEarsOffsetX: null,
        bubbleBunnyEarsOffsetY: null, bubbleBunnyEarsZIndex: null, bubbleMinWidth: null,
        bubbleMaxWidth: null, bubbleFixedWidth: null,
        bubbleMinHeight: null, bubbleMaxHeight: null, bubbleFixedHeight: null,
      },
    },
  };
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
// Shared Fan Service helpers
// ---------------------------------------------------------------------------

/**
 * Per-theme Fan Service baseline (Option B from
 * docs/refactor-superchat-to-fanservice.md's Open Question OQ-1 — every
 * built-in theme now ships its own tuned fanServiceConfig instead of all
 * themes sharing the single app-wide shared/fan-service-config.js#DEFAULT_FAN_SERVICE_CONFIG;
 * that default now only backs brand-new/unknown profiles). One design
 * brief applied identically to every theme's superchat + membership group:
 *
 *   1. Mid (center) alignment — authorAlign/monthsAlign/amountAlign all
 *      default to 'center' instead of 'left'.
 *   2. Readability — messageColor/authorColor are picked per theme (see
 *      each themes/<id>.js call site) so the text always contrasts clearly
 *      against the bubble it renders on. Superchat keeps
 *      useTierColor: true, which already forces a contrast-safe
 *      white/near-black overlay per money tier (see
 *      shared/fan-service-config.js's tier-color contrast fix) — the
 *      colors passed in here are just its useTierColor:false manual
 *      fallback.
 *   3. Bigger than normal messages — every size scale (avatar/author/
 *      message/months/amount) defaults above 1x, with matching extra
 *      padding, so Super Chat and membership events stand out from
 *      ordinary chat rows at a glance.
 *   4. enabled: true — a per-theme preset only has a visible effect once
 *      turned on, so every built-in theme now ships Fan Service
 *      pre-enabled, same as any other themed default. Users can still
 *      flip either group off from the Fan Service tab exactly as before.
 */
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

/**
 * Builds a full `{ superchat, membership }` fanServiceConfig for one theme.
 * `superchat`/`membership` are typically just that group's
 * authorColor/messageColor(/monthsColor) overrides — see themes/<id>.js.
 */
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
