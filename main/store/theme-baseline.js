const { resolveThemeState } = require('./theme-state');

function getThemeBaseline(themeId) {
  const state = resolveThemeState(themeId);
  return {
    customizeConfig: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
    animationConfig: state.animationConfig,
    decorationConfig: state.decorationConfig,
    roleStyleConfig: state.roleStyleConfig,
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
  if (!deepEqual(state.decorationConfig, baseline.decorationConfig)) fields.push('trang trí ảnh');
  if (!deepEqual(state.roleStyleConfig, baseline.roleStyleConfig)) fields.push('kiểu mod/hội viên/superchat');
  return fields;
}

function isProfileDirty(state, themeId) {
  return getDirtyFields(state, themeId).length > 0;
}

module.exports = { getThemeBaseline, isProfileDirty, getDirtyFields, deepEqual };
