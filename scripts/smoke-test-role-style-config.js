const {
  normalizeRoleStyleConfig,
  mergeRoleStyleConfig,
  compileRoleStyleToCssVariables,
} = require('../shared/role-style-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:role-style] ${message}`);
}

const defaults = normalizeRoleStyleConfig(null);
assert(defaults.roles.moderator.badgeBefore === 'MOD', 'moderator default badgeBefore');
assert(defaults.roles.moderator.enabled === true, 'moderator enabled by default');
assert(defaults.roles.member.enabled === true, 'member enabled by default');
assert(defaults.roles.superchat === undefined, 'Role is Identity-only — no roles.superchat anymore (see shared/fan-service-config.js)');

const merged = mergeRoleStyleConfig(defaults, {
  roles: {
    member: { enabled: true, authorColor: '#00ff00', badgeBefore: 'VIP', authorBg: '#123456', fontSize: 20 },
  },
});
assert(merged.roles.member.authorColor === '#00ff00', 'member color merged');
assert(merged.roles.member.badgeBefore === 'VIP', 'member badge merged');
assert(merged.roles.member.authorBg === '#123456', 'member authorBg merged');
assert(merged.roles.member.fontSize === 20, 'member fontSize merged');

const compiled = compileRoleStyleToCssVariables(merged);
assert(compiled.vars['--ovs-role-member-author-color'] === '#00ff00', 'member css var');
assert(compiled.vars['--ovs-role-member-message-font-size'] === '20px', 'member message font-size var');
assert(compiled.vars['--ovs-role-member-author-font-size'] === '18px', 'member author font-size var (0.9x)');
assert(compiled.vars['--ovs-role-member-author-bg'] === '#123456', 'member authorBg css var');
assert(compiled.rootFlags['data-ovs-role-member-author-bg'] === 'true', 'member authorBg flag');
assert(
  compiled.vars['--ovs-role-member-badge-before-content'] === undefined,
  'member role no longer compiles its own badge-before content (Mốc tháng is the only member badge mechanism)',
);
assert(
  compiled.vars['--ovs-role-member-badge-after-content'] === undefined,
  'member role no longer compiles its own badge-after content',
);
assert(
  compiled.rootFlags['data-ovs-role-superchat-show-amount'] === undefined,
  'compileRoleStyleToCssVariables no longer emits any superchat flags at all',
);
assert(
  compiled.vars['--ovs-role-superchat-amount-font-weight'] === undefined,
  'compileRoleStyleToCssVariables no longer emits any superchat vars at all',
);

const disabled = compileRoleStyleToCssVariables({
  roles: { moderator: { enabled: false } },
});
assert(disabled.rootFlags['data-ovs-role-mod-enabled'] === 'false', 'mod disabled flag');

// ── Member Tiers ────────────────────────────────────────────────────────────
// (Membership Event Emphasis — per-event color/badge/glow for Hội viên mới /
// Gia hạn / Tặng quà / Nhận quà — was removed entirely: no dashboard UI, no
// role-level glow either. Member Tiers below is the one member-only override
// mechanism left, and it still needs to compile correctly on its own.)
const withTiers = mergeRoleStyleConfig(defaults, {
  roles: {
    member: {
      enabled: true,
      memberTiers: [
        { id: 't1', minMonths: 6, color: '#ffd700', badgeBefore: '💎', badgeAfter: '♥' },
        // Legacy shape (pre-badgeBefore/After): singular `badge`, before-only.
        // normalizeMemberTierEntry() must still migrate this into badgeBefore
        // so configs saved before this change keep rendering correctly.
        { id: 't2', minMonths: 1, color: '#93c5fd', badge: '★' },
      ],
    },
  },
});
const tiersCompiled = compileRoleStyleToCssVariables(withTiers);
assert(
  tiersCompiled.vars['--ovs-role-member-tier-1-color'] === '#ffd700',
  'memberTiers compiles correctly',
);
assert(
  tiersCompiled.vars['--ovs-role-member-tier-1-badge-before-content'] === '"💎"',
  'memberTiers badgeBefore compiles correctly',
);
assert(
  tiersCompiled.vars['--ovs-role-member-tier-1-badge-after-content'] === '"♥"',
  'memberTiers badgeAfter compiles correctly',
);
assert(
  tiersCompiled.vars['--ovs-role-member-tier-2-badge-before-content'] === '"★"',
  'legacy tier `badge` field migrates into badgeBefore',
);

// Image-URL badge — auto-detected by quoteCssContent() and rendered as
// `content: url(...)` instead of quoted text. The host below isn't on
// image-url.js's ALLOWED_IMAGE_HOSTS allowlist, so toImageProxyUrl()
// returns '' and this falls back to the raw URL (same "best effort"
// fallback shared/customize-config.js uses for bubbleTextureUrl).
const withImageBadge = mergeRoleStyleConfig(defaults, {
  roles: {
    member: {
      enabled: true,
      memberTiers: [
        { id: 't1', minMonths: 12, color: '#a855f7', badgeBefore: 'https://example.com/badge.png' },
      ],
    },
  },
});
const imageBadgeCompiled = compileRoleStyleToCssVariables(withImageBadge);
assert(
  imageBadgeCompiled.vars['--ovs-role-member-tier-1-badge-before-content'] === 'url("https://example.com/badge.png")',
  'image URL tier badge compiles to CSS url(...) content',
);

console.log('[smoke:role-style] all checks passed');
