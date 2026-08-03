const { LoadTheme } = require('../../shared/theme-manager');

const FALLBACK_THEME_ID = 'default';

// Resolves the full config-store shape for a theme id, sourced entirely
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
    fanServiceConfig: theme.fanServiceConfig,
  };
}

module.exports = { resolveThemeState };
