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
const { isAllowedImageUrl, toImageProxyUrl, normalizeGoogleDriveImageUrl } = require('../shared/image-url');

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
  size: 98,
  opacity: 0.9,
});

assert(layer.translateX === 45, 'translateX preserved');
assert(layer.anchor === 'message', 'anchor preserved');
assert(layer.zIndex === 5, 'zIndex preserved');
assert(layer.size === 98, 'size preserved');
assert(layer.width === 98, 'width == size');
assert(layer.height === 98, 'height == size');

const presetStyle = compileLayerInlineStyle({
  placement: 'bottom-left',
  translateX: -6,
  translateY: 6,
  size: 48,
});
assert(presetStyle.left === 'calc(0% + -6px)', 'bottom-left left calc');
assert(presetStyle.top === 'calc(100% + 6px)', 'bottom-left top calc');
assert(presetStyle.transform.includes('translate(0%, -100%)'), 'bottom-left translate(0%, -100%)');
assert(presetStyle.transformOrigin === '0% 100%', 'transformOrigin 0% 100%');

const style = compileLayerInlineStyle(layer);
assert(style.left.includes('45px'), 'style left includes translateX');
assert(style.top.includes('-22px'), 'style top includes translateY');
assert(style.transform.includes('15deg'), 'style rotate');
assert(style.zIndex === '5', 'style zIndex');
assert(style.width === '98px', 'style width == size');

const merged = mergeDecorationConfig({ layers: [] }, {
  layers: [createLayer({ imageUrl: 'https://i.ibb.co/a/b.png' })],
});
assert(merged.layers.length === 1, 'merge layers');
assert(merged.layers[0].imageUrl === 'https://i.ibb.co/a/b.png', 'merge imageUrl');

const capped = normalizeDecorationConfig({
  layers: Array.from({ length: 40 }, (_, i) => createLayer({ id: `x-${i}` })),
});
assert(capped.layers.length === 30, 'soft cap 30 layers');

assert(
  normalizeGoogleDriveImageUrl('https://drive.google.com/file/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ/view?usp=drive_link') ===
    'https://lh3.googleusercontent.com/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ',
  'google drive view URL auto-converted to lh3 direct URL',
);

assert(
  isAllowedImageUrl('https://drive.google.com/file/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ/view?usp=drive_link'),
  'google drive URL is allowed',
);

const driveProxy = toImageProxyUrl('https://drive.google.com/file/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ/view?usp=drive_link');
assert(
  driveProxy.includes(encodeURIComponent('https://lh3.googleusercontent.com/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ')),
  'google drive proxy path uses normalized direct URL',
);

const driveLayer = normalizeLayer({
  imageUrl: 'https://drive.google.com/file/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ/view?usp=drive_link',
});
assert(
  driveLayer.imageUrl === 'https://lh3.googleusercontent.com/d/1m7ok_uRFs6Dh4kGMNpNFxhnw3HcYBnMZ',
  'normalizeLayer automatically converts google drive imageUrl',
);

assert(isAllowedImageUrl('https://i.ibb.co/abc/sticker.png'), 'ibb.co allowed');
assert(!isAllowedImageUrl('http://i.ibb.co/x.png'), 'http rejected');
assert(!isAllowedImageUrl('https://127.0.0.1/secret.png'), 'localhost rejected');

const proxy = toImageProxyUrl('https://i.ibb.co/abc/sticker.png');
assert(proxy.startsWith('/image/proxy?url='), 'proxy path');

// --- Mask system ---

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

// glowLayer/bottomAccentBar/customShape were all removed entirely — MASK_TARGETS
// only contains real, fully-wired targets, no reserved placeholders.
assert(!MASK_TARGETS.includes('glowLayer'), 'glowLayer removed from MASK_TARGETS');
assert(!MASK_TARGETS.includes('bottomAccentBar'), 'bottomAccentBar removed from MASK_TARGETS');
assert(!MASK_TARGETS.includes('customShape'), 'customShape removed from MASK_TARGETS');
assert(MASK_TARGETS.length === 4, 'MASK_TARGETS only has the 4 real, wired-up targets');
assert(normalizeMaskTarget('customShape') === DEFAULT_MASK.maskTarget, 'customShape no longer a valid mask target');

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
assert(freshLayer.idleAnimation === 'none', 'createLayer default has idleAnimation none');

// --- Idle Animation tests ---
const { IDLE_ANIMATIONS, normalizeIdleAnimation } = require('../shared/decoration-config');
assert(Array.isArray(IDLE_ANIMATIONS), 'IDLE_ANIMATIONS is array');
assert(IDLE_ANIMATIONS.length === 6, 'IDLE_ANIMATIONS has 6 modes');
assert(IDLE_ANIMATIONS.includes('float'), 'IDLE_ANIMATIONS has float');
assert(IDLE_ANIMATIONS.includes('bounce'), 'IDLE_ANIMATIONS has bounce');
assert(IDLE_ANIMATIONS.includes('wiggle'), 'IDLE_ANIMATIONS has wiggle');
assert(IDLE_ANIMATIONS.includes('tilt'), 'IDLE_ANIMATIONS has tilt');
assert(IDLE_ANIMATIONS.includes('slideX'), 'IDLE_ANIMATIONS has slideX');

assert(normalizeIdleAnimation('wiggle') === 'wiggle', 'normalizeIdleAnimation accepts wiggle');
assert(normalizeIdleAnimation('invalid') === 'none', 'normalizeIdleAnimation falls back to none');

const customIdleLayer = normalizeLayer({ id: 'idle-1', imageUrl: 'https://i.ibb.co/x/idle.png', idleAnimation: 'bounce' });
assert(customIdleLayer.idleAnimation === 'bounce', 'custom idleAnimation preserved');

console.log('[smoke:decoration] all checks passed');
