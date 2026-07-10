const {
  normalizeLayer,
  normalizeDecorationConfig,
  mergeDecorationConfig,
  createLayer,
  compileLayerInlineStyle,
  normalizeMask,
  normalizeMaskTarget,
  normalizeMaskMode,
  DEFAULT_MASK,
  MASK_TARGETS,
  MASK_MODES,
} = require('../shared/decoration-config');
const { isAllowedImageUrl, toImageProxyUrl } = require('../shared/image-url');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:decoration] ${message}`);
}

const layer = normalizeLayer({
  id: 'test-1',
  imageUrl: 'https://i.ibb.co/test/sticker.png',
  anchor: 'message',
  translateX: 45,
  translateY: -22,
  rotate: 15,
  zIndex: 5,
  width: 98,
  height: 48,
  opacity: 0.9,
});

assert(layer.translateX === 45, 'translateX preserved');
assert(layer.anchor === 'message', 'anchor preserved');
assert(layer.zIndex === 5, 'zIndex preserved');

const presetStyle = compileLayerInlineStyle({
  ...layer,
  placement: 'bottom-left',
  translateX: -6,
  translateY: 6,
});
assert(presetStyle.left === '0', 'bottom-left left');
assert(presetStyle.top === '100%', 'bottom-left top');
assert(presetStyle.transform.includes('calc(-50%'), 'bottom-left centered offset');

const style = compileLayerInlineStyle(layer);
assert(style.transform.includes('45px'), 'style translateX');
assert(style.transform.includes('-22px'), 'style translateY');
assert(style.transform.includes('15deg'), 'style rotate');
assert(style.zIndex === '5', 'style zIndex');
assert(style.width === '98px', 'style width');

const merged = mergeDecorationConfig({ layers: [] }, {
  layers: [createLayer({ imageUrl: 'https://i.ibb.co/a/b.png' })],
});
assert(merged.layers.length === 1, 'merge layers');
assert(merged.layers[0].imageUrl === 'https://i.ibb.co/a/b.png', 'merge imageUrl');

const capped = normalizeDecorationConfig({
  layers: Array.from({ length: 40 }, (_, i) => createLayer({ id: `x-${i}` })),
});
assert(capped.layers.length === 30, 'soft cap 30 layers');

assert(isAllowedImageUrl('https://i.ibb.co/abc/sticker.png'), 'ibb.co allowed');
assert(!isAllowedImageUrl('http://i.ibb.co/x.png'), 'http rejected');
assert(!isAllowedImageUrl('https://127.0.0.1/secret.png'), 'localhost rejected');

const proxy = toImageProxyUrl('https://i.ibb.co/abc/sticker.png');
assert(proxy.startsWith('/image/proxy?url='), 'proxy path');

// --- Mask system ---

// Backward compatibility: a layer saved before the mask feature existed
// (no mask keys at all) must load with masking off and sensible defaults,
// so existing overlays keep rendering exactly the same.
const legacyLayer = normalizeLayer({
  id: 'legacy-1',
  imageUrl: 'https://i.ibb.co/x/legacy.png',
  anchor: 'avatar',
});
assert(legacyLayer.maskEnabled === false, 'legacy layer: mask disabled by default');
assert(legacyLayer.maskTarget === 'avatar', 'legacy layer: default mask target is avatar');
assert(legacyLayer.maskMode === 'clipInside', 'legacy layer: default mask mode is clipInside');
assert(legacyLayer.maskPadding === 0, 'legacy layer: default mask padding is 0');
assert(legacyLayer.maskFeather === 0, 'legacy layer: default mask feather is 0');
assert(legacyLayer.maskInvert === false, 'legacy layer: default mask invert is false');

// Full mask round-trip with valid values.
const maskedLayer = normalizeLayer({
  id: 'masked-1',
  imageUrl: 'https://i.ibb.co/x/masked.png',
  anchor: 'avatar',
  maskEnabled: true,
  maskTarget: 'avatar',
  maskMode: 'clipOutside',
  maskPadding: 12,
  maskFeather: 8,
  maskInvert: true,
});
assert(maskedLayer.maskEnabled === true, 'masked layer: enabled preserved');
assert(maskedLayer.maskMode === 'clipOutside', 'masked layer: mode preserved');
assert(maskedLayer.maskPadding === 12, 'masked layer: padding preserved');
assert(maskedLayer.maskFeather === 8, 'masked layer: feather preserved');
assert(maskedLayer.maskInvert === true, 'masked layer: invert preserved');

// Clamping: padding/feather ranges and invalid enum values.
const clampedMask = normalizeMask({
  maskPadding: 999,
  maskFeather: -50,
  maskTarget: 'not-a-real-target',
  maskMode: 'not-a-real-mode',
});
assert(clampedMask.maskPadding === 100, 'mask padding clamped to +100 max');
assert(clampedMask.maskFeather === 0, 'mask feather clamped to 0 min');
assert(clampedMask.maskTarget === DEFAULT_MASK.maskTarget, 'invalid mask target falls back to default');
assert(clampedMask.maskMode === DEFAULT_MASK.maskMode, 'invalid mask mode falls back to default');

const negPaddingMask = normalizeMask({ maskPadding: -999 });
assert(negPaddingMask.maskPadding === -100, 'mask padding clamped to -100 min');

assert(normalizeMaskTarget('avatar') === 'avatar', 'normalizeMaskTarget accepts avatar');
assert(normalizeMaskTarget('bogus') === DEFAULT_MASK.maskTarget, 'normalizeMaskTarget falls back on bogus value');
assert(normalizeMaskMode('clipInside') === 'clipInside', 'normalizeMaskMode accepts clipInside');
assert(normalizeMaskMode('bogus') === DEFAULT_MASK.maskMode, 'normalizeMaskMode falls back on bogus value');
assert(MASK_TARGETS.includes('avatar'), 'MASK_TARGETS includes avatar');
assert(MASK_MODES.length === 3, 'MASK_MODES has three modes');

// Per-sticker independence: each layer keeps its own mask settings and
// normalizing one never leaks into another.
const multiLayerConfig = normalizeDecorationConfig({
  layers: [
    { id: 'a', imageUrl: 'https://i.ibb.co/x/a.png', maskEnabled: true, maskMode: 'clipInside' },
    { id: 'b', imageUrl: 'https://i.ibb.co/x/b.png', maskEnabled: false },
    { id: 'c', imageUrl: 'https://i.ibb.co/x/c.png', maskEnabled: true, maskMode: 'clipOutside' },
  ],
});
assert(multiLayerConfig.layers[0].maskMode === 'clipInside', 'sticker A keeps clipInside');
assert(multiLayerConfig.layers[1].maskEnabled === false, 'sticker B keeps mask disabled');
assert(multiLayerConfig.layers[2].maskMode === 'clipOutside', 'sticker C keeps clipOutside');

// createLayer default still has masking off out of the box.
const freshLayer = createLayer({ imageUrl: 'https://i.ibb.co/x/fresh.png' });
assert(freshLayer.maskEnabled === false, 'createLayer default has mask disabled');

console.log('[smoke:decoration] all checks passed');
