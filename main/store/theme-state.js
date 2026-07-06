const fs = require('fs');
const path = require('path');
const { loadThemeDocument } = require('../theme-engine');
const { readThemeConfig, THEMES_DIR } = require('../theme-registry');
const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../../shared/customize-config');
const { mergeLayoutConfig } = require('../../shared/layout-config');
const { mergeBubbleConfig } = require('../../shared/bubble-config');
const { DEFAULT_SLOT_STYLE_CONFIG, mergeSlotStyleConfig } = require('../../shared/slot-style-config');
const { DEFAULT_ANIMATION_CONFIG, mergeAnimationConfig } = require('../../shared/animation-config');

function readThemeOptionalJson(themeId, filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(THEMES_DIR, themeId, filename), 'utf-8'));
  } catch (_err) {
    return null;
  }
}

/**
 * Loads customize + layout from themes/<id>/ on disk — source of truth.
 */
function resolveThemeState(themeId) {
  const themeDefaults = sanitizeThemeDefaults(readThemeConfig(themeId));
  const themeDoc = loadThemeDocument(themeId);
  const layoutPreset = readThemeOptionalJson(themeId, 'layout-config.json');
  const slotStylePreset = readThemeOptionalJson(themeId, 'slot-style-config.json');
  return {
    selectedTheme: themeId,
    customizeConfig: { ...DEFAULT_CUSTOMIZE_CONFIG, ...themeDefaults },
    layoutConfig: mergeLayoutConfig(themeDoc.layout.settings, layoutPreset),
    slotStyleConfig: mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, slotStylePreset),
    animationConfig: mergeAnimationConfig(DEFAULT_ANIMATION_CONFIG),
    bubbleConfig: mergeBubbleConfig(themeDoc.style.bubble),
  };
}

module.exports = { resolveThemeState };
