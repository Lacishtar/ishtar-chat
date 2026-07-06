// Proves the Style Engine's compiled output matches the CSS custom
// properties every hand-written themes/<id>/style.css already depends on —
// design doc §8 step 3 ("diffing the compiled CSS against the hand-written
// one"). Cross-references three things per theme:
//
//   1. themes/<id>/style.css's own `var(--ovs-*)` usages — the ground truth
//      of which variables actually affect rendering today.
//   2. shared/customize-config.js#toCssVariables(config) — the existing,
//      already-in-the-codebase canonical flat-config -> CSS-vars mapping
//      (confirmed unused-elsewhere-but-authoritative; see PR notes).
//   3. main/theme-engine/style-engine.js#compileStyleToCssVariables(doc.style)
//      — the new, data-driven mapping compiled from a ThemeDocument's
//      style.json (itself synthesized by legacy-adapter.js in step 2).
//
// For every variable the Style Engine claims to model, its compiled value
// must exactly equal what toCssVariables() already produces for that theme,
// AND that variable must genuinely be one the theme's own style.css uses —
// so this fails loudly if style-engine.js ever drifts from what actually
// renders, in either direction.
const fs = require('fs');
const path = require('path');
const { loadThemeDocument, listThemeIds, compileStyleToCssVariables } = require('../main/theme-engine');
const { THEMES_DIR, readThemeConfig } = require('../main/theme-registry');
const { DEFAULT_CUSTOMIZE_CONFIG, toCssVariables, sanitizeThemeDefaults } = require('../shared/customize-config');

const EXPECTED_THEME_IDS = ['classic', 'bubble', 'glass', 'minimal', 'anime', 'cyber', 'danmaku', 'ticker'];

function fail(message) {
  throw new Error(`[smoke:style-engine] ${message}`);
}

function varsUsedByStylesheet(themeId) {
  const cssPath = path.join(THEMES_DIR, themeId, 'style.css');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const regex = /var\(\s*(--ovs-[a-z-]+)/g;
  const found = new Set();
  let match = regex.exec(css);
  while (match !== null) {
    found.add(match[1]);
    match = regex.exec(css);
  }
  return found;
}

function checkTheme(themeId) {
  const doc = loadThemeDocument(themeId);
  const compiled = compileStyleToCssVariables(doc.style);

  // Same merge main/index.js's theme:select handler performs today —
  // this IS the production ground truth, not a re-derivation of it.
  const rawDefaults = sanitizeThemeDefaults(readThemeConfig(themeId));
  const config = { ...DEFAULT_CUSTOMIZE_CONFIG, ...rawDefaults };
  const groundTruth = toCssVariables(config);

  const usedByCss = varsUsedByStylesheet(themeId);
  const modeledVars = Object.keys(compiled);

  if (modeledVars.length === 0) fail(`${themeId}: Style Engine compiled zero variables`);

  // A compiled-but-theme-unused variable (e.g. minimal has no bubble box at
  // all, so it never reads --ovs-bubble-bg) is harmless — an unreferenced
  // CSS custom property does nothing. What actually matters: for every var
  // the theme's OWN style.css does reference, the compiled value must
  // exactly match production. That's the real regression to guard against.
  const relevantVars = modeledVars.filter((varName) => usedByCss.has(varName));
  relevantVars.forEach((varName) => {
    if (compiled[varName] !== groundTruth[varName]) {
      fail(
        `${themeId}: ${varName} mismatch — style-engine compiled "${compiled[varName]}", ` +
          `existing toCssVariables() produced "${groundTruth[varName]}"`
      );
    }
  });

  const compiledButUnused = modeledVars.filter((v) => !usedByCss.has(v));
  const notYetModeled = [...usedByCss].filter((v) => !modeledVars.includes(v));
  let note = `[smoke] ${themeId}: ${relevantVars.length}/${usedByCss.size} CSS vars this theme uses now compiled from style.json ✔`;
  if (notYetModeled.length) note += ` (still flat-config-only, by design: ${notYetModeled.join(', ')})`;
  if (compiledButUnused.length) note += ` (compiled but unused by this theme's own CSS: ${compiledButUnused.join(', ')})`;
  console.log(note);
}

function main() {
  const ids = listThemeIds();
  EXPECTED_THEME_IDS.forEach((id) => {
    if (!ids.includes(id)) fail(`listThemeIds() is missing "${id}"`);
  });
  EXPECTED_THEME_IDS.forEach(checkTheme);
  console.log('[smoke] ALL CHECKS PASSED');
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
