const { resolveThemeState } = require('./theme-state');

function getThemeBaseline(themeId) {
  const state = resolveThemeState(themeId);
  return {
    customizeConfig: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
    animationConfig: state.animationConfig,
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getDirtyFields(state, themeId) {
  const baseline = getThemeBaseline(themeId);
  const fields = [];
  if (!deepEqual(state.customizeConfig, baseline.customizeConfig)) fields.push('màu sắc & kiểu chữ');
  if (!deepEqual(state.layoutConfig, baseline.layoutConfig)) fields.push('bố cục');
  if (!deepEqual(state.slotStyleConfig, baseline.slotStyleConfig)) fields.push('kiểu từng phần tử');
  if (!deepEqual(state.animationConfig, baseline.animationConfig)) fields.push('hiệu ứng');
  return fields;
}

function isProfileDirty(state, themeId) {
  return getDirtyFields(state, themeId).length > 0;
}

module.exports = { getThemeBaseline, isProfileDirty, getDirtyFields, deepEqual };
