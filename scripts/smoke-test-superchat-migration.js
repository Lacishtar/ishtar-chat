const { migrateSuperchatRoleIntoFanService } = require('../main/store/config-store');
const { DEFAULT_FAN_SERVICE_CONFIG, mergeFanServiceConfig } = require('../shared/fan-service-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:superchat-migration] ${message}`);
}

const baseFanService = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, undefined);

// ── 1. No legacy roles.superchat at all — nothing to migrate ────────────────
const noLegacy = migrateSuperchatRoleIntoFanService(
  { roles: { moderator: {}, member: {} } },
  baseFanService,
);
assert(noLegacy === baseFanService, 'no legacy superchat key -> fanServiceConfig returned untouched');

// ── 2. Legacy roles.superchat present but enabled: false — user never
//      actually customized it, nothing to migrate ─────────────────────────
const legacyOff = migrateSuperchatRoleIntoFanService(
  { roles: { superchat: { enabled: false, authorColor: '#ff0000' } } },
  baseFanService,
);
assert(legacyOff === baseFanService, 'legacy superchat.enabled === false -> fanServiceConfig returned untouched');

const legacyOn = migrateSuperchatRoleIntoFanService(
  {
    roles: {
      superchat: {
        enabled: true,
        useTierColor: true,
        badgeBefore: '✦',
        badgeAfter: null,
        showAmount: true,
        amountPosition: 'block',
        amountFontSize: 24, // absolute px -> should become amountFontScale 24/16 = 1.5
        amountFontWeight: 'extrabold',
      },
    },
  },
  baseFanService,
);
assert(legacyOn.superchat.enabled === true, 'migration turns Fan Service superchat on');
assert(legacyOn.superchat.useTierColor === true, 'useTierColor carried over');
assert(legacyOn.superchat.badgeBefore === '✦', 'badgeBefore carried over');
assert(legacyOn.superchat.showAmount === true, 'showAmount carried over');
assert(legacyOn.superchat.amountPosition === 'block', 'amountPosition carried over');
assert(legacyOn.superchat.amountFontScale === 1.5, 'amountFontSize(24px) converted to amountFontScale (24/16=1.5)');
assert(legacyOn.superchat.amountFontWeight === 'extrabold', 'amountFontWeight carried over');
// membership group untouched by this migration
assert(legacyOn.membership === baseFanService.membership, 'membership group untouched by superchat migration');

// ── 4. Legacy roles.superchat enabled, useTierColor: false — manual colors
//      carried into Fan Service's authorColor/messageColor ─────────────────
const legacyManual = migrateSuperchatRoleIntoFanService(
  {
    roles: {
      superchat: {
        enabled: true,
        useTierColor: false,
        authorColor: '#abcdef',
        messageTextColor: '#123456',
      },
    },
  },
  baseFanService,
);
assert(legacyManual.superchat.useTierColor === false, 'useTierColor: false carried over');
assert(legacyManual.superchat.authorColor === '#abcdef', 'manual authorColor carried over');
assert(legacyManual.superchat.messageColor === '#123456', 'legacy messageTextColor -> Fan Service messageColor');

// ── 5. Fan Service superchat already enabled — legacy Role data must NOT
//      clobber a deliberate Fan Service choice ─────────────────────────────
const fsAlreadyOn = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, badgeBefore: 'KEEP-ME' },
});
const noClobber = migrateSuperchatRoleIntoFanService(
  { roles: { superchat: { enabled: true, badgeBefore: 'LEGACY-SHOULD-NOT-WIN' } } },
  fsAlreadyOn,
);
assert(noClobber === fsAlreadyOn, 'Fan Service already enabled -> migration is a no-op, does not clobber');
assert(noClobber.superchat.badgeBefore === 'KEEP-ME', 'existing Fan Service badge preserved, not overwritten by legacy');

console.log('[smoke:superchat-migration] all checks passed');
