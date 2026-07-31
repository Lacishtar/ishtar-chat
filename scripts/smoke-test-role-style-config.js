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
assert(defaults.roles.superchat.showAmount === true, 'superchat showAmount default');
assert(defaults.roles.moderator.enabled === true, 'moderator enabled by default');
assert(defaults.roles.member.enabled === true, 'member enabled by default');
assert(defaults.roles.superchat.enabled === true, 'superchat enabled by default');

const merged = mergeRoleStyleConfig(defaults, {
  roles: {
    member: { enabled: true, authorColor: '#00ff00', badgeBefore: 'VIP', authorBg: '#123456', fontSize: 20 },
    superchat: { enabled: true, showAmount: false },
  },
});
assert(merged.roles.member.authorColor === '#00ff00', 'member color merged');
assert(merged.roles.member.badgeBefore === 'VIP', 'member badge merged');
assert(merged.roles.member.authorBg === '#123456', 'member authorBg merged');
assert(merged.roles.member.fontSize === 20, 'member fontSize merged');
assert(merged.roles.superchat.showAmount === false, 'superchat showAmount override');

const compiled = compileRoleStyleToCssVariables(merged);
assert(compiled.vars['--ovs-role-member-author-color'] === '#00ff00', 'member css var');
assert(compiled.vars['--ovs-role-member-message-font-size'] === '20px', 'member message font-size var');
assert(compiled.vars['--ovs-role-member-author-font-size'] === '18px', 'member author font-size var (0.9x)');
assert(compiled.vars['--ovs-role-member-badges-font-size'] === '13px', 'member badges font-size var (0.65x)');
assert(compiled.vars['--ovs-role-member-author-bg'] === '#123456', 'member authorBg css var');
assert(compiled.rootFlags['data-ovs-role-member-author-bg'] === 'true', 'member authorBg flag');
assert(compiled.vars['--ovs-role-member-badge-before-content'] === '"VIP"', 'member badge css');
assert(compiled.rootFlags['data-ovs-role-superchat-show-amount'] === 'false', 'superchat amount flag');
assert(
  compiled.rootFlags['data-ovs-role-superchat-author-bg'] === undefined,
  'superchat has no authorBg flag when unset',
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
      memberTiers: [{ id: 't1', minMonths: 6, color: '#ffd700', badge: '💎' }],
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
  'memberTiers badge compiles correctly',
);

console.log('[smoke:role-style] all checks passed');
