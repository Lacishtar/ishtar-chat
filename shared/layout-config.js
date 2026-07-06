/**
 * LayoutConfig — user-tunable layout properties for the four chat slots
 * (Avatar, Username, Badges, Message). Stored inside ThemeDocument.layout
 * (see shared/theme-document.js) and persisted in config.json as
 * layoutConfig. Compiled to CSS custom properties by layout-engine.js and
 * applied by overlay/overlay-client.js without changing the DOM renderer.
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

/** Mirror horizontal flex rows for RTL layout without CSS direction:rtl (preserves text/emoji order). */
function flexDirectionForRow(rowDirection, mirrorHorizontal) {
  if (rowDirection === 'vertical') return 'column';
  return mirrorHorizontal ? 'row-reverse' : 'row';
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

/**
 * Deep-merges user overrides onto defaults. Arrays are replaced, not merged.
 */
function mergeLayoutConfig(base, overrides) {
  const b = base || DEFAULT_LAYOUT_CONFIG;
  const o = overrides || {};
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
    screen: { ...b.screen, ...(o.screen || {}) },
  };
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
    '--ovs-layout-message-align': ALIGN_TO_FLEX[mr.align] || 'flex-start',
    '--ovs-layout-message-padding': px(mr.padding),
    '--ovs-layout-message-margin': px(mr.margin),

    '--ovs-layout-meta-direction': flexDirectionForRow(meta.direction, mirrorHorizontal),
    '--ovs-layout-meta-gap': px(meta.gap),
    '--ovs-layout-meta-align': ALIGN_TO_FLEX[meta.align] || 'center',
    '--ovs-layout-meta-padding': px(meta.padding),
    '--ovs-layout-meta-margin': px(meta.margin),

    '--ovs-layout-body-direction': flexDirectionForRow(body.direction, mirrorHorizontal),
    '--ovs-layout-body-gap': px(body.gap),
    '--ovs-layout-body-align': ALIGN_TO_FLEX[body.align] || 'stretch',
    '--ovs-layout-body-padding': px(body.padding),
    '--ovs-layout-body-margin': px(body.margin),

    '--ovs-layout-slot-avatar-order': String(slots.avatar.order ?? 0),
    '--ovs-layout-slot-avatar-padding': px(slots.avatar.padding),
    '--ovs-layout-slot-avatar-margin': px(slots.avatar.margin),

    '--ovs-layout-slot-author-order': String(slots.author.order ?? 0),
    '--ovs-layout-slot-author-padding': px(slots.author.padding),
    '--ovs-layout-slot-author-margin': px(slots.author.margin),

    '--ovs-layout-slot-badges-order': String(slots.badges.order ?? 1),
    '--ovs-layout-slot-badges-padding': px(slots.badges.padding),
    '--ovs-layout-slot-badges-margin': px(slots.badges.margin),

    '--ovs-layout-slot-message-order': String(slots.message.order ?? 1),
    '--ovs-layout-slot-message-padding': px(slots.message.padding),
    '--ovs-layout-slot-message-margin': px(slots.message.margin),

    '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
    '--ovs-layout-content-direction': 'ltr',
  };
}

/**
 * Derives a small, user-facing layout shape from the full LayoutConfig.
 * Used by the Layout Panel so sliders map 1:1 to visible changes.
 */
function contractSimpleLayout(layout) {
  const l = mergeLayoutConfig(DEFAULT_LAYOUT_CONFIG, layout);

  let avatarPosition = 'left';
  if (l.messageRow.direction === 'vertical') avatarPosition = 'top';
  else if ((l.slots.avatar.order ?? 0) > 0) avatarPosition = 'right';

  let nameBadges = 'inline-after';
  if (l.metaRow.direction === 'vertical') nameBadges = 'badges-below';
  else if ((l.slots.badges.order ?? 1) < (l.slots.author.order ?? 0)) nameBadges = 'inline-before';

  const messagePosition = l.bodyColumn.direction === 'horizontal' ? 'beside' : 'below';

  return {
    avatarPosition,
    nameBadges,
    messagePosition,
    gap: l.messageRow.gap ?? 10,
    padding: l.messageRow.padding ?? 8,
    chatAlign: l.screen?.chatAlign ?? 'left',
    contentDirection: l.screen?.contentDirection ?? 'ltr',
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

  const slots = {
    avatar: { order: s.avatarPosition === 'right' ? 1 : 0, padding: 0, margin: 0 },
    author: { order: s.nameBadges === 'inline-before' ? 1 : 0, padding: 0, margin: 0 },
    badges: { order: s.nameBadges === 'inline-before' ? 0 : 1, padding: 0, margin: 0 },
    message: { order: 1, padding: 0, margin: 0 },
  };

  return { messageRow, metaRow, bodyColumn, slots, screen: {
    chatAlign: s.chatAlign || 'left',
    contentDirection: s.contentDirection || 'ltr',
  } };
}

module.exports = {
  DEFAULT_LAYOUT_CONFIG,
  createRowLayout,
  createSlotLayout,
  mergeLayoutConfig,
  compileLayoutToCssVariables,
  flexDirectionForRow,
  contractSimpleLayout,
  expandSimpleLayout,
};
