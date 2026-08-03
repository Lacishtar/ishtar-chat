// RoleStyleConfig — visual overrides for moderator and member messages.

const { quoteCssContent, isImageUrlValue, getBadgeImageSrc, FONT_WEIGHT_MAP } = require('./css-content-helpers');

const ROLE_KEYS = ['moderator', 'member'];

const ROLE_CSS_PREFIX = {
  moderator: 'mod',
  member: 'member',
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
    fontSize: null,
    authorFontWeight: null, // 'normal' | 'bold' | 'extrabold' or null = inherit theme weight
    messageBorderWidth: null,  // number (px) or null = inherit the global bubble border width
    textScale: null,   // number (e.g. 1.15) or null = no text scale change (1)
    memberTiers: [],
    // Master on/off switch for Mốc tháng — keeps the tier list intact while off.
    memberTiersEnabled: true,
    // "Dùng badge thật" — on by default, hiển thị song song với Mốc tháng
    // (xem shared/role-style-config.js).
    useRealBadge: true,
    packageNameEnabled: true,
    ...overrides,
  };
}

// one place Mốc tháng badges live now that the role-level badgeBefore/
// 'member' role (see compileRoleStyleToCssVariables' `roleKey === 'member'`
function normalizeMemberTierEntry(raw, index) {
  const t = raw || {};
  const minMonths = typeof t.minMonths === 'number' && Number.isFinite(t.minMonths) && t.minMonths >= 0
    ? t.minMonths
    : 0;
  const badgeBefore = t.badgeBefore !== undefined && t.badgeBefore !== null && String(t.badgeBefore).trim() !== ''
    ? String(t.badgeBefore)
    : (t.badge !== undefined && t.badge !== null && String(t.badge).trim() !== '' ? String(t.badge) : null);
  const badgeAfter = t.badgeAfter !== undefined && t.badgeAfter !== null && String(t.badgeAfter).trim() !== ''
    ? String(t.badgeAfter)
    : null;
  return {
    id: typeof t.id === 'string' && t.id ? t.id : `tier-${index}-${minMonths}`,
    minMonths,
    color: typeof t.color === 'string' && t.color ? t.color : null,
    badgeBefore,
    badgeAfter,
  };
}

function normalizeMemberTiers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t, i) => normalizeMemberTierEntry(t, i))
    .sort((a, b) => b.minMonths - a.minMonths);
}

function resolveMemberTier(memberTiers, months, enabled = true) {
  if (enabled === false) return null;
  const list = normalizeMemberTiers(memberTiers);
  if (!list.length) return null;
  const m = typeof months === 'number' && Number.isFinite(months) ? months : 0;
  const idx = list.findIndex((t) => m >= t.minMonths);
  if (idx === -1) return null;
  return { ...list[idx], index: idx + 1 };
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
      messageBg: 'rgba(30, 58, 95, 0.9)',
      messageBorderColor: 'rgba(96, 165, 250, 0.45)',
      // badge configures it per Mốc tháng tier instead (memberTiers).
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
    fontSize: typeof role.fontSize === 'number' && role.fontSize > 0 ? role.fontSize : base.fontSize,
    authorFontWeight: ['normal', 'bold', 'extrabold'].includes(role.authorFontWeight)
      ? role.authorFontWeight
      : base.authorFontWeight,
    messageBorderWidth:
      typeof role.messageBorderWidth === 'number' && role.messageBorderWidth >= 0
        ? role.messageBorderWidth
        : base.messageBorderWidth,
    textScale: typeof role.textScale === 'number' && role.textScale > 0 ? role.textScale : base.textScale,
    memberTiers: normalizeMemberTiers(role.memberTiers !== undefined ? role.memberTiers : base.memberTiers),
    memberTiersEnabled:
      typeof role.memberTiersEnabled === 'boolean' ? role.memberTiersEnabled : base.memberTiersEnabled !== false,
    useRealBadge:
      typeof role.useRealBadge === 'boolean' ? role.useRealBadge : base.useRealBadge === true,
    packageNameEnabled: true,
  };
}

function normalizeRoleStyleConfig(config) {
  const defaults = DEFAULT_ROLE_STYLE_CONFIG.roles;
  const roles = config?.roles || {};
  return {
    roles: {
      moderator: normalizeRole(roles.moderator, defaults.moderator),
      member: normalizeRole(roles.member, defaults.member),
    },
  };
}

function mergeRoleStyleConfig(base, overrides) {
  const b = normalizeRoleStyleConfig(base || DEFAULT_ROLE_STYLE_CONFIG);
  const o = overrides || {};
  const mergeOne = (key) => {
    const ov = o.roles?.[key] || {};
    const merged = { ...b.roles[key], ...ov };
    merged.rowBg = null;
    merged.rowBorderColor = null;
    return merged;
  };
  return normalizeRoleStyleConfig({
    roles: {
      moderator: mergeOne('moderator'),
      member: mergeOne('member'),
    },
  });
}

// (moderator badge, Mốc tháng member-tier badges). shared/fan-service-config.js

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
    if (role.messageBg) vars[`--ovs-role-${prefix}-message-bg`] = role.messageBg;
    if (role.messageBorderColor) vars[`--ovs-role-${prefix}-message-border-color`] = role.messageBorderColor;

    if (role.authorBorderColor) vars[`--ovs-role-${prefix}-author-border-color`] = role.authorBorderColor;
    if (role.authorBg) {
      vars[`--ovs-role-${prefix}-author-bg`] = role.authorBg;
      rootFlags[`data-ovs-role-${prefix}-author-bg`] = 'true';
    }
    if (role.messageTextColor) vars[`--ovs-role-${prefix}-message-text-color`] = role.messageTextColor;
    if (role.rowBg) vars[`--ovs-role-${prefix}-row-bg`] = role.rowBg;
    if (role.rowBorderColor) vars[`--ovs-role-${prefix}-row-border-color`] = role.rowBorderColor;
    if (role.earColor) vars[`--ovs-role-${prefix}-ear-color`] = role.earColor;

    // Role-level badgeBefore/badgeAfter ("Badge & chữ") — moderator only
    // now. The 'member' role no longer has its own badge here: Mốc tháng
    if (roleKey !== 'member') {
      vars[`--ovs-role-${prefix}-badge-before-content`] = quoteCssContent(role.badgeBefore);
      vars[`--ovs-role-${prefix}-badge-after-content`] = quoteCssContent(role.badgeAfter);
    }

    if (typeof role.fontSize === 'number' && role.fontSize > 0) {
      vars[`--ovs-role-${prefix}-message-font-size`] = `${role.fontSize}px`;
      vars[`--ovs-role-${prefix}-author-font-size`] = `${Math.round(role.fontSize * 0.9)}px`;
    }

    // Name — Font Weight
    if (role.authorFontWeight) {
      vars[`--ovs-role-${prefix}-author-font-weight`] = FONT_WEIGHT_MAP[role.authorFontWeight] || '700';
    }

    // Bubble — Border Width
    if (typeof role.messageBorderWidth === 'number') {
      vars[`--ovs-role-${prefix}-message-border-width`] = `${role.messageBorderWidth}px`;
    }

    // Emphasis — Text Scale.
    if (typeof role.textScale === 'number' && role.textScale > 0) {
      vars[`--ovs-role-${prefix}-text-scale`] = String(role.textScale);
    }

    if (roleKey === 'member') {
      const tiers = Array.isArray(role.memberTiers) ? role.memberTiers : [];
      tiers.forEach((tier, idx) => {
        const n = idx + 1;
        if (tier.color) vars[`--ovs-role-member-tier-${n}-color`] = tier.color;
        vars[`--ovs-role-member-tier-${n}-badge-before-content`] = quoteCssContent(tier.badgeBefore);
        vars[`--ovs-role-member-tier-${n}-badge-after-content`] = quoteCssContent(tier.badgeAfter);
      });
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
  normalizeMemberTiers,
  resolveMemberTier,
};