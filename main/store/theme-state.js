const { LoadTheme } = require('../../shared/theme-manager');

const FALLBACK_THEME_ID = 'default';

/**
 * Resolves the full config-store shape for a theme id, sourced entirely
 * from shared/theme-presets/ (index.js + themes/*.js) via shared/theme-manager.js#LoadTheme — the
 * single source of truth for both the theme picker (theme:list/theme:apply)
 * and app boot / theme:reset-preset. Falls back to FALLBACK_THEME_ID for an
 * unknown/missing id.
 */
function resolveThemeState(themeId) {
  const resolvedThemeId = LoadTheme(themeId) ? themeId : FALLBACK_THEME_ID;
  const theme = LoadTheme(resolvedThemeId);

  return {
    selectedTheme: resolvedThemeId,
    customizeConfig: theme.customizeConfig,
    layoutConfig: theme.layoutConfig,
    slotStyleConfig: theme.slotStyleConfig,
    animationConfig: theme.animationConfig,
    decorationConfig: theme.decorationConfig,
    roleStyleConfig: theme.roleStyleConfig,
  };
}

module.exports = { resolveThemeState };
