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
    // Name — Font Weight (Appearance). authorColor already covers Name Color.
    authorFontWeight: null, // 'normal' | 'bold' | 'extrabold' or null = inherit theme weight
    // Bubble — extra shape controls (Appearance). Background Color/Border
    // Color are messageBg/messageBorderColor above; this rounds out the
    // same "Bubble" group with width.
    messageBorderWidth: null,  // number (px) or null = inherit the global bubble border width
    // Emphasis — Text Scale. Independent of memberTiers below, which is a
    // per-item override layered on top of this role-level baseline.
    textScale: null,   // number (e.g. 1.15) or null = no text scale change (1)
    // Member Tiers — same shape/resolution model as SUPERCHAT_TIER_TABLE
    // (shared/chat-message.js), just keyed by minMonths instead of minUsd.
    // Only meaningful for the 'member' role today, but lives here (not in a
    // member-only defaults factory) since createRoleDefaults() is the one
    // shape every role normalizes through — keeps normalizeRole() the
    // single place that knows how to validate/sort this array, instead of
    // duplicating that logic in a second per-role normalizer the way
    // superchat's tier table (a fixed constant, not user-edited) never
    // needed to.
    memberTiers: [],
    // Master on/off switch for the Mốc tháng (memberTiers) feature. Lets
    // the streamer disable tier-based coloring without losing their
    // configured tier list — resolveMemberTier() below returns null
    // whenever this is false, same "keep the data, skip the effect"
    // pattern createSuperchatDefaults' useTierColor already uses for Super
    // Chat. Only meaningful for 'member', same caveat as memberTiers above.
    memberTiersEnabled: true,
    // Stand-out layout for membership_milestone rows (the renewal
    // notification), scoped to just that one event type instead of every
    // message from the role, since a milestone notification is a one-off
    // event rather than an ongoing chat style. Same three options as Super
    // Chat's superchatLayout — 'bubble' (default, renders like a normal
    // member message), 'highlight' (still a bubble, but pushed to stand
    // out with a glowing border/shadow + slight scale — see
    // compileRoleStyleToCssVariables/role-styles.css), or 'youtube'
    // (two-tier card: solid tier-color header + tinted body, same visual
    // language as Super Chat's 'youtube' layout). Only meaningful for
    // 'member', same caveat as memberTiers above.
    milestoneLayout: 'bubble', // 'bubble' | 'highlight' | 'youtube'
    // Milestone Text — a line always rendered for a member's registration/
    // renewal events (see MEMBER_MILESTONE_EVENT_TYPES below), independent
    // of whatever text YouTube itself attached to that event (which is
    // often empty — a plain "member for N months" system event has no
    // author-written message body at all). `{months}` in the template is
    // replaced with the resolved number (see formatMilestoneText()).
    // null = use DEFAULT_MEMBER_MILESTONE_TEXT. Only meaningful for
    // 'member', same caveat as memberTiers/milestoneLayout above.
    milestoneText: null,
    // Master on/off switch, same "keep the data, skip the effect" pattern
    // as memberTiersEnabled/useTierColor above.
    milestoneTextEnabled: true,
    ...overrides,
  };
}

// Events where a member's own months-of-membership figure is meaningful
// to show regardless of the event's own (often empty) message text: a
// brand-new sub, a renewal milestone notification, or a gifted membership
// being redeemed. Deliberately excludes 'membership_gift_sent' (that
// event is about the GIFTER, whose own memberMonths isn't what's being
// celebrated) and plain chat/superchat/sticker events (those already have
// real message content and showing this on every chat line from a member
// would be noise, not signal).
const MEMBER_MILESTONE_EVENT_TYPES = new Set([
  'membership_new',
  'membership_milestone',
  'membership_gift_received',
]);

const DEFAULT_MEMBER_MILESTONE_TEXT = 'đã hỗ trợ trong {months} tháng qua!!';

// Replaces every `{months}` placeholder in a user-authored template with
// the resolved months value. Returns '' for a blank/whitespace-only
// template so callers can treat that the same as "nothing to show".
function formatMilestoneText(template, months) {
  const t = typeof template === 'string' ? template : '';
  if (!t.trim()) return '';
  const m = typeof months === 'number' && Number.isFinite(months) ? months : 0;
  return t.replace(/\{months\}/g, String(m));
}

// One member tier entry: { id, minMonths, color, badge }. Mirrors
// SUPERCHAT_TIER_TABLE's { tier, minUsd, color, ... } shape/spirit, but
// minMonths/color/badge are user-authored (via RoleStylesPanel) rather than
// a fixed constant table, so — unlike SUPERCHAT_TIER_TABLE — this needs a
// normalizer instead of being hand-written once.
function normalizeMemberTierEntry(raw, index) {
  const t = raw || {};
  const minMonths = typeof t.minMonths === 'number' && Number.isFinite(t.minMonths) && t.minMonths >= 0
    ? t.minMonths
    : 0;
  return {
    id: typeof t.id === 'string' && t.id ? t.id : `tier-${index}-${minMonths}`,
    minMonths,
    color: typeof t.color === 'string' && t.color ? t.color : null,
    badge: t.badge !== undefined && t.badge !== null && String(t.badge).trim() !== ''
      ? String(t.badge)
      : null,
  };
}

// Sorted highest-minMonths-first — same ordering SUPERCHAT_TIER_TABLE is
// hand-written in, which is what lets resolveMemberTier() below reuse the
// exact same "first entry the value qualifies for wins" find() pattern as
// deriveSuperchatTierInfo() (shared/chat-message.js).
function normalizeMemberTiers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t, i) => normalizeMemberTierEntry(t, i))
    .sort((a, b) => b.minMonths - a.minMonths);
}

// The one place "which member tier applies to N months" is decided —
// reused by both compileRoleStyleToCssVariables() (below) and the overlay
// (message-renderer.js / bubble-updater.js), so there is exactly one
// resolution algorithm, not one per call site. Callers on the overlay side
// pass the months value straight from rowEl.dataset.ovsMemberMonths
// (already parsed once in shared/chat-message.js#deriveMemberMonths) —
// this function never re-parses badge text again.
//
// `enabled` mirrors role.memberTiersEnabled — when false, this returns
// null unconditionally (same as "no tiers configured") without the caller
// needing to duplicate that check, so the master on/off switch only has
// one place it's actually enforced.
function resolveMemberTier(memberTiers, months, enabled = true) {
  if (enabled === false) return null;
  const list = normalizeMemberTiers(memberTiers);
  if (!list.length) return null;
  const m = typeof months === 'number' && Number.isFinite(months) ? months : 0;
  const idx = list.findIndex((t) => m >= t.minMonths);
  if (idx === -1) return null;
  // `index` (1-based) lines up with the "-N" suffix compileRoleStyleToCssVariables
  // uses for --ovs-role-member-tier-N-* vars and the overlay uses for the
  // ovs-member-tier-N class, since both iterate this same normalized/sorted order.
  return { ...list[idx], index: idx + 1 };
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
    superchatLayout: 'bubble', // 'bubble' | 'youtube'
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
      messageBg: 'rgba(30, 58, 95, 0.9)',
      messageBorderColor: 'rgba(96, 165, 250, 0.45)',
      badgeBefore: '★',
      milestoneText: DEFAULT_MEMBER_MILESTONE_TEXT,
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
    // Accept the picker value directly ('bubble' | 'highlight' |
    // 'youtube'); migrate any config saved before this became a picker
    // (role.milestoneBannerEnabled: boolean) so existing "on" configs land
    // on 'youtube' (the only stand-out style that existed at the time)
    // instead of silently reverting to the plain 'bubble' look.
    milestoneLayout: ['bubble', 'highlight', 'youtube'].includes(role.milestoneLayout)
      ? role.milestoneLayout
      : (typeof role.milestoneBannerEnabled === 'boolean'
          ? (role.milestoneBannerEnabled ? 'youtube' : 'bubble')
          : (['bubble', 'highlight', 'youtube'].includes(base.milestoneLayout) ? base.milestoneLayout : 'bubble')),
    milestoneText: typeof role.milestoneText === 'string' ? role.milestoneText : base.milestoneText,
    milestoneTextEnabled:
      typeof role.milestoneTextEnabled === 'boolean' ? role.milestoneTextEnabled : base.milestoneTextEnabled !== false,
  };
}

function normalizeSuperchatRole(raw, fallback) {
  const baseShape = normalizeRole(raw, fallback);
  const role = raw || {};
  const base = fallback || createSuperchatDefaults();

  return {
    ...baseShape,
    useTierColor: typeof role.useTierColor === 'boolean' ? role.useTierColor : (base.useTierColor !== false),
    // 'banner' was removed as a selectable layout — it migrates to
    // 'youtube' (the closest surviving "stand out" option) instead of
    // silently dropping to the plain 'bubble' look. 'highlight' ("Bubble
    // nổi bật") was re-added alongside 'bubble'/'youtube' — still a bubble
    // shape, but with a glowing border/shadow + slight scale (see
    // compileRoleStyleToCssVariables/role-styles.css) instead of the
    // 'youtube' layout's full two-tier card rebuild.
    superchatLayout: role.superchatLayout === 'banner'
      ? 'youtube'
      : (['bubble', 'highlight', 'youtube'].includes(role.superchatLayout)
          ? role.superchatLayout
          : (['bubble', 'highlight', 'youtube'].includes(base.superchatLayout) ? base.superchatLayout : 'bubble')),
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

// Shared by both Name Font Weight (authorFontWeight, every role) and Super
// Chat's amount Font Weight (amountFontWeight) — same three options, same
// numeric mapping, so there's exactly one place this ever gets defined.
const FONT_WEIGHT_MAP = {
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

      // Layout: 'bubble' (default), 'highlight' (glowing bubble — see
      // role-styles.css), or 'youtube' (mirrors YouTube's own card).
      // 'banner' was removed as a selectable layout — see the migration
      // note in normalizeSuperchatRole() above.
      rootFlags['data-ovs-role-superchat-layout'] =
        role.superchatLayout === 'youtube' || role.superchatLayout === 'highlight'
          ? role.superchatLayout
          : 'bubble';

      // Amount position: inline (default) or block
      rootFlags['data-ovs-role-superchat-amount-position'] =
        role.amountPosition === 'block' ? 'block' : 'inline';

      // useTierColor: when false, user's manual colors take precedence over tier vars
      rootFlags['data-ovs-role-superchat-use-tier-color'] =
        role.useTierColor === false ? 'false' : 'true';
    }

    if (roleKey === 'member') {
      // Renewal ("Gia hạn") stand-out layout — 'bubble' (default) or
      // 'youtube'. Read regardless of `enabled` below being false isn't
      // needed here since the CSS selector for this flag is itself gated
      // on data-ovs-role-member-enabled='true'; setting it unconditionally
      // just avoids leaving the attribute unset (which would otherwise
      // read as neither value to an [attr='...'] selector, same "always
      // emit" pattern the superchat flags above and the enabled flag
      // itself already follow).
      rootFlags['data-ovs-role-member-milestone-layout'] =
        role.milestoneLayout === 'youtube' || role.milestoneLayout === 'highlight'
          ? role.milestoneLayout
          : 'bubble';
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

    // Member Tiers — one --ovs-role-member-tier-N-* var pair per configured
    // tier (role.memberTiers is already normalized+sorted, highest
    // minMonths first, by normalizeRole() above). These are reference vars
    // only, generated purely from config; WHICH tier applies to a given
    // message is a per-row decision the overlay makes via
    // resolveMemberTier(role.memberTiers, rowEl.dataset.ovsMemberMonths) —
    // same helper this function's normalization path feeds into — never by
    // re-parsing the member badge text again.
    if (roleKey === 'member') {
      const tiers = Array.isArray(role.memberTiers) ? role.memberTiers : [];
      tiers.forEach((tier, idx) => {
        const n = idx + 1;
        if (tier.color) vars[`--ovs-role-member-tier-${n}-color`] = tier.color;
        vars[`--ovs-role-member-tier-${n}-badge-before-content`] = quoteCssContent(tier.badge);
      });
    }

    // Superchat-specific amount styling
    if (roleKey === 'superchat') {
      const amountSize = role.amountFontSize || role.fontSize;
      if (typeof amountSize === 'number' && amountSize > 0) {
        vars[`--ovs-role-superchat-amount-font-size`] = `${amountSize}px`;
      }
      const weightValue = FONT_WEIGHT_MAP[role.amountFontWeight] || '700';
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
  normalizeMemberTiers,
  resolveMemberTier,
  quoteCssContent,
  MEMBER_MILESTONE_EVENT_TYPES,
  DEFAULT_MEMBER_MILESTONE_TEXT,
  formatMilestoneText,
};