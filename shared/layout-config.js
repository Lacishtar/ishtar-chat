// LayoutConfig — user-tunable layout properties for the three chat slots

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
    message: createSlotLayout({ order: 1 }),
  },
  screen: {
    chatAlign: 'left', // 'left' | 'center' | 'right'
    contentDirection: 'ltr', // 'ltr' | 'rtl'
    chatGap: 10,
    chatOffsetX: 0,
    chatOffsetY: 0,
    /** @deprecated use bubbleWrapRow / bubbleWrapAuthor / bubbleWrapMessage */
    bubbleScope: null,
    bubbleWrapRow: null, // null | true = bọc cả hàng; false = bọc riêng slot
    bubbleWrapAuthor: null, // null | boolean — bọc tên (khi bubbleWrapRow === false)
    bubbleWrapMessage: null, // null | boolean — bọc nội dung chat
    headerSplit: false,
    /**
     * @deprecated Colors for the header/body split used to live here
     * (headerBgColor/bodyBgColor). They now come from
     * slotStyleConfig.slots.author.bubbleBg / slots.message.bubbleBg — the
     * SAME "🖌️ Bubble riêng" fields used by split-wrap mode — so users only
     * ever set one pair of colors regardless of which bubble-wrap mode is
     * active. These two keys are kept only so main/store/config-store.js can
     * migrate old saved values into slotStyleConfig on first load after the
     * upgrade; compileLayoutToCssVariables() no longer reads them.
     */
    headerBgColor: null,
    bodyBgColor: null,
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

// Flips a start/end-ish align value so content hugs the correct physical side
function mirrorAlign(align, shouldMirror) {
  if (!shouldMirror) return align;
  if (align === 'start' || align === 'left') return 'end';
  if (align === 'end' || align === 'right') return 'start';
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

// Deep-merges user overrides onto defaults. Arrays are replaced, not merged.
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

// Compiles a LayoutConfig into CSS custom properties every theme's style.css
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

    '--ovs-layout-slot-message-order': String(slots.message.order ?? 1),
    '--ovs-layout-slot-message-padding': px(slots.message.padding),
    '--ovs-layout-slot-message-margin': px(slots.message.margin),
    ...compileSlotPositionVars('message', slots.message),

    '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
    '--ovs-layout-chat-gap': px(screen.chatGap ?? 10),
    '--ovs-layout-chat-offset-x': px(screen.chatOffsetX ?? 0),
    '--ovs-layout-chat-offset-y': px(screen.chatOffsetY ?? 0),
    '--ovs-layout-content-direction': 'ltr',
    '--ovs-bubble-wrap-row': isRowBubbleWrap(screen) ? '1' : '0',
    '--ovs-bubble-wrap-author': !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? '1' : '0',
    '--ovs-bubble-wrap-message': !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? '1' : '0',

    '--ovs-header-split': screen.headerSplit ? '1' : '0',
    '--ovs-header-grid-columns': mirrorHorizontal ? '1fr auto' : 'auto 1fr',
    '--ovs-header-avatar-col': mirrorHorizontal ? '2' : '1',
    '--ovs-header-meta-col': mirrorHorizontal ? '1' : '2',
    // Header/body band colors are NOT stored here — they read the exact same
    // per-slot bubble background CSS vars that split-wrap mode paints
    // .ovs-author/.ovs-text with (see shared/slot-bubble-config.js). Those
    // vars are always set on :root regardless of wrap mode, and already
    // fall back to --ovs-bubble-bg on their own, so a single color choice in
    // the "🖌️ Bubble riêng" panel now works for both bubble-wrap modes.
    '--ovs-header-split-header-bg': 'var(--ovs-slot-author-bubble-bg, var(--ovs-bubble-bg, rgba(22, 25, 31, 0.72)))',
    '--ovs-header-split-body-bg': 'var(--ovs-slot-message-bubble-bg, var(--ovs-bubble-bg, rgba(22, 25, 31, 0.72)))',
  };
}

// Derives a small, user-facing layout shape from the full LayoutConfig.
function contractSimpleLayout(layout) {
  const l = mergeLayoutConfig(DEFAULT_LAYOUT_CONFIG, layout);
  const screen = l.screen || {};

  let avatarPosition = 'left';
  if (l.messageRow.direction === 'vertical') avatarPosition = 'top';
  else if ((l.slots.avatar.order ?? 0) > 0) avatarPosition = 'right';

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
    messagePosition,
    gap: l.messageRow.gap ?? 10,
    padding: l.messageRow.padding ?? 8,
    chatAlign: screen.chatAlign ?? 'left',
    chatGap: screen.chatGap ?? 10,
    chatOffsetX: screen.chatOffsetX ?? 0,
    chatOffsetY: screen.chatOffsetY ?? 0,
    contentDirection: screen.contentDirection ?? 'ltr',
    bubbleWrapMode: isRowBubbleWrap(screen) ? 'row' : 'split',
    bubbleWrapAuthor: Boolean(screen.bubbleWrapAuthor),
    bubbleWrapMessage: Boolean(screen.bubbleWrapMessage),
    headerSplit: Boolean(screen.headerSplit),
    avatarPadding: l.slots.avatar?.padding ?? 0,
    avatarMargin: l.slots.avatar?.margin ?? 0,
    authorPadding: l.slots.author?.padding ?? 0,
    authorMargin: l.slots.author?.margin ?? 0,
    messagePadding: l.slots.message?.padding ?? 0,
    messageMargin: l.slots.message?.margin ?? 0,
    showAvatarSlot: l.slots.avatar?.visible ?? null,
    showAuthorSlot: l.slots.author?.visible ?? null,
    showMessageSlot: l.slots.message?.visible ?? null,
    ...slotPositionFields('avatar'),
    ...slotPositionFields('author'),
    ...slotPositionFields('message'),
  };
}

// Expands the simplified panel controls into the full LayoutConfig the
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
    direction: 'horizontal',
    gap: 6,
    align: 'center',
    padding: 0,
    margin: 2,
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
    author: slotFromSimple('author', 0),
    message: slotFromSimple('message', 1),
  };

  const wrapRow = s.bubbleWrapMode !== 'split';
  const wrapAuthor = !wrapRow && Boolean(s.bubbleWrapAuthor);
  const wrapMessage = !wrapRow && Boolean(s.bubbleWrapMessage);

  return { messageRow, metaRow, bodyColumn, slots, screen: {
    chatAlign: s.chatAlign || 'left',
    chatGap: s.chatGap,
    chatOffsetX: s.chatOffsetX ?? 0,
    chatOffsetY: s.chatOffsetY ?? 0,
    contentDirection: s.contentDirection || 'ltr',
    bubbleWrapRow: wrapRow,
    bubbleWrapAuthor: wrapAuthor,
    bubbleWrapMessage: wrapMessage,
    bubbleScope: null,
    // Only meaningful (and only ever exposed by the UI) while wrapRow is
    // true — expandSimpleLayout still round-trips it faithfully either way.
    // Its colors live in slotStyleConfig now (see the @deprecated note on
    // headerBgColor/bodyBgColor above) — not in this simplified shape.
    headerSplit: Boolean(s.headerSplit),
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