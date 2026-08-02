/**
 * RoleStyleConfig — visual overrides for moderator and member messages.
 * Compiled to --ovs-role-* CSS variables on :root.
 *
 * Role is Identity-only after the Super Chat -> Fan Service refactor: it no
 * longer knows anything about Super Chat. All Super Chat styling (tier
 * color, badge, amount display) now lives in shared/fan-service-config.js's
 * `superchat` group — see that file's header comment and
 * docs/refactor-superchat-to-fanservice.md for the full design.
 */

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
    // Each tier carries its own badgeBefore/badgeAfter (text/emoji or an
    // image URL — see quoteCssContent below) — this is the only badge
    // mechanism the 'member' role has; there is no separate role-level
    // badge outside of a Mốc tháng tier (see the `roleKey !== 'member'`
    // guard in compileRoleStyleToCssVariables). Only meaningful for the
    // 'member' role today, but lives here (not in a member-only defaults
    // factory) since createRoleDefaults() is the one shape every role
    // normalizes through — keeps normalizeRole() the single place that
    // knows how to validate/sort this array, instead of duplicating that
    // logic in a second per-role normalizer the way superchat's tier table
    // (a fixed constant, not user-edited) never needed to.
    memberTiers: [],
    // Master on/off switch for the Mốc tháng (memberTiers) feature. Lets
    // the streamer disable tier-based coloring without losing their
    // configured tier list — resolveMemberTier() below returns null
    // whenever this is false, same "keep the data, skip the effect"
    // pattern createSuperchatDefaults' useTierColor already uses for Super
    // Chat. Only meaningful for 'member', same caveat as memberTiers above.
    memberTiersEnabled: true,
    // "Dùng badge thật" — when on, the overlay shows YouTube's own captured
    // member-loyalty badge icon (ChatMessage.badgeIconUrl, captured by
    // main/capture-preload.js) ALONGSIDE the custom Mốc tháng badge above,
    // not instead of it — both render at once (see applyRealBadgeImage(),
    // overlay/modules/message-renderer.js). Off by default: most streamers
    // set this up specifically to replace YouTube's plain badge with their
    // own art, so showing YouTube's badge too should be an opt-in extra,
    // not a surprise default. Only meaningful for 'member', same caveat as
    // memberTiers above.
    useRealBadge: false,
    // Package/Tier Name — shows YouTube's own per-channel membership tier
    // tagline / new-member greeting (read from '#header-subtext' — see
    // membershipTierName on ChatMessage, shared/chat-message.js). This is
    // real YouTube content, shown verbatim whenever the captured event
    // carried one — not a user-authored template (that mechanism was
    // removed: YouTube's own '#header-subtext' text turned out to already
    // cover the "no message body" case on its own — see the "Chào mừng
    // bạn đến với..." new-member greeting example — so a separate
    // app-fabricated "đã hỗ trợ trong N tháng qua!!" line was redundant
    // and, worse, could show alongside/instead of real YouTube copy).
    // Always rendered now — the toggle that used to gate this line was
    // removed, so this field is kept only so old persisted shapes/callers
    // that still reference role.packageNameEnabled keep working; it is
    // always normalized to true (see normalizeRole below), no user-facing
    // switch exists to turn it off any more.
    // Only meaningful for 'member', same caveat as memberTiers above.
    packageNameEnabled: true,
    ...overrides,
  };
}

// One member tier entry: { id, minMonths, color, badgeBefore, badgeAfter }.
// Mirrors SUPERCHAT_TIER_TABLE's { tier, minUsd, color, ... } shape/spirit,
// but minMonths/color/badgeBefore/badgeAfter are user-authored (via
// RoleStylesPanel) rather than a fixed constant table, so — unlike
// SUPERCHAT_TIER_TABLE — this needs a normalizer instead of being
// hand-written once.
//
// badgeBefore/badgeAfter each accept either plain text/emoji (rendered as
// CSS `content: "..."`) or an image URL (rendered as CSS `content:
// url(...)`, auto-detected by compileBadgeContent() below) — this is the
// one place Mốc tháng badges live now that the role-level badgeBefore/
// badgeAfter fields (createRoleDefaults) are no longer used for the
// 'member' role (see compileRoleStyleToCssVariables' `roleKey === 'member'`
// skip below). `badge` (singular, before-only) was the old shape before
// after-name badges existed here — still accepted on read so configs saved
// before this change keep working, migrated into badgeBefore.
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
      // No badgeBefore/badgeAfter default — the 'member' role no longer
      // has its own role-level badge (see compileRoleStyleToCssVariables'
      // `roleKey !== 'member'` guard above); a streamer who wants a member
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
    // Package/Tier Name is always shown now — there is no user-facing
    // on/off switch for it any more (see createRoleDefaults' comment on
    // packageNameEnabled above), so normalization always forces this to
    // true regardless of what a legacy config.json may have persisted.
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
    },
  });
}

// A badge value is treated as an image URL (rendered via CSS `content:
// url(...)`, same replaced-element technique shared/customize-config.js
// already uses for bubbleTextureUrl) whenever it looks like an http(s)
// link; anything else (emoji, plain text like "VIP") stays a quoted text
// content string. This is deliberately a cheap prefix check, not a strict
// URL parse — badge fields are free-text inputs, not always well-formed
// URLs, and the cost of a false positive here (an oddly-typed non-URL
// string starting with "http" rendering as a broken image) is low compared
// to rejecting a valid-but-unusual image URL.
//
// isImageUrlValue/quoteCssContent/getBadgeImageSrc/FONT_WEIGHT_MAP used to
// live here; they're now in shared/css-content-helpers.js (imported at the
// top of this file), used internally below for Role's own badge fields
// (moderator badge, Mốc tháng member-tier badges). shared/fan-service-config.js
// imports the same helpers directly from css-content-helpers.js too, for
// Super Chat's badge/amount styling — neither module imports these from the
// other, so Role stays fully independent of Fan Service and vice versa.
// Overlay consumers (message-renderer.js, bubble-updater.js) also import
// these directly from css-content-helpers.mjs now, not re-exported through
// this file, so this module's own require() above is purely an
// implementation detail, not part of Role's public API.

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
    // (memberTiers, below) is the only badge mechanism for members now, so
    // there is exactly one place a member's badge comes from instead of a
    // "flat badge that a tier badge silently overrides" pair of
    // mechanisms. role.badgeBefore/badgeAfter may still be present on an
    // old saved 'member' config (normalizeRole still accepts them, for
    // forward/backward config compatibility) — they're simply never read
    // here, so they have no visual effect for members. Super Chat's badge
    // is gone from this function entirely — see
    // shared/fan-service-config.js's `superchat` group.
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