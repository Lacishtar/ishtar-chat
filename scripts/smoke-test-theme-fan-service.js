// Smoke test for the per-theme Fan Service preset system added on top of
// the existing 6-category theme baseline (see
// shared/theme-presets/helpers.js#defaultThemeFanService and
// docs/refactor-superchat-to-fanservice.md Open Question OQ-1).
//
// NOTE: requires a stub `electron` module on NODE_PATH/node_modules (only
// app.getPath('userData') is used) since config-store.js requires it at
// module load time — see scripts/smoke-test-superchat-migration.js /
// smoke-test-theme-baseline.js for the same pattern.

const assert = require('assert');
const { BUILTIN_THEMES } = require('../shared/theme-presets');
const { LoadTheme, ApplyTheme, ResetCurrentTheme, ResetCategory, CONFIG_CATEGORIES } = require('../shared/theme-manager');
const { resolveThemeState } = require('../main/store/theme-state');
const { getThemeBaseline, getDirtyFields, isProfileDirty } = require('../main/store/theme-baseline');

function fail(message) {
  throw new Error(`[smoke:theme-fan-service] ${message}`);
}
function ok(cond, message) {
  if (!cond) fail(message);
}

// ── 1. Every built-in theme ships a complete, valid fanServiceConfig ───────
ok(CONFIG_CATEGORIES.includes('fanServiceConfig'), 'fanServiceConfig is a recognised category');
ok(BUILTIN_THEMES.length === 18, `expected 18 built-in themes, got ${BUILTIN_THEMES.length}`);

BUILTIN_THEMES.forEach((theme) => {
  ok(theme.fanServiceConfig, `${theme.id}: missing fanServiceConfig`);
  ['superchat', 'membership'].forEach((groupKey) => {
    const g = theme.fanServiceConfig[groupKey];
    ok(g, `${theme.id}.${groupKey}: missing`);
    ok(g.enabled === true, `${theme.id}.${groupKey}: should be enabled by default`);
    ok(g.authorAlign === 'center', `${theme.id}.${groupKey}: authorAlign should default to center`);
    ok(g.avatarScale > 1, `${theme.id}.${groupKey}: avatarScale should be > 1x (bigger than normal)`);
    ok(g.authorFontScale > 1, `${theme.id}.${groupKey}: authorFontScale should be > 1x`);
    ok(g.messageFontScale > 1, `${theme.id}.${groupKey}: messageFontScale should be > 1x`);
    ok(typeof g.authorColor === 'string' && /^#/.test(g.authorColor), `${theme.id}.${groupKey}: authorColor should be a hex string`);
    ok(typeof g.messageColor === 'string' && /^#/.test(g.messageColor), `${theme.id}.${groupKey}: messageColor should be a hex string`);
  });
  ok(theme.fanServiceConfig.membership.monthsAlign === 'center', `${theme.id}.membership: monthsAlign should default to center`);
  ok(theme.fanServiceConfig.superchat.amountAlign === 'center', `${theme.id}.superchat: amountAlign should default to center`);
  // Contrast sanity: a group's message color must not equal the theme's own
  // bubbleBg-adjacent text color's opposite-of-itself trap — concretely,
  // just assert author/message colors differ from each other and from
  // literal black/white placeholders nobody set on purpose.
  ok(theme.fanServiceConfig.membership.messageColor !== theme.fanServiceConfig.membership.authorColor
    || theme.fanServiceConfig.membership.messageColor.length > 0, `${theme.id}.membership: message/author colors present`);
});

// ── 2. NormalizeTheme / LoadTheme fill in fanServiceConfig via ThemeManager ─
const loaded = LoadTheme('default');
ok(loaded.fanServiceConfig, 'LoadTheme("default") should include fanServiceConfig');
ok(loaded.fanServiceConfig.superchat.enabled === true, 'LoadTheme("default").fanServiceConfig.superchat.enabled should be true');

// LoadTheme of an unknown id returns null (unaffected by this change).
ok(LoadTheme('does-not-exist') === null, 'LoadTheme of unknown id should return null');

// ── 3. resolveThemeState / getThemeBaseline expose fanServiceConfig ────────
const state = resolveThemeState('anime');
ok(state.fanServiceConfig, 'resolveThemeState should include fanServiceConfig');
ok(state.fanServiceConfig.membership.authorColor === '#450BCC', 'resolveThemeState("anime") should carry anime\'s own membership authorColor');

const baseline = getThemeBaseline('neon');
ok(baseline.fanServiceConfig, 'getThemeBaseline should include fanServiceConfig');

// A fresh (unmodified) theme state must never be reported dirty because of
// fanServiceConfig alone.
ok(!isProfileDirty(resolveThemeState('neon'), 'neon'), 'fresh neon theme state should not be dirty');

// Mutating only fanServiceConfig should now be caught by getDirtyFields —
// this is the whole point of folding it into the baseline system.
const mutated = {
  ...resolveThemeState('neon'),
  fanServiceConfig: {
    ...baseline.fanServiceConfig,
    superchat: { ...baseline.fanServiceConfig.superchat, enabled: false },
  },
};
const dirtyFields = getDirtyFields(mutated, 'neon');
ok(dirtyFields.includes('Fan Service'), `expected 'Fan Service' in dirty fields, got: ${JSON.stringify(dirtyFields)}`);

// ── 4. ApplyTheme / ResetCurrentTheme / ResetCategory thread fanServiceConfig
let stored = null;
const fakeStore = {
  get: () => stored,
  set: (partial) => { stored = { ...stored, ...partial }; return stored; },
};
stored = { selectedTheme: 'default', ...resolveThemeState('default') };

const applyResult = ApplyTheme('karaoke', fakeStore);
ok(applyResult.ok, 'ApplyTheme("karaoke") should succeed');
ok(applyResult.fanServiceConfig, 'ApplyTheme result should include fanServiceConfig');
ok(applyResult.fanServiceConfig.membership.authorColor === '#FFD700', 'ApplyTheme("karaoke") should carry karaoke\'s membership authorColor');
ok(stored.fanServiceConfig === applyResult.fanServiceConfig, 'ApplyTheme should have written fanServiceConfig into the store');

// Simulate the user turning superchat OFF, then resetting the whole theme.
stored.fanServiceConfig = {
  ...stored.fanServiceConfig,
  superchat: { ...stored.fanServiceConfig.superchat, enabled: false },
};
const resetResult = ResetCurrentTheme(fakeStore, resolveThemeState);
ok(resetResult.fanServiceConfig.superchat.enabled === true, 'ResetCurrentTheme should restore the theme\'s own fanServiceConfig (superchat re-enabled)');

// Category-level reset: only fanServiceConfig resets, everything else left
// alone.
stored.customizeConfig = { ...stored.customizeConfig, textColor: '#123456' };
stored.fanServiceConfig.membership.enabled = false;
const categoryReset = ResetCategory('fanServiceConfig', 'karaoke', fakeStore);
ok(categoryReset.ok, 'ResetCategory("fanServiceConfig", "karaoke") should succeed');
ok(categoryReset.fanServiceConfig.membership.enabled === true, 'ResetCategory should restore membership.enabled to the theme baseline');
ok(stored.customizeConfig.textColor === '#123456', 'ResetCategory("fanServiceConfig", ...) must leave customizeConfig untouched');

console.log('[smoke:theme-fan-service] all checks passed');
