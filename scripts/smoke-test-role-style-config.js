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

const merged = mergeRoleStyleConfig(defaults, {
  roles: {
    member: { authorColor: '#00ff00', badgeBefore: 'VIP' },
    superchat: { showAmount: false },
  },
});
assert(merged.roles.member.authorColor === '#00ff00', 'member color merged');
assert(merged.roles.member.badgeBefore === 'VIP', 'member badge merged');
assert(merged.roles.superchat.showAmount === false, 'superchat showAmount override');

const compiled = compileRoleStyleToCssVariables(merged);
assert(compiled.vars['--ovs-role-member-author-color'] === '#00ff00', 'member css var');
assert(compiled.vars['--ovs-role-member-badge-before-content'] === '"VIP"', 'member badge css');
assert(compiled.rootFlags['data-ovs-role-superchat-show-amount'] === 'false', 'superchat amount flag');

const disabled = compileRoleStyleToCssVariables({
  roles: { moderator: { enabled: false } },
});
assert(disabled.rootFlags['data-ovs-role-mod-enabled'] === 'false', 'mod disabled flag');

console.log('[smoke:role-style] all checks passed');
