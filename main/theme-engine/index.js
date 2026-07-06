const { adaptLegacyTheme, listLegacyThemeIds } = require('./legacy-adapter');
const { compileStyleToCssVariables, compileStyleToCssText } = require('./style-engine');
const { compileLayoutToCssVariables, compileLayoutToCssText } = require('./layout-engine');

/**
 * Theme Engine facade (design doc §1.2/§8 step 2).
 *
 * Today this only wraps the legacy adapter, since no themes-packages/*
 * (.ovstheme) packages exist yet — that's refactor step 9. NOTHING in the
 * running app calls this yet: main/index.js and the overlay still use
 * main/theme-registry.js and static file serving exactly as before, so
 * this file changes no user-visible behavior.
 *
 * It exists so later refactor steps (Style/Layout/Animation/Rule engines)
 * have one stable place to load a ThemeDocument from, regardless of
 * whether a given theme turns out to be legacy or a native package —
 * callers don't need to know or care which.
 */
function loadThemeDocument(themeId) {
  // Only legacy themes exist right now. Once themes-packages/<id>/manifest.json
  // packages exist (refactor step 9), this branches: check themes-packages/
  // first, fall back to the legacy adapter.
  return adaptLegacyTheme(themeId);
}

function listThemeIds() {
  return listLegacyThemeIds();
}

module.exports = {
  loadThemeDocument,
  listThemeIds,
  compileStyleToCssVariables,
  compileStyleToCssText,
  compileLayoutToCssVariables,
  compileLayoutToCssText,
};
