const { DEFAULT_CUSTOMIZE_CONFIG, sanitizeThemeDefaults } = require('../shared/customize-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:ticker] ${message}`);
}

assert(DEFAULT_CUSTOMIZE_CONFIG.tickerSpeed === 1, 'default tickerSpeed is 1');
assert(DEFAULT_CUSTOMIZE_CONFIG.tickerGap === 32, 'default tickerGap is 32');
assert(DEFAULT_CUSTOMIZE_CONFIG.tickerPosition === 'bottom', 'default tickerPosition is bottom');

const mergedTop = {
  ...DEFAULT_CUSTOMIZE_CONFIG,
  ...sanitizeThemeDefaults({ displayMode: 'ticker', tickerPosition: 'top' }),
};
assert(mergedTop.displayMode === 'ticker', 'theme defaults can opt into ticker');
assert(mergedTop.tickerPosition === 'top', 'theme defaults can override tickerPosition to top');

console.log('[smoke:ticker] all checks passed');
