/**
 * helpers.js — shared builder functions for BUILTIN_THEMES.
 *
 * Centralised so every theme preset in themes/*.js can compose the same
 * baseline layout / slot-style / animation / decoration / role shape
 * without repeating boilerplate. Keep this file free of DOM/UI logic.
 */

// ---------------------------------------------------------------------------
// Shared role-style helpers
// ---------------------------------------------------------------------------

/** Default role styling (classic dark). */
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
        showAmount: null,
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
        showAmount: null,
      },
      superchat: {
        enabled: true,
        authorColor: '#fde047',
        authorBorderColor: 'rgba(255, 202, 40, 0.55)',
        authorBg: null,
        messageBg: 'rgba(104, 87, 34, 1)',
        messageBorderColor: 'rgba(255, 202, 40, 0.45)',
        messageTextColor: null,
        rowBg: 'rgba(88, 75, 34, 1)',
        rowBorderColor: 'rgba(255, 202, 40, 0.45)',
        badgeBefore: null,
        badgeAfter: null,
        showAmount: true,
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
      badges: { order: 1, padding: 0, margin: 0, visible: null, position: 'static', top: null, left: null, right: null, bottom: null, zIndex: null },
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
      badges: {
        visible: null, fontSize: null, opacity: null, margin: 0,
        rotate: 0, translateX: 0, translateY: 0, transformOrigin: null, zIndex: null,
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
      badges:  { durationMs: null, delayMs: 60, easing: 'ease-out', translateX: -4, translateY: 0, scale: 1, blur: 0 },
      message: { durationMs: null, delayMs: 80, easing: 'ease-out', translateX: 0,  translateY: 6, scale: 1, blur: 0 },
    },
  };
}

/** No decoration layers. */
function emptyDecorations() {
  return { layers: [] };
}

module.exports = {
  defaultRoles,
  defaultLayout,
  defaultSlotStyle,
  defaultAnimation,
  emptyDecorations,
};
