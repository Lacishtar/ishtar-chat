const { resolveThemeState } = require('../main/store/theme-state');
const { isProfileDirty, getThemeBaseline } = require('../main/store/theme-baseline');
const { buildUserOverlayProfile } = require('../main/store/config-store');

function fail(message) {
  throw new Error(`[smoke:theme-baseline] ${message}`);
}

const baseline = resolveThemeState('classic');

if (isProfileDirty(baseline, 'classic')) {
  fail('fresh theme state should not be dirty');
}

const customized = {
  ...baseline,
  customizeConfig: { ...baseline.customizeConfig, textColor: '#FF0000' },
};

if (!isProfileDirty(customized, 'classic')) {
  fail('changed textColor should be dirty');
}

const profile = buildUserOverlayProfile(customized);
if (profile.customizeConfig.textColor !== '#FF0000') {
  fail('buildUserOverlayProfile should include customizeConfig');
}
if (!profile.layoutConfig || !profile.slotStyleConfig) {
  fail('buildUserOverlayProfile should include layout and slot style');
}

const otherBaseline = getThemeBaseline('classic');
if (otherBaseline.customizeConfig.textColor !== baseline.customizeConfig.textColor) {
  fail('getThemeBaseline should match resolveThemeState');
}

console.log('[smoke:theme-baseline] all checks passed');
