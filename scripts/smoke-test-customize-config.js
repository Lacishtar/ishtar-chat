const {
  DEFAULT_CUSTOMIZE_CONFIG,
  toCssVariables,
  compileBubbleDecorationToCssVariables,
} = require('../shared/customize-config');

function fail(message) {
  throw new Error(`[smoke:customize-config] ${message}`);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

const base = toCssVariables(DEFAULT_CUSTOMIZE_CONFIG);
assert(base['--ovs-bubble-border-width'] === undefined, 'null border width not emitted');
assert(base['--ovs-bubble-pad-x'] === undefined, 'null padding not emitted');

const decorated = compileBubbleDecorationToCssVariables({
  bubbleBorderWidth: 2,
  bubbleBorderStyle: 'dashed',
  bubbleBorderColor: '#AABBCC',
  bubbleBoxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  bubblePaddingX: 16,
  bubblePaddingY: 12,
});

assert(decorated['--ovs-bubble-border-width'] === '2px', 'border width');
assert(decorated['--ovs-bubble-border-style'] === 'dashed', 'border style');
assert(decorated['--ovs-bubble-border-color'] === '#AABBCC', 'border color');
assert(decorated['--ovs-bubble-box-shadow'] === '0 4px 8px rgba(0,0,0,0.2)', 'box shadow');
assert(decorated['--ovs-bubble-pad-x'] === '16px', 'pad x');
assert(decorated['--ovs-bubble-pad-y'] === '12px', 'pad y');

const uniformPad = compileBubbleDecorationToCssVariables({ bubblePadding: 20 });
assert(uniformPad['--ovs-bubble-pad-x'] === '20px', 'uniform pad x');
assert(uniformPad['--ovs-bubble-pad-y'] === '20px', 'uniform pad y');

const noneBorder = compileBubbleDecorationToCssVariables({ bubbleBorderStyle: 'none', bubbleBorderWidth: 0 });
assert(noneBorder['--ovs-bubble-border-style'] === 'none', 'explicit none border');
assert(noneBorder['--ovs-bubble-border-width'] === '0px', 'explicit zero border');

const merged = toCssVariables({
  ...DEFAULT_CUSTOMIZE_CONFIG,
  bubbleBorderWidth: 1,
  bubblePaddingY: 8,
});
assert(merged['--ovs-bubble-border-width'] === '1px', 'toCssVariables merges decoration');
assert(merged['--ovs-bubble-pad-y'] === '8px', 'toCssVariables pad y');

console.log('[smoke:customize-config] all checks passed');
