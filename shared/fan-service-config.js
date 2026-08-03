// FanServiceConfig — dedicated layout/typography customization for Super
// Chat and the three membership events (Hội viên mới, Gia hạn, Tặng hội
// viên). Two independent groups, each OFF by default: until enabled, rows
// keep using normal Bố cục / Vai trò styling.

const { expandSimpleLayout, compileLayoutToCssVariables } = require('./layout-config');
const { quoteCssContent, getBadgeImageSrc, FONT_WEIGHT_MAP } = require('./css-content-helpers');
const { toImageProxyUrl } = require('./image-url');

// Original default px values — every *Scale field is a multiplier of these.
const BASE_SIZES = {
  gap: 10,
  // Matches the bubble's own default padding (overlay/base-layout.css).
  paddingTop: 8,
  paddingRight: 12,
  paddingBottom: 8,
  paddingLeft: 12,
  avatarSize: 32,
  authorFontSize: 15,
  messageFontSize: 16,
  monthsFontSize: 16,
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

    // Texture riêng cho Fan Service, độc lập với texture chung (Bubble tab)
    // và texture per-slot. null = kế thừa; '' = tắt hẳn; URL = riêng.
    bubbleTextureUrl: null,
    bubbleTextureSize: 'auto',
    bubbleTextureRepeat: 'repeat',
    bubbleTextureOpacity: 1,
    bubbleTexturePositionX: 50,
    bubbleTexturePositionY: 50,
    bubbleTextureBlendMode: 'normal',

    // Dedicated "Hội viên trong N tháng" line — see
    showMemberMonths: true,
    monthsAlign: 'left', // 'left' | 'center' | 'right'
    monthsFontScale: 1.25, // > 1 by default — meant to stand out, not blend in
    monthsColor: '#ffd166',

    badgeBefore: null,
    badgeAfter: null,
    // Màu theo tier tiền YouTube. true (default): read the per-message
    useTierColor: true,
    // Màu bubble (nền/viền). For superchat, only takes effect when
    // weren't carried over, so "màu thủ công" only changed name/text color
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
    // Bật/tắt tai thỏ RIÊNG cho nhóm này — độc lập với cài đặt tai thỏ
    // chung (tab Bubble). null = kế thừa (dùng đúng trạng thái bật/tắt
    // của cài đặt chung); true/false = ghi đè hẳn, thắng mọi nguồn khác.
    // Fan Service luôn ép row về 1 bubble duy nhất (không tách author/
    // message), nên dù đang ở chế độ "bọc từng phần" hay "bọc chung" thì
    // cũng chỉ render ĐÚNG 1 cặp tai thỏ ở cấp row — không bao giờ tách
    // theo slot (xem resolveFanServiceBunnyEnabled trong overlay/bubble.js).
    bubbleBunnyEars: null,
    // Số tiền (amount badge — .ovs-superchat-amount, created by
    showAmount: true,
    amountPosition: 'inline', // 'inline' (next to name) | 'block' (own line below)
    amountAlign: 'center', // 'left' | 'center' | 'right'
    // Scale, not absolute px, for consistency with every other size field
    // in this file (see file header comment) — 1 = BASE_SIZES.amountFontSize.
    amountFontScale: 1,
    amountFontWeight: 'bold', // 'normal' | 'bold' | 'extrabold'
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

// split) stay global (Bố cục tab), not per-event-type. Badges slot keys are
// order/spacing, that stays whatever Bố cục already gives it.
// NOTE: --ovs-layout-message-padding is intentionally NOT in this list.
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


  return vars;
}

function varsToCssBlock(selector, vars) {
  const entries = Object.entries(vars);
  if (!entries.length) return '';
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `${selector} {\n${body}\n}`;
}

const ALIGN_TO_FLEX = { left: 'flex-start', center: 'center', right: 'flex-end' };

// Single source of truth for how the name (.ovs-author) and, for Super
function buildAuthorAreaLayout(g, authorAlign) {
  const showAmount = g.showAmount !== false;
  const isBlock = showAmount && g.amountPosition === 'block';
  const amountAlign = AUTHOR_ALIGN_VALUES.has(g.amountAlign) ? g.amountAlign : 'center';
  const needsAreaFlex = isBlock || authorAlign !== 'left';

  const area = [];
  const author = [];
  const amount = [];

  if (needsAreaFlex) {
    area.push('  display: flex !important;', '  width: 100% !important;', '  min-width: 0 !important;');
    if (isBlock) {
      area.push('  flex-direction: column !important;', '  align-items: stretch !important;');
    } else {
      // Amount inline: keep them side by side, vertically centered.
      area.push('  flex-direction: row !important;', '  align-items: center !important;');
    }
  }

  if (authorAlign !== 'left') {
    author.push(`  text-align: ${authorAlign} !important;`);
    if (!isBlock) {
      author.push('  flex: 1 1 auto !important;', '  min-width: 0 !important;');
    }
  }

  if (isBlock) {
    amount.push(`  align-self: ${ALIGN_TO_FLEX[amountAlign]} !important;`, '  width: fit-content !important;');
  }

  return { area, author, amount };
}

// Direct property overrides for the row itself and the sub-elements Vai trò
// Direct property overrides for the row itself and the sub-elements Vai trò
// the --ovs-slot-* variables compileGroupVars() writes. So when Vai trò
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
      const layout = buildAuthorAreaLayout(g, authorAlign);
      if (layout.area.length) rules.push(`${sel} .ovs-author-area {\n${layout.area.join('\n')}\n}`);
      author.push(...layout.author);
      if (layout.amount.length) rules.push(`${sel} .ovs-superchat-amount {\n${layout.amount.join('\n')}\n}`);
    } else if (authorAlign !== 'left') {
      author.push('  flex: 1 1 auto !important;', '  min-width: 0 !important;');
    }
    if (author.length) rules.push(`${sel} .ovs-author {\n${author.join('\n')}\n}`);

    const text = [];
    if (g.messageColor) text.push(`  color: ${g.messageColor} !important;`);
    if (messageFontSize) text.push(`  font-size: ${messageFontSize} !important;`);
    if (text.length) rules.push(`${sel} .ovs-text {\n${text.join('\n')}\n}`);

    // Dedicated "Hội viên trong N tháng" line. Hidden by default in
    if (g.showMemberMonths !== false) {
      const monthsAlign = AUTHOR_ALIGN_VALUES.has(g.monthsAlign) ? g.monthsAlign : 'left';
      const monthsFontSize = px(BASE_SIZES.monthsFontSize * scale(g.monthsFontScale));
      const months = [`  display: block !important;`, `  text-align: ${monthsAlign} !important;`];
      if (monthsFontSize) months.push(`  font-size: ${monthsFontSize} !important;`);
      if (g.monthsColor) months.push(`  color: ${g.monthsColor} !important;`);
      rules.push(`${sel} .ovs-member-months:not(:empty) {\n${months.join('\n')}\n}`);
    }

    // for membership rows too, so "🖌️ Bubble riêng" in FanServicePanel.jsx
    // has somewhere to actually take effect for Hội viên. null means "no
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

    if (isSuperchatGroup) {
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

      // Amount badge visuals (position/alignment handled by buildAuthorAreaLayout).
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

      const superchatColor = useTierColor ? 'var(--ovs-superchat-tier-color, #fde047)' : (g.authorColor || '#fde047');
      rules.push(`${sel} .ovs-author {\n  color: ${superchatColor} !important;\n}`);

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
      // Membership bubble bg/border — direct manual color, no tier concept here.
      // Always emitted (not just when a manual color is set): split-wrap mode
      // forces `.ovs-message { background: transparent !important }` at the
      // root level (overlay/bubble-wrap.css) for every row that isn't using
      // row-wrap. Super Chat above always re-asserts its own background, so
      // it survives that reset; membership previously only did when a manual
      // color was chosen, so with no manual color the row's bubble vanished
      // under "bọc từng phần". Falling back to the same --ovs-bubble-bg the
      // row already renders from in normal row-wrap mode keeps the look
      // identical there while also surviving split-wrap.
      rules.push(
        `${sel} {\n` +
          `  background: ${g.manualBgColor || 'var(--ovs-bubble-bg, rgba(22, 25, 31, 0.72))'} !important;\n` +
          `  border-color: ${g.manualBorderColor || 'var(--ovs-bubble-border-color, transparent)'} !important;\n` +
          '}',
      );
    }

    // Fan Service always styles the ROW as one bubble (background/border
    // above target `sel` = .ovs-message). "Bọc từng phần" (split-wrap:
    // --ovs-bubble-wrap-author / --ovs-bubble-wrap-message, overlay/bubble-wrap.css)
    // and "Chia đôi bubble" turn .ovs-author / .ovs-text into their OWN
    // separate bubbles instead — which fights the row-level styling above:
    // an empty bubble shows on content-less Super Chat (sticker/amount-only),
    // the "Hội viên trong N tháng" line (.ovs-member-months) never gets any
    // wrap treatment at all, and enabling both slot wraps together visibly
    // breaks membership rows (mismatched nested backgrounds/borders). Fan
    // Service rows opt out of split-wrap entirely — regardless of the global
    // Bố cục setting — so they always render as a single row-bubble, exactly
    // like default row-wrap. `revert` rolls display back to each element's
    // native tag default (.ovs-author is a <span> → inline, .ovs-text is a
    // <div> → block), matching untouched row-wrap output.
    rules.push(
      `${sel} .ovs-author,\n${sel} .ovs-text {\n` +
        '  display: revert !important;\n' +
        '  width: auto !important;\n' +
        '  max-width: none !important;\n' +
        '  min-width: 0 !important;\n' +
        '  min-height: auto !important;\n' +
        '  max-height: none !important;\n' +
        '  height: auto !important;\n' +
        '  align-self: auto !important;\n' +
        '  background: transparent !important;\n' +
        '  opacity: 1 !important;\n' +
        '  border-radius: 0 !important;\n' +
        '  border-width: 0 !important;\n' +
        '  outline-width: 0 !important;\n' +
        '  box-shadow: none !important;\n' +
        '  filter: none !important;\n' +
        '  backdrop-filter: none !important;\n' +
        '  -webkit-backdrop-filter: none !important;\n' +
        '  overflow: visible !important;\n' +
        '  padding: 0 !important;\n' +
        '}',
    );
    rules.push(
      `${sel} > .ovs-bubble-texture,\n${sel} .ovs-author > .ovs-bubble-texture,\n${sel} .ovs-text > .ovs-bubble-texture {\n` +
        '  background-image: none !important;\n' +
        '}',
    );
    rules.push(`${sel} .ovs-meta {\n  align-items: var(--ovs-layout-meta-align, center) !important;\n}`);
    rules.push(`${sel} .ovs-body {\n  align-items: var(--ovs-layout-body-align, stretch) !important;\n}`);

    // "Chia đôi bubble" (headerSplit — overlay/bubble-wrap.css ~L421) rebuilds
    // .ovs-message as a CSS Grid (avatar | name row, divider row, message
    // row) and turns .ovs-body into `display: contents`, gated only on
    // global :root attributes — never scoped per-row. That grid completely
    // overrides Fan Service's own flex-based author/amount layout
    // (buildAuthorAreaLayout() above), so it kept breaking Fan Service rows
    // even after the split-wrap fix above. Force these rows back to the
    // normal flex row/column structure regardless of the global headerSplit
    // setting, and hide the divider pseudo-element it injects.
    rules.push(
      `${sel} {\n` +
        '  display: flex !important;\n' +
        '  grid-template-columns: none !important;\n' +
        '  grid-template-rows: none !important;\n' +
        '  flex-direction: var(--ovs-layout-message-direction, row) !important;\n' +
        '  align-items: var(--ovs-layout-message-align, flex-start) !important;\n' +
        '  gap: var(--ovs-layout-message-gap, 10px) !important;\n' +
        '  max-width: 92% !important;\n' +
        '}',
    );
    rules.push(`${sel}::after {\n  content: none !important;\n  display: none !important;\n}`);
    rules.push(
      `${sel} .ovs-body {\n` +
        '  display: flex !important;\n' +
        '  flex-direction: var(--ovs-layout-body-direction, column) !important;\n' +
        '  gap: var(--ovs-layout-body-gap, 0) !important;\n' +
        '}',
    );
    rules.push(
      `${sel} .ovs-avatar,\n${sel} .ovs-meta,\n${sel} .ovs-text {\n` +
        '  grid-column: auto !important;\n' +
        '  grid-row: auto !important;\n' +
        '}',
    );
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
  if (g.showMessage === false) {
    bumped.forEach((sel) => {
      rules.push(`${sel} .ovs-text {\n  display: none !important;\n}`);
    });
  }

  return rules.join('\n\n');
}

// Compiles the whole FanServiceConfig into scoped CSS text — one rule block
// rows fall through untouched to whatever Bố cục / Vai trò already produces.
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