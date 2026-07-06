const { resolveThemeState } = require('./theme-state');

function getThemeBaseline(themeId) {
  const state = resolveThemeState(themeId);
  return {
    customizeConfig: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isProfileDirty(state, themeId) {
  const baseline = getThemeBaseline(themeId);
  return !deepEqual(state.customizeConfig, baseline.customizeConfig)
    || !deepEqual(state.layoutConfig, baseline.layoutConfig)
    || !deepEqual(state.slotStyleConfig, baseline.slotStyleConfig);
}

module.exports = { getThemeBaseline, isProfileDirty, deepEqual };
