/**
 * LayoutConfig — user-tunable layout properties for the four chat slots
 * (Avatar, Username, Badges, Message). Stored inside ThemeDocument.layout
 * (see shared/theme-document.js) and persisted in config.json as
 * layoutConfig. Compiled to CSS custom properties by this module's own
 * compileLayoutToCssVariables() (mirrored in overlay/modules/css-variables.js
 * for the overlay's runtime) and applied without changing the DOM renderer.
 */

function createRowLayout(overrides = {}) {
  return {
    direction: 'horizontal', // 'horizontal' | 'vertical'
    gap: 10,
    align: 'start', // 'start' | 'center' | 'end' | 'stretch'
    padding: 0,
    margin: 0,
    ...overrides,
  };
}

function createSlotLayout(overrides = {}) {
  return {
    order: 0,
    padding: 0,
    margin: 0,
    visible: null,
    position: 'static',
    top: null,
    left: null,
    right: null,
    bottom: null,
    zIndex: null,
    ...overrides,
  };
}

const DEFAULT_LAYOUT_CONFIG = {
  messageRow: createRowLayout({ gap: 10, align: 'start', padding: 8 }),
  metaRow: createRowLayout({ gap: 6, align: 'center', margin: 2 }),
  bodyColumn: createRowLayout({ direction: 'vertical', gap: 2, align: 'stretch' }),
  slots: {
    avatar: createSlotLayout({ order: 0 }),
    author: createSlotLayout({ order: 0 }),
    badges: createSlotLayout({ order: 1 }),
    message: createSlotLayout({ order: 1 }),
  },
  screen: {
    chatAlign: 'left', // 'left' | 'center' | 'right'
    contentDirection: 'ltr', // 'ltr' | 'rtl'
    chatGap: 10,
    /** @deprecated use bubbleWrapRow / bubbleWrapAuthor / bubbleWrapMessage */
    bubbleScope: null,
    bubbleWrapRow: null, // null | true = bọc cả hàng; false = bọc riêng slot
    bubbleWrapAuthor: null, // null | boolean — bọc tên (khi bubbleWrapRow === false)
    bubbleWrapMessage: null, // null | boolean — bọc nội dung chat
    // Header/body split — only meaningful when bubbleWrapRow is true (one
    // unified bubble). Puts avatar + username (+ badges) on a header row
    // (avatar left, name beside — Discord-card style) and the chat message
    // on its own full-width row underneath, separated by a thin divider.
    headerSplit: false,
    headerDividerColor: 'rgba(255, 255, 255, 0.14)',
    headerDividerWidth: 1, // px (thickness)
    headerDividerStyle: 'solid', // any CSS border-style keyword
    headerDividerLength: 100, // 0-100 (% of the bubble's inner width, centered)
  },
};

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

/**
 * Flips a start/end-ish align value so content hugs the correct physical side
 * once the layout has been horizontally mirrored (RTL). Only meaningful for
 * containers that stack VERTICALLY (column) — their align-items controls the
 * horizontal cross-axis, which is exactly what mirroring flips. Containers
 * that stack horizontally (row/row-reverse) already get their mirroring from
 * flexDirectionForRow, so their align (a vertical concern) must NOT be touched.
 */
function mirrorAlign(align, shouldMirror) {
  if (!shouldMirror) return align;
  if (align === 'start' || align === 'left') return 'end';
  if (align === 'end' || align === 'right') return 'start';
  // 'stretch' (the default) renders like flex-start here — no theme gives
  // .ovs-meta/.ovs-body their own background, so nothing relies on the
  // literal stretch-to-full-width box. Flip it too or content still hugs
  // the wrong (far-from-avatar) side after mirroring.
  if (align === 'stretch') return 'end';
  return align; // 'center' has no side to flip
}

/** Mirror horizontal flex rows for RTL layout without CSS direction:rtl (preserves text/emoji order). */
function flexDirectionForRow(rowDirection, mirrorHorizontal) {
  if (rowDirection === 'vertical') return 'column';
  return mirrorHorizontal ? 'row-reverse' : 'row';
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

function offsetVar(value) {
  return value != null && Number.isFinite(Number(value)) ? px(value) : 'auto';
}

function zIndexVar(value) {
  return value != null && Number.isFinite(Number(value)) ? String(value) : 'auto';
}

function compileSlotPositionVars(prefix, slot) {
  const position = slot.position === 'absolute' ? 'absolute' : 'static';
  return {
    [`--ovs-layout-slot-${prefix}-position`]: position,
    [`--ovs-layout-slot-${prefix}-top`]: offsetVar(slot.top),
    [`--ovs-layout-slot-${prefix}-left`]: offsetVar(slot.left),
    [`--ovs-layout-slot-${prefix}-right`]: offsetVar(slot.right),
    [`--ovs-layout-slot-${prefix}-bottom`]: offsetVar(slot.bottom),
    [`--ovs-layout-slot-${prefix}-z-index`]: zIndexVar(slot.zIndex),
  };
}

/**
 * Deep-merges user overrides onto defaults. Arrays are replaced, not merged.
 */
function mergeLayoutConfig(base, overrides) {
  const b = base || DEFAULT_LAYOUT_CONFIG;
  const o = overrides || {};
  const mergedScreen = { ...b.screen, ...(o.screen || {}) };
  return {
    messageRow: { ...b.messageRow, ...(o.messageRow || {}) },
    metaRow: { ...b.metaRow, ...(o.metaRow || {}) },
    bodyColumn: { ...b.bodyColumn, ...(o.bodyColumn || {}) },
    slots: {
      avatar: { ...b.slots.avatar, ...(o.slots?.avatar || {}) },
      author: { ...b.slots.author, ...(o.slots?.author || {}) },
      badges: { ...b.slots.badges, ...(o.slots?.badges || {}) },
      message: { ...b.slots.message, ...(o.slots?.message || {}) },
    },
    screen: normalizeBubbleWrapScreen(mergedScreen),
  };
}

/** Resolves legacy bubbleScope and normalizes wrap flags. */
function normalizeBubbleWrapScreen(screen) {
  const s = screen || {};

  // Legacy preset: only when no explicit wrap flags were saved yet.
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

function isRowBubbleWrap(screen) {
  return normalizeBubbleWrapScreen(screen).bubbleWrapRow === true;
}

/**
 * Compiles a LayoutConfig into CSS custom properties every theme's style.css
 * can read. Fallback values in each theme preserve its original look when a
 * variable is unset.
 */
function compileLayoutToCssVariables(layout) {
  const l = mergeLayoutConfig(DEFAULT_LAYOUT_CONFIG, layout);
  const mr = l.messageRow;
  const meta = l.metaRow;
  const body = l.bodyColumn;
  const slots = l.slots;
  const screen = l.screen || {};
  const mirrorHorizontal = screen.contentDirection === 'rtl';

  return {
    '--ovs-layout-message-direction': flexDirectionForRow(mr.direction, mirrorHorizontal),
    '--ovs-layout-message-gap': px(mr.gap),
    '--ovs-layout-message-align': ALIGN_TO_FLEX[mirrorAlign(mr.align, mirrorHorizontal && mr.direction !== 'horizontal')] || 'flex-start',
    '--ovs-layout-message-padding': px(mr.padding),
    '--ovs-layout-message-margin': px(mr.margin),

    '--ovs-layout-meta-direction': flexDirectionForRow(meta.direction, mirrorHorizontal),
    '--ovs-layout-meta-gap': px(meta.gap),
    '--ovs-layout-meta-align': ALIGN_TO_FLEX[mirrorAlign(meta.align, mirrorHorizontal && meta.direction !== 'horizontal')] || 'center',
    '--ovs-layout-meta-padding': px(meta.padding),
    '--ovs-layout-meta-margin': px(meta.margin),

    '--ovs-layout-body-direction': flexDirectionForRow(body.direction, mirrorHorizontal),
    '--ovs-layout-body-gap': px(body.gap),
    '--ovs-layout-body-align': ALIGN_TO_FLEX[mirrorAlign(body.align, mirrorHorizontal && body.direction !== 'horizontal')] || 'stretch',
    '--ovs-layout-body-padding': px(body.padding),
    '--ovs-layout-body-margin': px(body.margin),

    '--ovs-layout-slot-avatar-order': String(slots.avatar.order ?? 0),
    '--ovs-layout-slot-avatar-padding': px(slots.avatar.padding),
    '--ovs-layout-slot-avatar-margin': px(slots.avatar.margin),
    ...compileSlotPositionVars('avatar', slots.avatar),

    '--ovs-layout-slot-author-order': String(slots.author.order ?? 0),
    '--ovs-layout-slot-author-padding': px(slots.author.padding),
    '--ovs-layout-slot-author-margin': px(slots.author.margin),
    ...compileSlotPositionVars('author', slots.author),

    '--ovs-layout-slot-badges-order': String(slots.badges.order ?? 1),
    '--ovs-layout-slot-badges-padding': px(slots.badges.padding),
    '--ovs-layout-slot-badges-margin': px(slots.badges.margin),
    ...compileSlotPositionVars('badges', slots.badges),

    '--ovs-layout-slot-message-order': String(slots.message.order ?? 1),
    '--ovs-layout-slot-message-padding': px(slots.message.padding),
    '--ovs-layout-slot-message-margin': px(slots.message.margin),
    ...compileSlotPositionVars('message', slots.message),

    '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
    '--ovs-layout-chat-gap': px(screen.chatGap ?? 10),
    '--ovs-layout-content-direction': 'ltr',
    '--ovs-bubble-wrap-row': isRowBubbleWrap(screen) ? '1' : '0',
    '--ovs-bubble-wrap-author': !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? '1' : '0',
    '--ovs-bubble-wrap-message': !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? '1' : '0',

    // Header/body split (see DEFAULT_LAYOUT_CONFIG.screen comment). Only
    // takes visual effect while row-wrap is active — the '--ovs-header-split'
    // flag itself still compiles either way so the data attribute stays a
    // pure reflection of the setting; overlay/bubble-wrap.css gates the
    // actual grid layout on both flags together.
    '--ovs-header-split': screen.headerSplit ? '1' : '0',
    '--ovs-header-divider-color': screen.headerDividerColor || 'rgba(255, 255, 255, 0.14)',
    '--ovs-header-divider-width': px(screen.headerDividerWidth ?? 1),
    '--ovs-header-divider-style': screen.headerDividerStyle || 'solid',
    '--ovs-header-divider-length': `${Math.min(Math.max(Number(screen.headerDividerLength ?? 100) || 0, 0), 100)}%`,
    '--ovs-header-grid-columns': mirrorHorizontal ? '1fr auto' : 'auto 1fr',
    '--ovs-header-avatar-col': mirrorHorizontal ? '2' : '1',
    '--ovs-header-meta-col': mirrorHorizontal ? '1' : '2',
  };
}

/**
 * Derives a small, user-facing layout shape from the full LayoutConfig.
 * Used by the Layout Panel so sliders map 1:1 to visible changes.
 */
function contractSimpleLayout(layout) {
  const l = mergeLayoutConfig(DEFAULT_LAYOUT_CONFIG, layout);
  const screen = l.screen || {};

  let avatarPosition = 'left';
  if (l.messageRow.direction === 'vertical') avatarPosition = 'top';
  else if ((l.slots.avatar.order ?? 0) > 0) avatarPosition = 'right';

  let nameBadges = 'inline-after';
  if (l.metaRow.direction === 'vertical') nameBadges = 'badges-below';
  else if ((l.slots.badges.order ?? 1) < (l.slots.author.order ?? 0)) nameBadges = 'inline-before';

  const messagePosition = l.bodyColumn.direction === 'horizontal' ? 'beside' : 'below';

  const slotPositionFields = (key) => ({
    [`${key}PositionMode`]: l.slots[key]?.position ?? 'static',
    [`${key}Top`]: l.slots[key]?.top ?? null,
    [`${key}Left`]: l.slots[key]?.left ?? null,
    [`${key}Right`]: l.slots[key]?.right ?? null,
    [`${key}Bottom`]: l.slots[key]?.bottom ?? null,
    [`${key}ZIndex`]: l.slots[key]?.zIndex ?? null,
  });

  return {
    avatarPosition,
    nameBadges,
    messagePosition,
    gap: l.messageRow.gap ?? 10,
    padding: l.messageRow.padding ?? 8,
    chatAlign: screen.chatAlign ?? 'left',
    chatGap: screen.chatGap ?? 10,
    contentDirection: screen.contentDirection ?? 'ltr',
    bubbleWrapMode: isRowBubbleWrap(screen) ? 'row' : 'split',
    bubbleWrapAuthor: Boolean(screen.bubbleWrapAuthor),
    bubbleWrapMessage: Boolean(screen.bubbleWrapMessage),
    headerSplit: Boolean(screen.headerSplit),
    headerDividerColor: screen.headerDividerColor ?? 'rgba(255, 255, 255, 0.14)',
    headerDividerWidth: screen.headerDividerWidth ?? 1,
    headerDividerStyle: screen.headerDividerStyle ?? 'solid',
    headerDividerLength: screen.headerDividerLength ?? 100,
    avatarPadding: l.slots.avatar?.padding ?? 0,
    avatarMargin: l.slots.avatar?.margin ?? 0,
    authorPadding: l.slots.author?.padding ?? 0,
    authorMargin: l.slots.author?.margin ?? 0,
    badgesPadding: l.slots.badges?.padding ?? 0,
    badgesMargin: l.slots.badges?.margin ?? 0,
    messagePadding: l.slots.message?.padding ?? 0,
    messageMargin: l.slots.message?.margin ?? 0,
    showAvatarSlot: l.slots.avatar?.visible ?? null,
    showAuthorSlot: l.slots.author?.visible ?? null,
    showBadgesSlot: l.slots.badges?.visible ?? null,
    showMessageSlot: l.slots.message?.visible ?? null,
    ...slotPositionFields('avatar'),
    ...slotPositionFields('author'),
    ...slotPositionFields('badges'),
    ...slotPositionFields('message'),
  };
}

/**
 * Expands the simplified panel controls into the full LayoutConfig the
 * compiler and overlay expect. Every UI change goes through here so there
 * is exactly one code path — no duplicate/conflicting sliders.
 */
function expandSimpleLayout(simple) {
  const s = { ...contractSimpleLayout(DEFAULT_LAYOUT_CONFIG), ...(simple || {}) };

  const messageRow = {
    direction: s.avatarPosition === 'top' ? 'vertical' : 'horizontal',
    gap: s.gap,
    align: 'start',
    padding: s.padding,
    margin: 0,
  };

  const metaRow = {
    direction: s.nameBadges === 'badges-below' ? 'vertical' : 'horizontal',
    gap: 6,
    align: 'center',
    padding: 0,
    margin: s.nameBadges === 'badges-below' ? 0 : 2,
  };

  const bodyColumn = {
    direction: s.messagePosition === 'beside' ? 'horizontal' : 'vertical',
    gap: s.messagePosition === 'beside' ? 6 : 2,
    align: s.messagePosition === 'beside' ? 'baseline' : 'stretch',
    padding: 0,
    margin: 0,
  };

  const slotFromSimple = (key, order) => ({
    order,
    padding: s[`${key}Padding`] ?? 0,
    margin: s[`${key}Margin`] ?? 0,
    visible: s[`show${key.charAt(0).toUpperCase()}${key.slice(1)}Slot`] ?? null,
    position: s[`${key}PositionMode`] ?? 'static',
    top: s[`${key}Top`] ?? null,
    left: s[`${key}Left`] ?? null,
    right: s[`${key}Right`] ?? null,
    bottom: s[`${key}Bottom`] ?? null,
    zIndex: s[`${key}ZIndex`] ?? null,
  });

  const slots = {
    avatar: slotFromSimple('avatar', s.avatarPosition === 'right' ? 1 : 0),
    author: slotFromSimple('author', s.nameBadges === 'inline-before' ? 1 : 0),
    badges: slotFromSimple('badges', s.nameBadges === 'inline-before' ? 0 : 1),
    message: slotFromSimple('message', 1),
  };

  const wrapRow = s.bubbleWrapMode !== 'split';
  const wrapAuthor = !wrapRow && Boolean(s.bubbleWrapAuthor);
  const wrapMessage = !wrapRow && Boolean(s.bubbleWrapMessage);

  return { messageRow, metaRow, bodyColumn, slots, screen: {
    chatAlign: s.chatAlign || 'left',
    chatGap: s.chatGap,
    contentDirection: s.contentDirection || 'ltr',
    bubbleWrapRow: wrapRow,
    bubbleWrapAuthor: wrapAuthor,
    bubbleWrapMessage: wrapMessage,
    bubbleScope: null,
    // Only meaningful (and only ever exposed by the UI) while wrapRow is
    // true — expandSimpleLayout still round-trips it faithfully either way.
    headerSplit: Boolean(s.headerSplit),
    headerDividerColor: s.headerDividerColor || 'rgba(255, 255, 255, 0.14)',
    headerDividerWidth: s.headerDividerWidth ?? 1,
    headerDividerStyle: s.headerDividerStyle || 'solid',
    headerDividerLength: s.headerDividerLength ?? 100,
  } };
}

module.exports = {
  DEFAULT_LAYOUT_CONFIG,
  createRowLayout,
  createSlotLayout,
  mergeLayoutConfig,
  normalizeBubbleWrapScreen,
  isRowBubbleWrap,
  compileLayoutToCssVariables,
  flexDirectionForRow,
  contractSimpleLayout,
  expandSimpleLayout,
};