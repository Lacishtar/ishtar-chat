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
assert(defaults.roles.moderator.enabled === false, 'moderator disabled by default');
assert(defaults.roles.member.enabled === false, 'member disabled by default');
assert(defaults.roles.superchat.enabled === false, 'superchat disabled by default');

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

console.log('[smoke:role-style] all checks passed');
