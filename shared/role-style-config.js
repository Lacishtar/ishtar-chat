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

const DEFAULT_ROLE_STYLE_CONFIG = {
  roles: {
    moderator: createRoleDefaults({
      enabled: false,
      authorColor: '#fca5a5',
      authorBorderColor: 'rgba(248, 113, 113, 0.7)',
      messageBg: 'linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(22, 25, 31, 0.72))',
      messageBorderColor: 'rgba(248, 113, 113, 0.45)',
      badgeBefore: 'MOD',
    }),
    member: createRoleDefaults({
      enabled: false,
      authorColor: '#93c5fd',
      authorBorderColor: 'rgba(96, 165, 250, 0.55)',
      messageBorderColor: 'rgba(96, 165, 250, 0.45)',
      badgeBefore: '★',
    }),
    superchat: createRoleDefaults({
      enabled: true,
      authorColor: '#fde047',
      authorBorderColor: 'rgba(255, 202, 40, 0.55)',
      messageBg: 'linear-gradient(135deg, rgba(255, 202, 40, 0.28), rgba(22, 25, 31, 0.72))',
      messageBorderColor: 'rgba(255, 202, 40, 0.45)',
      rowBg: 'linear-gradient(135deg, rgba(255, 202, 40, 0.22), rgba(22, 25, 31, 0.72))',
      rowBorderColor: 'rgba(255, 202, 40, 0.45)',
      badgeBefore: '✦',
      showAmount: true,
    }),
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

function normalizeRoleStyleConfig(config) {
  const defaults = DEFAULT_ROLE_STYLE_CONFIG.roles;
  const roles = config?.roles || {};
  return {
    roles: {
      moderator: normalizeRole(roles.moderator, defaults.moderator),
      member: normalizeRole(roles.member, defaults.member),
      superchat: normalizeRole(roles.superchat, defaults.superchat),
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
      if (role.showAmount === false) {
        rootFlags['data-ovs-role-superchat-show-amount'] = 'false';
      } else {
        rootFlags['data-ovs-role-superchat-show-amount'] = 'true';
      }
    }

    if (!enabled) return;

    if (role.authorColor) vars[`--ovs-role-${prefix}-author-color`] = role.authorColor;
    if (role.authorBorderColor) vars[`--ovs-role-${prefix}-author-border-color`] = role.authorBorderColor;
    if (role.authorBg) {
      vars[`--ovs-role-${prefix}-author-bg`] = role.authorBg;
      rootFlags[`data-ovs-role-${prefix}-author-bg`] = 'true';
    }
    if (role.messageBg) vars[`--ovs-role-${prefix}-message-bg`] = role.messageBg;
    if (role.messageBorderColor) vars[`--ovs-role-${prefix}-message-border-color`] = role.messageBorderColor;
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
  });

  return { vars, rootFlags };
}

module.exports = {
  ROLE_KEYS,
  ROLE_CSS_PREFIX,
  DEFAULT_ROLE_STYLE_CONFIG,
  createRoleDefaults,
  normalizeRoleStyleConfig,
  mergeRoleStyleConfig,
  compileRoleStyleToCssVariables,
};