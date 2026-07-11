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
    ...overrides,
  };
}

const DEFAULT_ROLE_STYLE_CONFIG = {
  roles: {
    moderator: createRoleDefaults({
      authorColor: '#fca5a5',
      authorBorderColor: 'rgba(248, 113, 113, 0.7)',
      messageBg: 'linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(22, 25, 31, 0.72))',
      messageBorderColor: 'rgba(248, 113, 113, 0.45)',
      badgeBefore: 'MOD',
    }),
    member: createRoleDefaults({
      authorColor: '#93c5fd',
      authorBorderColor: 'rgba(96, 165, 250, 0.55)',
      messageBorderColor: 'rgba(96, 165, 250, 0.45)',
      badgeBefore: '★',
    }),
    superchat: createRoleDefaults({
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
  return {
    enabled: role.enabled !== false,
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
        : (typeof role.rowBgColor === 'string' ? role.rowBgColor : base.rowBg),
    rowBorderColor: typeof role.rowBorderColor === 'string' ? role.rowBorderColor : base.rowBorderColor,
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
  const mergeOne = (key) => ({
    ...b.roles[key],
    ...(o.roles?.[key] || {}),
  });
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

    if (roleKey === 'superchat' && role.showAmount === false) {
      rootFlags['data-ovs-role-superchat-show-amount'] = 'false';
    } else if (roleKey === 'superchat') {
      rootFlags['data-ovs-role-superchat-show-amount'] = 'true';
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
