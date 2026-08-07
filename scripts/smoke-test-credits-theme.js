// Smoke test for Credits scene theme presets (shared/credits-theme-presets.js
// + the themeId get/set/persist surface on CreditsManager). Run with:
//   node scripts/smoke-test-credits-theme.js

const assert = require('assert');
const { CreditsManager } = require('../main/credits-manager');
const { CREDITS_THEME_PRESETS, DEFAULT_CREDITS_THEME_ID, getCreditsThemeById } = require('../shared/credits-theme-presets');

function fakeCaptureManager() {
  return { fetchLeaderboard: async () => ({ ok: true, items: [] }) };
}

// Every preset must be well-formed enough for the overlay client to consume:
// an id/name, a Google Fonts href, and a non-empty vars map whose keys are
// exactly the custom properties overlay/credits.html declares defaults for.
const REQUIRED_VAR_KEYS = [
  '--ovs-credits-font',
  '--ovs-credits-font-mono',
  '--ovs-credits-row-bg',
  '--ovs-credits-row-radius',
  '--ovs-credits-row-border',
  '--ovs-credits-row-blur',
  '--ovs-credits-title-color',
  '--ovs-credits-header-shadow',
  '--ovs-credits-accent-from',
  '--ovs-credits-accent-to',
  '--ovs-credits-name-color',
  '--ovs-credits-name-shadow',
  '--ovs-credits-badge-color',
  '--ovs-credits-rank-color',
  '--ovs-credits-score-color',
  '--ovs-credits-avatar-border',
  '--ovs-credits-avatar-fallback-bg',
];

CREDITS_THEME_PRESETS.forEach((theme) => {
  assert.ok(theme.id && typeof theme.id === 'string', 'theme must have a string id');
  assert.ok(theme.name, `theme "${theme.id}" must have a name`);
  assert.ok(/^https:\/\/fonts\.googleapis\.com\/css2\?/.test(theme.googleFontHref), `theme "${theme.id}" must use a fonts.googleapis.com css2 URL`);
  assert.ok(Array.isArray(theme.swatch) && theme.swatch.length >= 2, `theme "${theme.id}" must have a swatch array`);
  REQUIRED_VAR_KEYS.forEach((key) => {
    assert.ok(key in theme.vars, `theme "${theme.id}" is missing CSS var "${key}"`);
  });
});

// No duplicate ids.
const ids = CREDITS_THEME_PRESETS.map((t) => t.id);
assert.strictEqual(new Set(ids).size, ids.length, 'theme ids must be unique');

// getCreditsThemeById
assert.strictEqual(getCreditsThemeById('default').id, 'default');
assert.strictEqual(getCreditsThemeById('not-a-real-id'), null);

// CreditsManager defaults + get/set + invalid-id rejection.
const cm = new CreditsManager(fakeCaptureManager());
assert.strictEqual(cm.getThemeId(), DEFAULT_CREDITS_THEME_ID, 'CreditsManager should default to the default theme');
assert.strictEqual(cm.listThemes().length, CREDITS_THEME_PRESETS.length, 'listThemes() should list every built-in preset');

assert.strictEqual(cm.setThemeId('gold-cinematic'), 'gold-cinematic', 'setThemeId() should apply a valid id');
assert.strictEqual(cm.getTheme().id, 'gold-cinematic', 'getTheme() should reflect the applied id');

assert.strictEqual(cm.setThemeId('not-a-real-id'), 'gold-cinematic', 'setThemeId() must ignore an unknown id and keep the previous one');

// Constructor-time themeId option: valid id honored, invalid id falls back.
const cmWithValidOption = new CreditsManager(fakeCaptureManager(), { themeId: 'neon-night' });
assert.strictEqual(cmWithValidOption.getThemeId(), 'neon-night');

const cmWithInvalidOption = new CreditsManager(fakeCaptureManager(), { themeId: 'not-a-real-id' });
assert.strictEqual(cmWithInvalidOption.getThemeId(), DEFAULT_CREDITS_THEME_ID);

console.log('[smoke:credits-theme] all assertions passed ✔');
