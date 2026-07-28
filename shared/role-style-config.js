/**
 * RoleStyleConfig — visual overrides for moderator, member, and superchat messages.
 * Compiled to --ovs-role-* CSS variables on :root.
 */

const ROLE_KEYS = ['moderator', 'member', 'superchat'];

const ROLE_CSS_PREFIX = {
  moderator: 'mod',
  member: 'member',
  superchat: 'superchat',
};

function createRoleDefaults(overrides = {}) {
  return {
    enabled: true,
    authorColor: null,
    authorBorderColor: null,
    authorBg: null,
    messageBg: null,
    messageBorderColor: null,
    messageTextColor: null,
    rowBg: null,
    rowBorderColor: null,
    earColor: null,
    badgeBefore: null,
    badgeAfter: null,
    showAmount: null,
    fontSize: null,
    ...overrides,
  };
}

function createSuperchatDefaults(overrides = {}) {
  return {
    ...createRoleDefaults({
      enabled: true,
      authorColor: '#fde047',
      authorBorderColor: 'rgba(255, 202, 40, 0.55)',
      messageBg: 'rgba(104, 87, 34, 0.8)',
      messageBorderColor: 'rgba(255, 202, 40, 0.45)',
      rowBg: 'rgba(88, 75, 34, 0.78)',
      rowBorderColor: 'rgba(255, 202, 40, 0.45)',
      badgeBefore: '✦',
      showAmount: true,
    }),
    // Superchat-specific fields
    useTierColor: true,        // When true: YouTube tier color overrides manual color settings
    superchatLayout: 'bubble', // 'bubble' | 'banner' | 'youtube'
    amountFontSize: null,      // number (px) or null = inherit from fontSize
    amountFontWeight: 'bold',  // 'normal' | 'bold' | 'extrabold'
    amountPosition: 'inline',  // 'inline' (next to name) | 'block' (own line below name)
    ...overrides,
  };
}

const DEFAULT_ROLE_STYLE_CONFIG = {
  roles: {
    moderator: createRoleDefaults({
      enabled: true,
      authorColor: '#fca5a5',
      authorBorderColor: 'rgba(248, 113, 113, 0.7)',
      messageBg: 'rgba(86, 50, 54, 0.78)',
      messageBorderColor: 'rgba(248, 113, 113, 0.45)',
      badgeBefore: 'MOD',
    }),
    member: createRoleDefaults({
      enabled: true,
      authorColor: '#93c5fd',
      authorBorderColor: 'rgba(96, 165, 250, 0.55)',
      messageBorderColor: 'rgba(96, 165, 250, 0.45)',
      badgeBefore: '★',
    }),
    superchat: createSuperchatDefaults(),
  },
};

function normalizeRole(raw, fallback) {
  const base = fallback || createRoleDefaults();
  const role = raw || {};
  const hasCustomMessageBg = typeof role.messageBg === 'string';
  const hasCustomMessageBorderColor = typeof role.messageBorderColor === 'string';
  return {
    enabled: typeof role.enabled === 'boolean' ? role.enabled : base.enabled !== false,
    authorColor: typeof role.authorColor === 'string' ? role.authorColor : base.authorColor,
    authorBorderColor:
      typeof role.authorBorderColor === 'string' ? role.authorBorderColor : base.authorBorderColor,
    authorBg: typeof role.authorBg === 'string' ? role.authorBg : base.authorBg,
    messageBg:
      typeof role.messageBg === 'string'
        ? role.messageBg
        : (typeof role.messageBgColor === 'string' ? role.messageBgColor : base.messageBg),
    messageBorderColor:
      typeof role.messageBorderColor === 'string' ? role.messageBorderColor : base.messageBorderColor,
    messageTextColor:
      typeof role.messageTextColor === 'string' ? role.messageTextColor : base.messageTextColor,
    rowBg:
      typeof role.rowBg === 'string'
        ? role.rowBg
        : (typeof role.rowBgColor === 'string' ? role.rowBgColor : (hasCustomMessageBg ? null : base.rowBg)),
    rowBorderColor: typeof role.rowBorderColor === 'string' ? role.rowBorderColor : (hasCustomMessageBorderColor ? null : base.rowBorderColor),
    earColor: typeof role.earColor === 'string' ? role.earColor : base.earColor,
    badgeBefore:
      role.badgeBefore !== undefined && role.badgeBefore !== null
        ? role.badgeBefore
        : (typeof role.badge === 'string' ? role.badge : base.badgeBefore),
    badgeAfter:
      role.badgeAfter !== undefined && role.badgeAfter !== null
        ? role.badgeAfter
        : base.badgeAfter,
    showAmount: role.showAmount !== undefined && role.showAmount !== null ? Boolean(role.showAmount) : base.showAmount,
    fontSize: typeof role.fontSize === 'number' && role.fontSize > 0 ? role.fontSize : base.fontSize,
  };
}

function normalizeSuperchatRole(raw, fallback) {
  const baseShape = normalizeRole(raw, fallback);
  const role = raw || {};
  const base = fallback || createSuperchatDefaults();

  return {
    ...baseShape,
    useTierColor: typeof role.useTierColor === 'boolean' ? role.useTierColor : (base.useTierColor !== false),
    superchatLayout: ['banner', 'youtube'].includes(role.superchatLayout)
      ? role.superchatLayout
      : (base.superchatLayout || 'bubble'),
    amountFontSize: typeof role.amountFontSize === 'number' && role.amountFontSize > 0 ? role.amountFontSize : (base.amountFontSize || null),
    amountFontWeight: ['normal', 'bold', 'extrabold'].includes(role.amountFontWeight)
      ? role.amountFontWeight
      : (base.amountFontWeight || 'bold'),
    amountPosition: role.amountPosition === 'block' ? 'block' : (base.amountPosition || 'inline'),
  };
}

function normalizeRoleStyleConfig(config) {
  const defaults = DEFAULT_ROLE_STYLE_CONFIG.roles;
  const roles = config?.roles || {};
  return {
    roles: {
      moderator: normalizeRole(roles.moderator, defaults.moderator),
      member: normalizeRole(roles.member, defaults.member),
      superchat: normalizeSuperchatRole(roles.superchat, defaults.superchat),
    },
  };
}

function mergeRoleStyleConfig(base, overrides) {
  const b = normalizeRoleStyleConfig(base || DEFAULT_ROLE_STYLE_CONFIG);
  const o = overrides || {};
  const mergeOne = (key) => {
    const ov = o.roles?.[key] || {};
    const merged = { ...b.roles[key], ...ov };
    // No dashboard panel has a control for rowBg/rowBorderColor, so any
    // value present here — whether it came from DEFAULT_ROLE_STYLE_CONFIG,
    // a theme preset's own baked gradient, or a stale value from an older
    // bug — is never something the user just chose; it's only ever an echo
    // of whatever was there before, forwarded back because the dashboard
    // round-trips the *entire* role object on every edit. Trying to
    // distinguish "default" from "user-set" via typeof on that echoed
    // value doesn't work (it's indistinguishable from real input once
    // merged), so instead: every dashboard-driven edit unconditionally
    // releases rowBg/rowBorderColor back to null, letting messageBg drive
    // the visual from that point on. A theme's authored rowBg still shows
    // correctly right after selecting the theme (that path normalizes the
    // preset directly, bypassing this merge) — it's just no longer pinned
    // in place the moment the user customizes that role here.
    merged.rowBg = null;
    merged.rowBorderColor = null;
    return merged;
  };
  return normalizeRoleStyleConfig({
    roles: {
      moderator: mergeOne('moderator'),
      member: mergeOne('member'),
      superchat: mergeOne('superchat'),
    },
  });
}

function quoteCssContent(value) {
  if (!value) return 'none';
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

const AMOUNT_FONT_WEIGHT_MAP = {
  normal: '400',
  bold: '700',
  extrabold: '900',
};

function compileRoleStyleToCssVariables(roleStyle) {
  const cfg = normalizeRoleStyleConfig(roleStyle);
  const vars = {};
  const rootFlags = {};

  ROLE_KEYS.forEach((roleKey) => {
    const role = cfg.roles[roleKey];
    const prefix = ROLE_CSS_PREFIX[roleKey];
    const enabled = role.enabled !== false;
    rootFlags[`data-ovs-role-${prefix}-enabled`] = enabled ? 'true' : 'false';

    if (roleKey === 'superchat') {
      rootFlags['data-ovs-role-superchat-show-amount'] =
        role.showAmount === false ? 'false' : 'true';

      // Layout: bubble (default), banner, or youtube (mirrors YouTube's own card)
      rootFlags['data-ovs-role-superchat-layout'] = ['banner', 'youtube'].includes(role.superchatLayout)
        ? role.superchatLayout
        : 'bubble';

      // Amount position: inline (default) or block
      rootFlags['data-ovs-role-superchat-amount-position'] =
        role.amountPosition === 'block' ? 'block' : 'inline';

      // useTierColor: when false, user's manual colors take precedence over tier vars
      rootFlags['data-ovs-role-superchat-use-tier-color'] =
        role.useTierColor === false ? 'false' : 'true';
    }

    if (!enabled) return;

    // When superchat useTierColor is true, skip emitting manual color vars
    // so that --ovs-superchat-tier-* (set inline per-message) wins cleanly.
    const skipManualColors = roleKey === 'superchat' && role.useTierColor !== false;

    if (!skipManualColors) {
      if (role.authorColor) vars[`--ovs-role-${prefix}-author-color`] = role.authorColor;
      if (role.messageBg) vars[`--ovs-role-${prefix}-message-bg`] = role.messageBg;
      if (role.messageBorderColor) vars[`--ovs-role-${prefix}-message-border-color`] = role.messageBorderColor;
    }

    if (role.authorBorderColor) vars[`--ovs-role-${prefix}-author-border-color`] = role.authorBorderColor;
    if (role.authorBg) {
      vars[`--ovs-role-${prefix}-author-bg`] = role.authorBg;
      rootFlags[`data-ovs-role-${prefix}-author-bg`] = 'true';
    }
    if (role.messageTextColor) vars[`--ovs-role-${prefix}-message-text-color`] = role.messageTextColor;
    if (role.rowBg) vars[`--ovs-role-${prefix}-row-bg`] = role.rowBg;
    if (role.rowBorderColor) vars[`--ovs-role-${prefix}-row-border-color`] = role.rowBorderColor;
    if (role.earColor) vars[`--ovs-role-${prefix}-ear-color`] = role.earColor;
    vars[`--ovs-role-${prefix}-badge-before-content`] = quoteCssContent(role.badgeBefore);
    vars[`--ovs-role-${prefix}-badge-after-content`] = quoteCssContent(role.badgeAfter);

    if (typeof role.fontSize === 'number' && role.fontSize > 0) {
      vars[`--ovs-role-${prefix}-message-font-size`] = `${role.fontSize}px`;
      vars[`--ovs-role-${prefix}-author-font-size`] = `${Math.round(role.fontSize * 0.9)}px`;
      vars[`--ovs-role-${prefix}-badges-font-size`] = `${Math.round(role.fontSize * 0.65)}px`;
    }

    // Superchat-specific amount styling
    if (roleKey === 'superchat') {
      const amountSize = role.amountFontSize || role.fontSize;
      if (typeof amountSize === 'number' && amountSize > 0) {
        vars[`--ovs-role-superchat-amount-font-size`] = `${amountSize}px`;
      }
      const weightValue = AMOUNT_FONT_WEIGHT_MAP[role.amountFontWeight] || '700';
      vars[`--ovs-role-superchat-amount-font-weight`] = weightValue;
    }
  });

  return { vars, rootFlags };
}

module.exports = {
  ROLE_KEYS,
  ROLE_CSS_PREFIX,
  DEFAULT_ROLE_STYLE_CONFIG,
  createRoleDefaults,
  createSuperchatDefaults,
  normalizeRoleStyleConfig,
  mergeRoleStyleConfig,
  compileRoleStyleToCssVariables,
};