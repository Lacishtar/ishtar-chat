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

// Emoji glyph chip — bg/radius/opacity/glow are ALWAYS emitted now (never
// conditionally skipped), so that turning any of them off actually resets
// the live CSS var instead of leaving a stale value applied forever.
assert(base['--ovs-emoji-glyph-bg'] === 'rgba(255, 255, 255, 0.1)', 'emoji glyph bg default emitted');
assert(base['--ovs-emoji-glyph-radius'] === '6px', 'emoji glyph radius default emitted');
assert(base['--ovs-emoji-glyph-opacity'] === '1', 'emoji glyph opacity default emitted');
assert(base['--ovs-emoji-glyph-glow'] === 'none', 'null emoji glyph glow emitted as explicit none');

const emojiDecorated = compileBubbleDecorationToCssVariables({
  emojiGlyphBg: '#ff00ff',
  emojiGlyphRadius: 999,
  emojiGlyphOpacity: 0.5,
  emojiGlyphGlow: 'drop-shadow(0 0 8px rgba(100,200,255,0.8))',
});
assert(emojiDecorated['--ovs-emoji-glyph-bg'] === '#ff00ff', 'emoji glyph bg');
assert(emojiDecorated['--ovs-emoji-glyph-radius'] === '999px', 'emoji glyph radius (round preset)');
assert(emojiDecorated['--ovs-emoji-glyph-opacity'] === '0.5', 'emoji glyph opacity');
assert(
  emojiDecorated['--ovs-emoji-glyph-glow'] === 'drop-shadow(0 0 8px rgba(100,200,255,0.8))',
  'emoji glyph glow',
);

// Turning glow back off (emojiGlyphGlow: null) after it was previously set
// must produce an explicit 'none', not omit the key — this is exactly the
// bug being fixed: omitting the key left the old drop-shadow() filter
// stuck on :root since the applier only setProperty()s keys it sees.
const emojiGlowOff = compileBubbleDecorationToCssVariables({ emojiGlyphGlow: null });
assert(emojiGlowOff['--ovs-emoji-glyph-glow'] === 'none', 'emoji glyph glow explicitly reset to none');

// emojiGlyphEnabled=false is the master switch for the chip's decoration
// only — it must neutralize bg/radius/opacity/glow, but has no field that
// touches glyph size/position/content (those live in fixed CSS rules).
const emojiChipOff = compileBubbleDecorationToCssVariables({
  emojiGlyphEnabled: false,
  emojiGlyphBg: '#ff00ff',
  emojiGlyphRadius: 999,
  emojiGlyphOpacity: 0.5,
  emojiGlyphGlow: 'drop-shadow(0 0 8px rgba(100,200,255,0.8))',
});
assert(emojiChipOff['--ovs-emoji-glyph-bg'] === 'transparent', 'disabled emoji chip bg neutralized');
assert(emojiChipOff['--ovs-emoji-glyph-radius'] === '0px', 'disabled emoji chip radius neutralized');
assert(emojiChipOff['--ovs-emoji-glyph-opacity'] === '1', 'disabled emoji chip opacity neutralized');
assert(emojiChipOff['--ovs-emoji-glyph-glow'] === 'none', 'disabled emoji chip glow neutralized');

console.log('[smoke:customize-config] all checks passed');
