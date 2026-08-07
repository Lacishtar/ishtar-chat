const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../shared/customize-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:horizontal-bar] ${message}`);
}

// Defaults: horizontal-bar must be opt-in — existing themes/presets that
// don't mention displayMode at all should keep rendering as a normal stack.
assert(DEFAULT_CUSTOMIZE_CONFIG.displayMode === 'stack', 'displayMode defaults to stack');
assert(DEFAULT_CUSTOMIZE_CONFIG.horizontalBarPosition === 'bottom', 'horizontalBarPosition defaults to bottom');

// A theme/preset can opt in via its default-config.json without touching
// any other field — mirrors how danmaku/ticker opt-in works.
const merged = {
  ...DEFAULT_CUSTOMIZE_CONFIG,
  ...sanitizeThemeDefaults({ _label: 'Horizontal Bar demo', displayMode: 'horizontal-bar', horizontalBarPosition: 'top' }),
};
assert(merged.displayMode === 'horizontal-bar', 'theme defaults can opt into horizontal-bar');
assert(merged.horizontalBarPosition === 'top', 'theme defaults can override horizontalBarPosition');
assert(merged.maxMessages === 40, 'unset fields still fall back to the shared default (reuses stack maxMessages/position)');
assert(!('_label' in merged), 'metadata keys are stripped before merging');

console.log('[smoke:horizontal-bar] all checks passed');
