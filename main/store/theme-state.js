const { loadThemeDocument } = require('../theme-engine');
const { readThemeConfig } = require('../theme-registry');
const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../../shared/customize-config');
const { mergeLayoutConfig } = require('../../shared/layout-config');
const { mergeBubbleConfig } = require('../../shared/bubble-config');

/**
 * Loads customize + layout from themes/<id>/ on disk — source of truth.
 */
function resolveThemeState(themeId) {
  const themeDefaults = sanitizeThemeDefaults(readThemeConfig(themeId));
  const themeDoc = loadThemeDocument(themeId);
  return {
    selectedTheme: themeId,
    customizeConfig: { ...DEFAULT_CUSTOMIZE_CONFIG, ...themeDefaults },
    layoutConfig: mergeLayoutConfig(themeDoc.layout.settings),
    bubbleConfig: mergeBubbleConfig(themeDoc.style.bubble),
  };
}

module.exports = { resolveThemeState };
