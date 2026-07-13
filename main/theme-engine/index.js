const { adaptLegacyTheme, listLegacyThemeIds } = require('./legacy-adapter');

/**
 * Theme Engine facade (design doc §1.2/§8 step 2).
 *
 * Today this only wraps the legacy adapter, since no themes-packages/*
 * (.ovstheme) packages exist yet — that's refactor step 9.
 *
 * loadThemeDocument() IS called at runtime by main/store/theme-state.js
 * (resolveThemeState — used on app boot and on theme:reset-preset) to
 * source layout.settings for the active theme. The overlay itself still
 * renders from static template.html/style.css files served as-is; only
 * the dashboard-side config resolution goes through this facade.
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
};
