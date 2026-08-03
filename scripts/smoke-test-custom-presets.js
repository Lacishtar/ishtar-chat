// Verifies CustomPresetsStore correctly round-trips fanServiceConfig
// (Fan Service / Super Chat + Membership overrides, incl. custom text
// colors) end to end — this was previously dropped silently because
// CONFIG_CATEGORIES omitted it entirely. Also verifies backward
// compatibility: preset files exported before fanServiceConfig existed
// must still pass import validation, and overwriting a preset that HAS
// fanServiceConfig with a snapshot/import that lacks it must not wipe it.

const path = require('path');
const os = require('os');
const fs = require('fs');

// ── Minimal electron mock so custom-presets-store.js can be required
//    standalone (it only needs app.getPath('userData')). ──────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-preset-smoke-'));
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: { app: { getPath: () => tmpDir } },
};

const { CustomPresetsStore, validateImportedPresets } = require('../main/store/custom-presets-store');

function fail(message) {
  throw new Error(`[smoke:custom-presets] ${message}`);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

const REQUIRED = {
  customizeConfig: { a: 1 },
  layoutConfig: { a: 1 },
  slotStyleConfig: { a: 1 },
  animationConfig: { a: 1 },
  decorationConfig: { a: 1 },
  roleStyleConfig: { a: 1 },
};

// ── 1. fanServiceConfig round-trips through save() + get() ────────────────
const store = new CustomPresetsStore();
const fanServiceConfig = {
  superchat: { authorColor: '#ff00ff', messageColor: '#00ffcc' },
  membership: { authorColor: '#123456' },
};

const listAfterSave = store.save('My Preset', { ...REQUIRED, fanServiceConfig });
assert(Array.isArray(listAfterSave), 'save() returns list');

const savedId = store.list().find((p) => p.name === 'My Preset')?.id;
assert(savedId, 'preset was saved');

const full = store.get(savedId);
assert(full.fanServiceConfig?.superchat?.authorColor === '#ff00ff', 'fanServiceConfig.superchat.authorColor persisted');
assert(full.fanServiceConfig?.membership?.authorColor === '#123456', 'fanServiceConfig.membership.authorColor persisted');

// ── 2. Overwriting with a snapshot that lacks fanServiceConfig must NOT
//    wipe the previously saved value (e.g. a caller built before the
//    dashboard fix, or any future partial-save path). ─────────────────────
store.save('My Preset', { ...REQUIRED });
const afterPartialSave = store.get(savedId);
assert(
  afterPartialSave.fanServiceConfig?.superchat?.authorColor === '#ff00ff',
  'existing fanServiceConfig NOT wiped when overwritten with a snapshot missing it',
);

// ── 3. Old exported preset files (from before fanServiceConfig existed)
//    must still pass import validation — fanServiceConfig is optional. ────
const legacyPayload = {
  presets: [{ name: 'Legacy Preset', ...REQUIRED }], // no fanServiceConfig key at all
};
const { valid, errors, presets } = validateImportedPresets(legacyPayload);
assert(valid, `legacy preset (no fanServiceConfig) should still validate — errors: ${JSON.stringify(errors)}`);
assert(presets.length === 1, 'legacy preset accepted');

// ── 4. Importing that legacy preset over an existing one with
//    fanServiceConfig must not wipe it either. ────────────────────────────
store.importPresets([{ name: 'My Preset', ...REQUIRED }]); // no fanServiceConfig
const afterLegacyImport = store.get(savedId);
assert(
  afterLegacyImport.fanServiceConfig?.superchat?.authorColor === '#ff00ff',
  'existing fanServiceConfig NOT wiped by importing a legacy preset without it',
);

// ── 5. A real import WITH fanServiceConfig still updates it normally. ─────
store.importPresets([{ name: 'My Preset', ...REQUIRED, fanServiceConfig: { superchat: { authorColor: '#000000' } } }]);
const afterRealImport = store.get(savedId);
assert(
  afterRealImport.fanServiceConfig?.superchat?.authorColor === '#000000',
  'fanServiceConfig updates normally when the import actually includes it',
);

// ── Cleanup ─────────────────────────────────────────────────────────────
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('[smoke:custom-presets] OK — fanServiceConfig round-trips through save/get/import, legacy presets still validate, and existing values are never silently wiped.');
