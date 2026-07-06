// Asserts every existing themes/<id>/ folder still resolves correctly
// through the new Theme Engine (main/theme-engine/*) — design doc §8 step 2
// / §9.4 Phase A: "invisible to users, existing app behaves identically."
// This never touches Electron, the HTTP/WS server, or overlay-client.js —
// it only checks that legacy-adapter.js's synthesized ThemeDocument
// faithfully reflects each theme's own template.html + default-config.json.
const path = require('path');
const fs = require('fs');
const { loadThemeDocument, listThemeIds } = require('../main/theme-engine');
const { THEMES_DIR, readThemeConfig } = require('../main/theme-registry');

const EXPECTED_THEME_IDS = ['classic', 'bubble', 'glass', 'minimal', 'anime', 'cyber', 'danmaku', 'ticker'];
const ABSOLUTE_LAYOUT_THEMES = new Set(['danmaku', 'ticker']);
const EXPECTED_SLOT_COMPONENTS = ['Avatar', 'Username', 'Badges', 'Message'];

function fail(message) {
  throw new Error(`[smoke:legacy-themes] ${message}`);
}

function checkThemeDiscovery() {
  const ids = listThemeIds();
  for (const expected of EXPECTED_THEME_IDS) {
    if (!ids.includes(expected)) fail(`listThemeIds() is missing "${expected}"`);
  }
  console.log(`[smoke] listThemeIds() found all ${EXPECTED_THEME_IDS.length} expected themes ✔`);
}

function checkTheme(themeId) {
  const config = readThemeConfig(themeId);
  const doc = loadThemeDocument(themeId);

  // --- manifest ---
  if (doc.manifest.id !== themeId) fail(`${themeId}: manifest.id mismatch`);
  const expectedName = config._label || themeId;
  if (doc.manifest.name !== expectedName) fail(`${themeId}: manifest.name mismatch`);

  // --- layout: all 4 slots present, as the right component names, in order ---
  const messageRow = doc.layout.root.children[0];
  const gotComponents = messageRow.children.map((c) => c.component);
  for (const expected of EXPECTED_SLOT_COMPONENTS) {
    if (!gotComponents.includes(expected)) {
      fail(`${themeId}: layout is missing component "${expected}" (got: ${gotComponents.join(', ')})`);
    }
  }

  // --- layout mode: danmaku is the one absolute-positioned exception ---
  const expectedMode = ABSOLUTE_LAYOUT_THEMES.has(themeId) ? 'absolute' : 'flex-column';
  if (doc.layout.root.mode !== expectedMode) {
    fail(`${themeId}: expected root.mode "${expectedMode}", got "${doc.layout.root.mode}"`);
  }

  // --- style tokens mirror the original flat config ---
  if (doc.style.tokens.color.text !== config.textColor) fail(`${themeId}: style token color.text mismatch`);
  if (doc.style.tokens.color.author !== config.authorColor) fail(`${themeId}: style token color.author mismatch`);
  if (doc.style.tokens.font.family !== config.fontFamily) fail(`${themeId}: style token font.family mismatch`);

  // --- animation mirrors the original animationMs ---
  const expectedDuration = config.animationMs || 220;
  if (doc.animation.targets.messageEnter.duration !== expectedDuration) {
    fail(`${themeId}: animation messageEnter.duration mismatch`);
  }

  // --- layout settings present in Theme JSON ---
  if (!doc.layout.settings) fail(`${themeId}: layout.settings missing`);
  if (!doc.layout.settings.slots?.avatar) fail(`${themeId}: layout.settings.slots.avatar missing`);

  // --- rules stay empty for every legacy theme ---
  if (doc.rules.rules.length !== 0) fail(`${themeId}: expected empty rules, got ${doc.rules.rules.length}`);

  console.log(`[smoke] ${themeId} adapts correctly ✔`);
}

function checkThemeFoldersUntouched() {
  // Belt-and-suspenders: confirm this test suite didn't accidentally need
  // (or cause) any change to the actual theme folders it's reading.
  for (const themeId of EXPECTED_THEME_IDS) {
    const templatePath = path.join(THEMES_DIR, themeId, 'template.html');
    if (!fs.existsSync(templatePath)) fail(`${themeId}: template.html unexpectedly missing`);
  }
  console.log('[smoke] all legacy theme folders present and untouched ✔');
}

function main() {
  checkThemeDiscovery();
  EXPECTED_THEME_IDS.forEach(checkTheme);
  checkThemeFoldersUntouched();
  console.log('[smoke] ALL CHECKS PASSED');
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
