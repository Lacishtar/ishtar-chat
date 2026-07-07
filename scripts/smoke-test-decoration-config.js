const {
  normalizeLayer,
  normalizeDecorationConfig,
  mergeDecorationConfig,
  createLayer,
  compileLayerInlineStyle,
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

console.log('[smoke:decoration] all checks passed');
