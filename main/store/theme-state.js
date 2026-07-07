const fs = require('fs');
const path = require('path');
const { loadThemeDocument } = require('../theme-engine');
const { readThemeConfig, THEMES_DIR, themeExists } = require('../theme-registry');
const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../../shared/customize-config');
const { mergeLayoutConfig } = require('../../shared/layout-config');
const { mergeBubbleConfig } = require('../../shared/bubble-config');
const { DEFAULT_SLOT_STYLE_CONFIG, mergeSlotStyleConfig } = require('../../shared/slot-style-config');
const { DEFAULT_ANIMATION_CONFIG, mergeAnimationConfig } = require('../../shared/animation-config');
const { DEFAULT_DECORATION_CONFIG, mergeDecorationConfig } = require('../../shared/decoration-config');
const { DEFAULT_ROLE_STYLE_CONFIG, mergeRoleStyleConfig } = require('../../shared/role-style-config');

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
  const fallbackThemeId = 'classic';
  const resolvedThemeId = themeExists(themeId) ? themeId : fallbackThemeId;
  const themeDefaults = sanitizeThemeDefaults(readThemeConfig(resolvedThemeId));

  let themeDoc;
  try {
    themeDoc = loadThemeDocument(resolvedThemeId);
  } catch (err) {
    console.warn(`[theme-state] falling back to '${fallbackThemeId}' for missing theme '${themeId}':`, err.message);
    themeDoc = loadThemeDocument(fallbackThemeId);
  }

  const layoutPreset = readThemeOptionalJson(resolvedThemeId, 'layout-config.json');
  const slotStylePreset = readThemeOptionalJson(resolvedThemeId, 'slot-style-config.json');
  const decorationPreset = readThemeOptionalJson(resolvedThemeId, 'decoration-config.json');
  return {
    selectedTheme: resolvedThemeId,
    customizeConfig: { ...DEFAULT_CUSTOMIZE_CONFIG, ...themeDefaults },
    layoutConfig: mergeLayoutConfig(themeDoc.layout.settings, layoutPreset),
    slotStyleConfig: mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, slotStylePreset),
    animationConfig: mergeAnimationConfig(DEFAULT_ANIMATION_CONFIG),
    decorationConfig: mergeDecorationConfig(DEFAULT_DECORATION_CONFIG, decorationPreset),
    roleStyleConfig: mergeRoleStyleConfig(DEFAULT_ROLE_STYLE_CONFIG),
    bubbleConfig: mergeBubbleConfig(themeDoc.style.bubble),
  };
}

module.exports = { resolveThemeState };
