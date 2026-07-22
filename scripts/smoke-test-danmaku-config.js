const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../shared/customize-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:danmaku] ${message}`);
}

// Defaults: danmaku must be opt-in — existing themes/presets that don't
// mention displayMode at all should keep rendering as a normal stack.
assert(DEFAULT_CUSTOMIZE_CONFIG.displayMode === 'stack', 'displayMode defaults to stack');
assert(DEFAULT_CUSTOMIZE_CONFIG.danmakuSpeed === 1, 'danmakuSpeed defaults to 1x');
assert(DEFAULT_CUSTOMIZE_CONFIG.danmakuLanes === 12, 'danmakuLanes defaults to 12');
assert(DEFAULT_CUSTOMIZE_CONFIG.danmakuAreaTopPct === 4, 'danmakuAreaTopPct defaults to 4%');
assert(DEFAULT_CUSTOMIZE_CONFIG.danmakuAreaBottomPct === 4, 'danmakuAreaBottomPct defaults to 4%');

// A theme/preset can opt in via its default-config.json without touching
// any other field — mirrors how `position`/`maxMessages` overrides work.
const merged = { ...DEFAULT_CUSTOMIZE_CONFIG, ...sanitizeThemeDefaults({ _label: 'Danmaku demo', displayMode: 'danmaku', danmakuSpeed: 1.5 }) };
assert(merged.displayMode === 'danmaku', 'theme defaults can opt into danmaku');
assert(merged.danmakuSpeed === 1.5, 'theme defaults can override danmaku speed');
assert(merged.danmakuLanes === 12, 'unset fields still fall back to the shared default');
assert(!('_label' in merged), 'metadata keys are stripped before merging');

// Themes can also opt into wider clearance at one edge only (e.g. to dodge
// a webcam overlay docked at the bottom) without needing to touch the
// other margin.
const edgeAware = { ...DEFAULT_CUSTOMIZE_CONFIG, ...sanitizeThemeDefaults({ displayMode: 'danmaku', danmakuAreaBottomPct: 20 }) };
assert(edgeAware.danmakuAreaBottomPct === 20, 'theme defaults can override just the bottom margin');
assert(edgeAware.danmakuAreaTopPct === 4, 'the other margin still falls back to its own default');

console.log('[smoke:danmaku] all checks passed');
