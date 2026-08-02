/**
 * FanServiceConfig — dedicated layout/typography customization for the
 * events that matter most for viewer support: Super Chat, and the three
 * membership events the streamer wants to spotlight (Hội viên mới, Gia hạn,
 * Tặng hội viên). Two independent groups:
 *
 *   - superchat:  applies to any message with msg.isSuperchat (rows carrying
 *                 the `.ovs-superchat` class — see overlay/modules/message-renderer.js)
 *   - membership: applies to membership_new / membership_milestone /
 *                 membership_gift_sent (rows carrying `.ovs-event-<type>`).
 *                 membership_gift_received is intentionally excluded — it's
 *                 not one of the four events Fan Service targets.
 *
 * Each group is OFF by default (`enabled: false`) — until turned on, those
 * rows keep using the normal Bố cục / Vai trò styling exactly as today.
 *
 * Badges are not a Fan Service concept — there used to be a
 * badge-position picker ("Tên & badge") plus a badge font-size/color pair
 * shared by both groups; those are gone, same as the raw badges display
 * slot itself (.ovs-badges) elsewhere in the app. `authorAlign` replaces
 * the old position picker with a plain left/center/right alignment for
 * the name only (compiles to --ovs-slot-author-text-align, the same
 * variable shared/slot-style-config.js already writes — see
 * overlay/base-layout.css's `.ovs-author { text-align: ... }`).
 *
 * EXCEPTION — as of the Super Chat -> Fan Service refactor
 * (docs/refactor-superchat-to-fanservice.md), the `superchat` group alone
 * carries its own badgeBefore/badgeAfter, plus tier-color/amount-display
 * fields moved wholesale from the old role-style-config.js Super Chat role
 * (see createGroupConfig below, "superchat-only" section). These fields
 * exist on every group's object (membership included) for shape
 * consistency, but compileFanServiceCss/groupOverrideCssBlock only ever
 * read them for the superchat group.
 *
 * Every size knob (avatar, name, message) is a *scale* — a multiplier of
 * the feature's own original default px value (BASE_SIZES below), not an
 * absolute px value. 1 always reproduces the original look; 1.5 is 50%
 * bigger, 0.5 is half. This keeps every group's sizing comparable and
 * removes the need to hand-pick a new absolute number per field.
 *
 * The rest of the layout (avatar position, message position, gap/padding)
 * is expressed in the same "simple layout" shape the Bố cục tab uses (see
 * shared/layout-config.js#contractSimpleLayout), expanded/compiled with
 * that module's own functions — no separate flex/RTL logic to maintain
 * here. Only the message/meta/body/slot subset of the compiled variables is
 * kept (screen-wide concerns like chat alignment on the page, RTL
 * mirroring, or bubble-wrap mode stay governed by the global Bố cục tab).
 *
 * There is no more "Tên gói hội viên" section — the package-name line
 * (e.g. YouTube's auto-generated "Chào mừng bạn đến với ...") is no longer
 * configurable from Fan Service at all, but it still shows by default: once
 * this file stops emitting any --ovs-package-name-* variable, the row falls
 * through to overlay/layout-text.css's own fallback (`display: block`,
 * `font-size: 0.78em`, `color: inherit`), so the package name keeps
 * appearing without any per-event override.
 *
 * Texture — each group can also carry its own bubble texture
 * (bubbleTextureUrl/-Size/-Repeat/-Opacity/-PositionX/-PositionY/
 * -BlendMode), separate from both the global Bubble tab texture and any
 * per-slot (author/message) texture override. `bubbleTextureUrl: null`
 * (the default) means "no opinion" — rows fall through to whatever the
 * global/slot texture already resolves to. See compileGroupVars below for
 * how this compiles onto the row's --ovs-bubble-texture-* variables.
 *
 * Typography (font sizes / colors) reuses the exact same CSS custom
 * property names the base overlay CSS already reads
 * (--ovs-slot-author-font-size, --ovs-slot-message-color, ...) — see
 * overlay/base-layout.css. Compiling this config into a *scoped* CSS block
 * (instead of writing to :root) is what makes it apply to only the
 * targeted rows; see compileFanServiceCss below and
 * overlay/modules/css-variables.js#applyFanServiceStyle.
 */

const { expandSimpleLayout, compileLayoutToCssVariables } = require('./layout-config');
const { quoteCssContent, getBadgeImageSrc, FONT_WEIGHT_MAP } = require('./css-content-helpers');
const { toImageProxyUrl } = require('./image-url');

// The feature's own original defaults — "bản gốc" that every *Scale field
// is a multiplier of. Changing these changes what "1" means everywhere.
const BASE_SIZES = {
  gap: 10,
  // Padding is per-side now (was a single `padding: 8` scaled uniformly).
  // These starting values match the bubble's own original default padding
  // (--ovs-bubble-pad-y: 8px / --ovs-bubble-pad-x: 12px in overlay/base-layout.css)
  // so paddingXScale: 1 on every side reproduces today's look exactly.
  paddingTop: 8,
  paddingRight: 12,
  paddingBottom: 8,
  paddingLeft: 12,
  avatarSize: 32,
  authorFontSize: 15,
  messageFontSize: 16,
  // Base size for the dedicated "Hội viên trong N tháng" line — bigger
  // than the name by default (see monthsFontScale below) since the whole
  // point is a standalone, easy-to-notice line, not a footnote.
  monthsFontSize: 16,
  // Base size for the Super Chat amount badge (superchat group only) — same
  // value as messageFontSize, so amountFontScale: 1 starts at a size that
  // already matches the rest of the row's text before the user touches it.
  amountFontSize: 16,
};

function createGroupConfig(overrides = {}) {
  return {
    enabled: false,

    // Visibility — whether each element renders at all for this group's rows
    showAvatar: true,
    showAuthor: true,
    showMessage: true,

    // Layout (message-level; reuses shared/layout-config.js's simple shape)
    avatarPosition: 'left', // 'left' | 'right' | 'top'
    authorAlign: 'left', // 'left' | 'center' | 'right' — name only, no badge
    messagePosition: 'below', // 'below' | 'beside'
    gapScale: 1,
    // Independent per-side padding scales — 1 = BASE_SIZES.padding<Side>.
    paddingTopScale: 1,
    paddingRightScale: 1,
    paddingBottomScale: 1,
    paddingLeftScale: 1,

    // Typography — all scales, 1 = BASE_SIZES value above
    avatarScale: 1,
    authorFontScale: 1,
    authorColor: '#6e56f0',
    messageFontScale: 1,
    messageColor: '#eaecef',

    // ─── Texture riêng cho Fan Service — độc lập với texture nền bubble
    // chung ở tab Bubble (BubbleTextureSection.jsx / --ovs-bubble-texture-*
    // toàn cục ở shared/customize-config.js) và với texture per-slot
    // (shared/slot-bubble-config.js). Cố tình dùng chung tên field
    // (bubbleTexture*) với hai chỗ kia — không phải trùng lặp mà là để
    // FanServicePanel.jsx tái dùng nguyên component BubbleTextureSection.jsx
    // thay vì viết lại UI riêng.
    // null (mặc định) = không đè gì cả — các dòng của group này vẫn kế
    // thừa texture chung/slot như bình thường, y hệt khi chưa có field này.
    // '' (chuỗi rỗng) = đè tường minh thành "không có texture", dùng khi
    // người dùng muốn group này KHÔNG có texture dù nơi khác đang bật.
    // Chỉ khi có URL thật thì group mới có texture riêng của mình. Xem
    // compileGroupVars bên dưới cho cách 3 trạng thái này được biên dịch.
    bubbleTextureUrl: null,
    bubbleTextureSize: 'auto',
    bubbleTextureRepeat: 'repeat',
    bubbleTextureOpacity: 1,
    bubbleTexturePositionX: 50,
    bubbleTexturePositionY: 50,
    bubbleTextureBlendMode: 'normal',

    // Dedicated "Hội viên trong N tháng" line — see
    // overlay/modules/message-body.js#composeMemberMonthsText for which
    // events actually carry a real month count (membership_new never
    // does — that's expected, not something to fix here). showMemberMonths
    // just gates whether Fan Service is even allowed to reveal the line;
    // an empty line (no real month count) still stays hidden regardless,
    // via the .ovs-member-months:not(:empty) selector in
    // groupOverrideCssBlock below.
    showMemberMonths: true,
    monthsAlign: 'left', // 'left' | 'center' | 'right'
    monthsFontScale: 1.25, // > 1 by default — meant to stand out, not blend in
    monthsColor: '#ffd166',

    // ─── superchat-only fields below (badgeBefore/badgeAfter/useTierColor) —
    // moved from role-style-config.js#createSuperchatDefaults during the
    // Super Chat -> Fan Service refactor. These fields exist in every
    // group's object (same shape for superchat/membership, matching the
    // "one shape, ignored where meaningless" convention showMemberMonths
    // above already uses in the other direction), but compileFanServiceCss
    // only ever reads them for the superchat group — see
    // groupOverrideCssBlock. manualBgColor/manualBorderColor just below are
    // the exception: those two ARE read for membership too (direct bubble
    // color there, tier-off fallback color for superchat).
    //
    // Badge before/after the name (text/emoji or an image URL — reuses
    // quoteCssContent/getBadgeImageSrc from shared/css-content-helpers.js).
    badgeBefore: null,
    badgeAfter: null,
    // Màu theo tier tiền YouTube. true (default): read the per-message
    // --ovs-superchat-tier-color/-bg/-border vars message-renderer.js
    // already sets inline on the row (see shared/chat-message.js's
    // SUPERCHAT_TIER_TABLE, which is what derives them — untouched by this
    // refactor). false: authorColor/messageColor above drive the color by
    // hand instead. Membership has no tier, so this field is meaningless
    // there and unused.
    useTierColor: true,
    // Màu bubble (nền/viền). For superchat, only takes effect when
    // useTierColor: false — before this refactor, role-style-config.js's
    // createSuperchatDefaults() had messageBg/messageBorderColor for this;
    // when Super Chat moved into fan-service-config.js those two fields
    // weren't carried over, so "màu thủ công" only changed name/text color
    // (authorColor/messageColor) while the bubble bg+border stayed hardcoded
    // at bgFallback/borderFallback in groupOverrideCssBlock. Re-added here to
    // match the original design: null = still uses that hardcoded fallback
    // (no change from before this field existed); a value = Super Chat's
    // bubble uses the user's own color when tier color is off.
    // For membership there's no tier concept at all, so these two fields are
    // just a direct bubble color override — null (default) = no override,
    // row keeps whatever background the global Bubble/Role styling gives it.
    manualBgColor: null,
    manualBorderColor: null,
    // Hình dạng/viền/đổ bóng/glow riêng cho bubble Super Chat — độc lập với
    // manualBgColor/manualBorderColor ở trên (những field đó chỉ có ý nghĩa
    // khi useTierColor: false, vì chúng thay cho MÀU theo tier). Nhóm field
    // này thì áp dụng bất kể useTierColor đang bật hay tắt — đây là phần
    // "thiết kế bubble Super Chat theo cá nhân" thực sự bị thiếu trước đó:
    // trước bản refactor này không có nơi nào (cả Role tab cũ và Fan
    // Service) cho chỉnh viền/bo góc/độ mờ/đổ bóng/glow riêng cho bubble
    // Super Chat — mọi thứ ngoài màu đều khoá cứng theo global Bubble tab.
    // null (mặc định) = không đè gì, bubble Super Chat vẫn kế thừa
    // --ovs-bubble-* toàn cục như trước khi có các field này.
    bubbleBorderWidth: null, // px, hoặc null = theo global --ovs-bubble-border-width
    bubbleBorderStyle: null, // 'solid' | 'dashed' | 'dotted', hoặc null = theo global
    bubbleRadius: null, // px (bo góc), hoặc null = theo global --ovs-bubble-radius
    bubbleOpacity: null, // 0–1, hoặc null = theo global --ovs-bubble-opacity
    bubbleBoxShadow: null, // chuỗi CSS box-shadow, hoặc null/'none' = không đổ bóng riêng
    bubbleGlow: null, // chuỗi CSS filter: drop-shadow(...), hoặc null/'none' = không glow riêng
    // Số tiền (amount badge — .ovs-superchat-amount, created by
    // message-renderer.js/bubble-updater.js whenever the row carries a
    // superchatCurrencyRaw value). Always on — there is no user-facing
    // switch for this any more; mergeGroupConfig below always forces this
    // back to true no matter what's persisted/patched in.
    showAmount: true,
    amountPosition: 'inline', // 'inline' (next to name) | 'block' (own line below)
    // Only meaningful when amountPosition is 'block' (irrelevant, and
    // ignored, when 'inline' — the amount just sits next to the name
    // there). Controls where the amount badge sits on its own line.
    amountAlign: 'center', // 'left' | 'center' | 'right'
    // Scale, not absolute px, for consistency with every other size field
    // in this file (see file header comment) — 1 = BASE_SIZES.amountFontSize.
    amountFontScale: 1,
    amountFontWeight: 'bold', // 'normal' | 'bold' | 'extrabold'
    // 'pill' (default): amount keeps its rounded background/border chip.
    // 'plain': just the number/text, no background/border/padding/radius —
    // still colored per useTierColor like before.
    amountStyle: 'pill', // 'pill' | 'plain'

    ...overrides,
  };
}

const DEFAULT_FAN_SERVICE_CONFIG = {
  superchat: createGroupConfig(),
  membership: createGroupConfig(),
};

function mergeGroupConfig(base, overrides) {
  return {
    ...(base || createGroupConfig()),
    ...(overrides || {}),
    // Số tiền (Super Chat amount) no longer has a user-facing on/off
    // switch — it must always be shown, so normalization forces this to
    // true regardless of what a legacy config.json/dashboard patch may
    // carry (see createGroupConfig's showAmount comment above).
    showAmount: true,
  };
}

function mergeFanServiceConfig(base, overrides) {
  const b = base || DEFAULT_FAN_SERVICE_CONFIG;
  const o = overrides || {};
  return {
    superchat: mergeGroupConfig(b.superchat, o.superchat),
    membership: mergeGroupConfig(b.membership, o.membership),
  };
}

// Only the message/meta/body/slot-order/slot-spacing subset of
// compileLayoutToCssVariables' output is relevant here — screen.* fields
// (chat alignment on the page, RTL mirroring, bubble-wrap mode, header
// split) stay global (Bố cục tab), not per-event-type. Badges slot keys are
// intentionally excluded — Fan Service no longer manages badge
// order/spacing, that stays whatever Bố cục already gives it.
// NOTE: --ovs-layout-message-padding is intentionally NOT in this list.
// overlay/base-layout.css's plain `.ovs-message` rule never actually reads
// it, and overlay/bubble-wrap.css's higher-specificity `!important` rule
// (which IS what paints the bubble's real padding) reads --ovs-bubble-pad-*
// instead — so that variable was dead on arrival. Real per-side padding is
// emitted separately below as a direct !important override, via
// groupOverrideCssBlock (see its own comment for why plain vars aren't
// enough there either).
const LAYOUT_VAR_KEYS = [
  '--ovs-layout-message-direction', '--ovs-layout-message-gap', '--ovs-layout-message-align',
  '--ovs-layout-message-margin',
  '--ovs-layout-meta-direction', '--ovs-layout-meta-gap', '--ovs-layout-meta-align',
  '--ovs-layout-meta-padding', '--ovs-layout-meta-margin',
  '--ovs-layout-body-direction', '--ovs-layout-body-gap', '--ovs-layout-body-align',
  '--ovs-layout-body-padding', '--ovs-layout-body-margin',
  '--ovs-layout-slot-avatar-order', '--ovs-layout-slot-avatar-padding', '--ovs-layout-slot-avatar-margin',
  '--ovs-layout-slot-author-order', '--ovs-layout-slot-author-padding', '--ovs-layout-slot-author-margin',
  '--ovs-layout-slot-message-order', '--ovs-layout-slot-message-padding', '--ovs-layout-slot-message-margin',
];

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : null;
}

/** Clamps a scale multiplier to a sane positive number, defaulting to 1 (= original size). */
function scale(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const AUTHOR_ALIGN_VALUES = new Set(['left', 'center', 'right']);

/** Resolves one group's 4 independent padding sides to px numbers. */
function paddingPx(group) {
  const g = mergeGroupConfig(createGroupConfig(), group);
  return {
    top: BASE_SIZES.paddingTop * scale(g.paddingTopScale),
    right: BASE_SIZES.paddingRight * scale(g.paddingRightScale),
    bottom: BASE_SIZES.paddingBottom * scale(g.paddingBottomScale),
    left: BASE_SIZES.paddingLeft * scale(g.paddingLeftScale),
  };
}

/** Compiles one group's config into a flat { '--ovs-...': value } map. */
function compileGroupVars(group) {
  const g = mergeGroupConfig(createGroupConfig(), group);
  const expanded = expandSimpleLayout({
    avatarPosition: g.avatarPosition,
    messagePosition: g.messagePosition,
    gap: BASE_SIZES.gap * scale(g.gapScale),
    // `padding` here only feeds the dead --ovs-layout-message-padding var
    // (see LAYOUT_VAR_KEYS comment) — left at its default, real per-side
    // padding is computed by paddingPx() below instead.
  });
  const fullVars = compileLayoutToCssVariables(expanded);

  const vars = {};
  LAYOUT_VAR_KEYS.forEach((key) => {
    if (fullVars[key] !== undefined) vars[key] = fullVars[key];
  });

  vars['--ovs-slot-avatar-size'] = px(BASE_SIZES.avatarSize * scale(g.avatarScale));
  vars['--ovs-slot-author-font-size'] = px(BASE_SIZES.authorFontSize * scale(g.authorFontScale));
  vars['--ovs-slot-author-text-align'] = AUTHOR_ALIGN_VALUES.has(g.authorAlign) ? g.authorAlign : 'left';
  if (g.authorColor) vars['--ovs-slot-author-color'] = g.authorColor;
  vars['--ovs-slot-message-font-size'] = px(BASE_SIZES.messageFontSize * scale(g.messageFontScale));
  if (g.messageColor) vars['--ovs-slot-message-color'] = g.messageColor;

  // Fan Service texture override — only touch --ovs-bubble-texture-* at
  // all when this group actually has an opinion (bubbleTextureUrl !=
  // null). Leaving it untouched means the row's .ovs-bubble-texture child
  // just keeps inheriting whatever the global tab / per-slot config
  // already resolved to, exactly as if this group never existed.
  if (g.bubbleTextureUrl != null) {
    const url = typeof g.bubbleTextureUrl === 'string' ? g.bubbleTextureUrl.trim() : '';
    vars['--ovs-bubble-texture-url'] = url ? `url("${toImageProxyUrl(url) || url}")` : 'none';
    vars['--ovs-bubble-texture-repeat'] = g.bubbleTextureRepeat || 'repeat';
    vars['--ovs-bubble-texture-size'] =
      typeof g.bubbleTextureSize === 'number' ? px(g.bubbleTextureSize) : (g.bubbleTextureSize || 'auto');
    const clamp0to100 = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
    };
    vars['--ovs-bubble-texture-opacity'] = String(
      Math.round(clamp0to100(Number(g.bubbleTextureOpacity ?? 1) * 100, 100)) / 100,
    );
    const texPosX = clamp0to100(g.bubbleTexturePositionX, 50);
    const texPosY = clamp0to100(g.bubbleTexturePositionY, 50);
    vars['--ovs-bubble-texture-position'] = `${texPosX}% ${texPosY}%`;
    vars['--ovs-bubble-texture-blend'] = g.bubbleTextureBlendMode || 'normal';
  }

  // No --ovs-slot-badges-* here (badge mechanism removed) and no
  // --ovs-package-name-* here (package-name section removed) — both fall
  // through to their normal base-CSS defaults, see file header comment.

  return vars;
}

function varsToCssBlock(selector, vars) {
  const entries = Object.entries(vars);
  if (!entries.length) return '';
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `${selector} {\n${body}\n}`;
}

const ALIGN_TO_FLEX = { left: 'flex-start', center: 'center', right: 'flex-end' };

/**
 * Single source of truth for how the name (.ovs-author) and, for Super
 * Chat rows, the amount badge (.ovs-superchat-amount) lay themselves out
 * inside their shared wrapper (.ovs-author-area — see
 * overlay/modules/message-renderer.js; only Super Chat rows get this
 * wrapper, membership rows have no amount and no wrapper).
 *
 * Previously this was two independent pieces of code — one toggled
 * .ovs-author-area's flex-ness based on authorAlign, the other separately
 * positioned .ovs-superchat-amount based on amountPosition — that only
 * happened to agree with each other for the combinations someone had
 * actually tested. Computing both from one function, once, for every
 * authorAlign x amountPosition x amountAlign combination is what makes
 * every combination actually work instead of some pairs silently
 * clobbering each other.
 *
 * Returns { area, author, amount } — arrays of CSS declaration lines (each
 * already `!important`-suffixed) for the three selectors, empty arrays
 * where nothing needs to change from the base stylesheet.
 */
function buildAuthorAreaLayout(g, authorAlign) {
  const showAmount = g.showAmount !== false;
  const isBlock = showAmount && g.amountPosition === 'block';
  const amountAlign = AUTHOR_ALIGN_VALUES.has(g.amountAlign) ? g.amountAlign : 'center';
  // Only turn .ovs-author-area into a flex container at all when there's
  // an actual layout decision to make — keeps the untouched default
  // (authorAlign: 'left', amountPosition: 'inline') exactly as it always
  // rendered (plain inline flow, name snug against the amount).
  const needsAreaFlex = isBlock || authorAlign !== 'left';

  const area = [];
  const author = [];
  const amount = [];

  if (needsAreaFlex) {
    area.push('  display: flex !important;', '  width: 100% !important;', '  min-width: 0 !important;');
    if (isBlock) {
      // Amount on its own line: stack name/amount vertically, stretch
      // both to the row's full width so each can be aligned independently
      // via text-align (name) / align-self (amount).
      area.push('  flex-direction: column !important;', '  align-items: stretch !important;');
    } else {
      // Amount inline: keep them side by side, vertically centered.
      area.push('  flex-direction: row !important;', '  align-items: center !important;');
    }
  }

  if (authorAlign !== 'left') {
    author.push(`  text-align: ${authorAlign} !important;`);
    if (!isBlock) {
      // Row mode: .ovs-author is a shrink-to-fit flex item by default, so
      // center/right text-align has no room to move into unless it grows
      // to fill the row first. In column mode this isn't needed —
      // align-items: stretch above already gives it full width.
      author.push('  flex: 1 1 auto !important;', '  min-width: 0 !important;');
    }
  }

  if (isBlock) {
    amount.push(`  align-self: ${ALIGN_TO_FLEX[amountAlign]} !important;`, '  width: fit-content !important;');
  }

  return { area, author, amount };
}

/**
 * Direct property overrides for the row itself and the sub-elements Vai trò
 * (role-styles.css) also targets (.ovs-author / .ovs-text). Two unrelated
 * specificity problems solved the same way here:
 *
 * 1. role-styles.css sets color/font-size on .ovs-author/.ovs-text with
 *    `!important`, reading its own --ovs-role-* variables — it never reads
 *    the --ovs-slot-* variables compileGroupVars() writes. So when Vai trò
 *    is enabled for a row Fan Service also targets, role-styles.css's
 *    !important rules win and Fan Service's colors/font-sizes silently
 *    lose, even though the CSS variables are set correctly.
 *
 * 2. The row's real padding is painted by overlay/bubble-wrap.css's
 *    `:root[data-ovs-bubble-wrap-row='true'] .ovs-message { padding: ... !important }`
 *    (and, in split-wrap mode, `:root:not(...) .ovs-message { padding: 0 !important }`)
 *    — both read --ovs-bubble-pad-top/right/bottom/left (falling back to
 *    -x/-y), NOT the --ovs-layout-message-padding variable Fan Service used
 *    to write (see LAYOUT_VAR_KEYS comment). That's the actual reason the
 *    old Padding slider never did anything. Fan Service now sets `padding`
 *    directly on the row selector below instead of relying on a variable.
 *
 * Since Fan Service is meant to override generic styling for the rows it
 * targets, emit matching !important declarations at a selector weight at
 * least as high as those other rules — role-styles.css's most specific
 * rules stack up to ~6 class-equivalents (e.g.
 * `:root[data-a][data-b] .ovs-message.ovs-superchat .ovs-author`), and
 * bubble-wrap.css's row rule is `:root[data-x] .ovs-message` (~3). Repeating
 * the row selector's last class several extra times (e.g.
 * `.ovs-superchat.ovs-superchat...`) bumps our selector's weight without
 * changing what it matches, so this wins regardless of stylesheet order.
 */
function groupOverrideCssBlock(rowSelectors, group, isSuperchatGroup = false) {
  const g = mergeGroupConfig(createGroupConfig(), group);
  const bumped = rowSelectors.map((s) => {
    const lastClass = s.match(/\.[\w-]+$/)[0];
    return s + lastClass.repeat(6);
  });

  const authorFontSize = px(BASE_SIZES.authorFontSize * scale(g.authorFontScale));
  const messageFontSize = px(BASE_SIZES.messageFontSize * scale(g.messageFontScale));
  const pad = paddingPx(group);
  const useTierColor = g.useTierColor !== false;

  const rules = [];
  bumped.forEach((sel) => {
    // Row: real 4-side padding (see point 2 above).
    rules.push(
      `${sel} {\n  padding: ${px(pad.top)} ${px(pad.right)} ${px(pad.bottom)} ${px(pad.left)} !important;\n}`,
    );

    const authorAlign = AUTHOR_ALIGN_VALUES.has(g.authorAlign) ? g.authorAlign : 'left';
    const author = [];
    if (g.authorColor) author.push(`  color: ${g.authorColor} !important;`);
    if (authorFontSize) author.push(`  font-size: ${authorFontSize} !important;`);

    if (isSuperchatGroup) {
      // Super Chat rows: name + amount share .ovs-author-area — lay both
      // out together via the single buildAuthorAreaLayout function above,
      // so every authorAlign x amountPosition x amountAlign combination is
      // computed consistently instead of two separate code paths having to
      // happen to agree.
      const layout = buildAuthorAreaLayout(g, authorAlign);
      if (layout.area.length) rules.push(`${sel} .ovs-author-area {\n${layout.area.join('\n')}\n}`);
      author.push(...layout.author);
      if (layout.amount.length) rules.push(`${sel} .ovs-superchat-amount {\n${layout.amount.join('\n')}\n}`);
    } else if (authorAlign !== 'left') {
      // Membership rows: no amount, no wrapper div — .ovs-author is a
      // direct flex item of .ovs-meta, so it just needs room to grow into
      // for its own text-align to have an effect.
      author.push('  flex: 1 1 auto !important;', '  min-width: 0 !important;');
    }
    if (author.length) rules.push(`${sel} .ovs-author {\n${author.join('\n')}\n}`);

    const text = [];
    if (g.messageColor) text.push(`  color: ${g.messageColor} !important;`);
    if (messageFontSize) text.push(`  font-size: ${messageFontSize} !important;`);
    if (text.length) rules.push(`${sel} .ovs-text {\n${text.join('\n')}\n}`);

    // Dedicated "Hội viên trong N tháng" line. Hidden by default in
    // base-layout.css; this is what actually turns it on. `:not(:empty)`
    // keeps it hidden on rows with nothing real to show (membership_new,
    // or showMemberMonths off) without needing a separate JS-driven
    // data-hidden flag — composeMemberMonthsText() already leaves the
    // element textContent-empty in exactly those cases.
    if (g.showMemberMonths !== false) {
      const monthsAlign = AUTHOR_ALIGN_VALUES.has(g.monthsAlign) ? g.monthsAlign : 'left';
      const monthsFontSize = px(BASE_SIZES.monthsFontSize * scale(g.monthsFontScale));
      const months = [`  display: block !important;`, `  text-align: ${monthsAlign} !important;`];
      if (monthsFontSize) months.push(`  font-size: ${monthsFontSize} !important;`);
      if (g.monthsColor) months.push(`  color: ${g.monthsColor} !important;`);
      rules.push(`${sel} .ovs-member-months:not(:empty) {\n${months.join('\n')}\n}`);
    }

    // ─── Bubble shape — border width/style/radius/opacity/shadow/glow.
    // Independent of useTierColor/badge/amount below and, unlike those,
    // NOT superchat-only: these fields exist in every group's object (see
    // the createGroupConfig comment above them) and now apply the same way
    // for membership rows too, so "🖌️ Bubble riêng" in FanServicePanel.jsx
    // has somewhere to actually take effect for Hội viên. null means "no
    // opinion", falling back to the row's normal global --ovs-bubble-*
    // variable exactly as if this group never existed.
    const borderWidthPx = typeof g.bubbleBorderWidth === 'number' ? px(g.bubbleBorderWidth) : null;
    const radiusPx = typeof g.bubbleRadius === 'number' ? px(g.bubbleRadius) : null;
    const hasOpacity = typeof g.bubbleOpacity === 'number' && g.bubbleOpacity >= 0 && g.bubbleOpacity <= 1;
    const shapeBlock = [
      `  border-width: ${borderWidthPx || 'var(--ovs-bubble-border-width, 1px)'} !important;`,
      `  border-style: ${g.bubbleBorderStyle || 'solid'} !important;`,
      ...(radiusPx ? [`  border-radius: ${radiusPx} !important;`] : []),
      ...(hasOpacity ? [`  opacity: ${g.bubbleOpacity} !important;`] : []),
      ...(g.bubbleBoxShadow && g.bubbleBoxShadow !== 'none' ? [`  box-shadow: ${g.bubbleBoxShadow} !important;`] : []),
      ...(g.bubbleGlow && g.bubbleGlow !== 'none' ? [`  filter: ${g.bubbleGlow} !important;`] : []),
    ];
    rules.push(`${sel} {\n${shapeBlock.join('\n')}\n}`);

    // ─── superchat-only — ported from overlay/role-styles.css's old
    // "3. SUPER CHAT STYLES" block (data-ovs-role-superchat-* attribute
    // selectors on :root), converted to this scoped-selector form. See
    // docs/refactor-superchat-to-fanservice.md section 3.5.
    if (isSuperchatGroup) {
      // 1. Background/border-color — tier color (reads the
      // --ovs-superchat-tier-* vars message-renderer.js already sets
      // inline per-row) when useTierColor, else a fixed manual fallback.
      // Applied to the row only. Earlier this also painted the same
      // background/border onto .ovs-text, creating a second "bubble"
      // nested inside the row — that's intentionally gone now: .ovs-text
      // is left alone here, so the message content sits directly on the
      // row's own background with no extra frame around it.
      const bgFallback = g.manualBgColor || 'rgba(104, 87, 34, 0.8)';
      const borderFallback = g.manualBorderColor || 'rgba(255, 202, 40, 0.45)';
      const bg = useTierColor ? `var(--ovs-superchat-tier-bg, ${bgFallback})` : bgFallback;
      const borderColor = useTierColor ? `var(--ovs-superchat-tier-border, ${borderFallback})` : borderFallback;
      rules.push(`${sel} {\n  background: ${bg} !important;\n  border-color: ${borderColor} !important;\n}`);

      // 2. Badge before/after the name (badgeBefore/badgeAfter — moved from
      // role-style-config.js's role-level badge, superchat-only now).
      rules.push(
        `${sel} .ovs-author::before {\n  content: ${quoteCssContent(g.badgeBefore)} !important;\n  margin-right: 0.35em;\n  font-size: 0.82em;\n  opacity: 0.92;\n}`,
      );
      rules.push(
        `${sel} .ovs-author::after {\n  content: ${quoteCssContent(g.badgeAfter)} !important;\n  margin-left: 0.35em;\n  font-size: 0.82em;\n  opacity: 0.92;\n}`,
      );

      // 3. Amount badge (.ovs-superchat-amount, created by
      // message-renderer.js/bubble-updater.js) — visuals only (color, font,
      // pill shape). Position (inline vs. block) and alignment are handled
      // entirely by buildAuthorAreaLayout above — this section no longer
      // duplicates any of that, so there's exactly one place that decides
      // *where* the badge sits and one place that decides *what it looks
      // like*.
      if (g.showAmount === false) {
        rules.push(`${sel} .ovs-superchat-amount {\n  display: none !important;\n}`);
      } else {
        const isPlain = g.amountStyle === 'plain';
        const isBlockAmount = g.amountPosition === 'block';
        const amountFontSize = px(BASE_SIZES.amountFontSize * scale(g.amountFontScale));
        const amountWeight = FONT_WEIGHT_MAP[g.amountFontWeight] || '700';
        const amountColor = useTierColor ? 'var(--ovs-superchat-tier-color, #fde047)' : (g.authorColor || '#fde047');
        const amountCommon = [
          `  font-weight: ${amountWeight} !important;`,
          `  color: ${amountColor} !important;`,
        ];
        if (isPlain) {
          amountCommon.push('  background: transparent !important;', '  border: 0 !important;');
        } else {
          const amountBg = useTierColor
            ? 'var(--ovs-superchat-tier-bg, rgba(255, 202, 40, 0.25))'
            : (g.manualBgColor || 'rgba(255, 202, 40, 0.2)');
          const amountBorder = useTierColor
            ? 'var(--ovs-superchat-tier-border, rgba(255, 202, 40, 0.5))'
            : (g.manualBorderColor || 'rgba(255, 202, 40, 0.45)');
          amountCommon.push(`  background: ${amountBg} !important;`, `  border: 1px solid ${amountBorder} !important;`);
        }
        if (amountFontSize) amountCommon.push(`  font-size: ${amountFontSize} !important;`);
        if (isBlockAmount) {
          rules.push(`${sel} .ovs-superchat-amount {
  display: block !important;
  margin-top: 0.2em !important;
  padding: ${isPlain ? '0 !important' : '0.15em 0.55em !important'};
  border-radius: ${isPlain ? '0 !important' : '8px !important'};
  line-height: 1.3 !important;
${amountCommon.join('\n')}
}`);
        } else {
          rules.push(`${sel} .ovs-superchat-amount {
  display: inline-flex !important;
  align-items: center !important;
  margin-left: 0.35em !important;
  padding: ${isPlain ? '0 !important' : '0.12em 0.5em !important'};
  border-radius: ${isPlain ? '0 !important' : '999px !important'};
  line-height: 1.2 !important;
  vertical-align: middle !important;
${amountCommon.join('\n')}
}`);
        }
      }

      // 4. Author color follows the same tier/manual split as the
      // background above (kept separate from the generic `author`/`text`
      // color rules pushed earlier in this loop, which still apply first —
      // this is pushed later so it wins on equal specificity, then the
      // contrast-fix below wins over THIS via the tier attribute selector's
      // extra specificity when useTierColor is on).
      const superchatColor = useTierColor ? 'var(--ovs-superchat-tier-color, #fde047)' : (g.authorColor || '#fde047');
      rules.push(`${sel} .ovs-author {\n  color: ${superchatColor} !important;\n}`);

      // 5. Tier-color text contrast fix — a translucent tint of the tier
      // color sits behind .ovs-author/.ovs-superchat-amount/.ovs-text, so
      // painting the raw tier color as TEXT on top of its own tint is
      // unreadable for the light tiers (1-2, blue/cyan). Fixed lookup over
      // the 7 known tier colors (not a runtime contrast calc): white text
      // for tiers 3-7, near-black for tiers 1-2. Only meaningful when
      // useTierColor is on — with it off there's no tier tint to clash
      // with, so authorColor/messageColor (already applied above) stand.
      if (useTierColor) {
        rules.push(
          `${sel} .ovs-author,\n${sel} .ovs-superchat-amount,\n${sel} .ovs-text {\n  color: #ffffff !important;\n}`,
        );
        ['1', '2'].forEach((tier) => {
          rules.push(
            `${sel}[data-ovs-superchat-tier='${tier}'] .ovs-author,\n` +
            `${sel}[data-ovs-superchat-tier='${tier}'] .ovs-superchat-amount,\n` +
            `${sel}[data-ovs-superchat-tier='${tier}'] .ovs-text {\n  color: #0a0a0a !important;\n}`,
          );
        });
      }
    } else {
      // Membership bubble background/border color. No tier concept here
      // (that's a Super Chat-only idea, tied to donation amount), so this
      // is just a direct manual color instead of the tier/manual split
      // above — reuses the same manualBgColor/manualBorderColor fields the
      // schema already gives every group. null (default) = no override, row
      // keeps whatever background the global Bubble/Role styling gives it,
      // same as before this field had an editor in FanServicePanel.jsx.
      const membershipOverride = [];
      if (g.manualBgColor) membershipOverride.push(`  background: ${g.manualBgColor} !important;`);
      if (g.manualBorderColor) membershipOverride.push(`  border-color: ${g.manualBorderColor} !important;`);
      if (membershipOverride.length) rules.push(`${sel} {\n${membershipOverride.join('\n')}\n}`);
    }
  });

  // Visibility — emit display:none for any element the user hid.
  // Uses the same bumped selectors so specificity beats role-styles.css.
  if (g.showAvatar === false) {
    bumped.forEach((sel) => {
      rules.push(`${sel} .ovs-avatar {\n  display: none !important;\n}`);
    });
  }
  if (g.showAuthor === false) {
    bumped.forEach((sel) => {
      rules.push(`${sel} .ovs-author {\n  display: none !important;\n}`);
    });
  }
  // No .ovs-meta collapse here — .ovs-meta only wraps the author name now
  // (the raw badges display slot was removed app-wide), and Fan Service
  // already has its own showAuthor toggle for that.
  if (g.showMessage === false) {
    bumped.forEach((sel) => {
      rules.push(`${sel} .ovs-text {\n  display: none !important;\n}`);
    });
  }

  return rules.join('\n\n');
}

/**
 * Compiles the whole FanServiceConfig into scoped CSS text — one rule block
 * per enabled group, targeting the row classes message-renderer.js actually
 * stamps on every message row: `.ovs-message` plus `.ovs-superchat` /
 * `.ovs-event-<type>` (see overlay/modules/message-renderer.js and the row
 * template in overlay/index.html). A disabled group emits nothing, so those
 * rows fall through untouched to whatever Bố cục / Vai trò already produces.
 */
function compileFanServiceCss(config) {
  const cfg = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, config);
  const blocks = [];

  if (cfg.superchat.enabled) {
    const rowSelectors = ['.ovs-message.ovs-superchat'];
    blocks.push(varsToCssBlock(rowSelectors.join(', '), compileGroupVars(cfg.superchat)));
    blocks.push(groupOverrideCssBlock(rowSelectors, cfg.superchat, true));
  }

  if (cfg.membership.enabled) {
    const rowSelectors = [
      '.ovs-message.ovs-event-membership_new',
      '.ovs-message.ovs-event-membership_gift_sent',
      '.ovs-message.ovs-event-membership_milestone',
    ];
    blocks.push(varsToCssBlock(rowSelectors.join(', '), compileGroupVars(cfg.membership)));
    blocks.push(groupOverrideCssBlock(rowSelectors, cfg.membership));
  }

  return blocks.filter(Boolean).join('\n\n');
}

module.exports = {
  BASE_SIZES,
  DEFAULT_FAN_SERVICE_CONFIG,
  createGroupConfig,
  mergeGroupConfig,
  mergeFanServiceConfig,
  compileGroupVars,
  compileFanServiceCss,
};