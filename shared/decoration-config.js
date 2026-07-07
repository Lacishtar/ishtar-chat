/**
 * DecorationConfig — user-placed image layers on chat message rows.
 * Each layer is anchored to a slot and positioned with translate/rotate/z-index.
 */

const ANCHORS = ['bubble', 'row', 'body', 'avatar', 'author', 'message'];

const PLACEMENTS = [
  'custom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'top-center',
  'bottom-center',
  'center-left',
  'center-right',
  'center',
];

const DEFAULT_LAYER = {
  enabled: true,
  imageUrl: '',
  anchor: 'bubble',
  placement: 'bottom-left',
  translateX: -6,
  translateY: 6,
  rotate: 0,
  zIndex: 5,
  width: 48,
  height: 48,
  opacity: 1,
};

const DEFAULT_DECORATION_CONFIG = {
  layers: [],
};

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalizeAnchor(anchor) {
  return ANCHORS.includes(anchor) ? anchor : DEFAULT_LAYER.anchor;
}

function normalizePlacement(placement) {
  return PLACEMENTS.includes(placement) ? placement : 'custom';
}

function normalizeLayer(raw, index = 0) {
  const layer = raw || {};
  const id = typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : `deco-${index}`;
  return {
    id,
    enabled: layer.enabled !== false,
    imageUrl: typeof layer.imageUrl === 'string' ? layer.imageUrl.trim() : '',
    anchor: normalizeAnchor(layer.anchor),
    placement: normalizePlacement(layer.placement),
    translateX: clampNumber(layer.translateX, DEFAULT_LAYER.translateX, -500, 500),
    translateY: clampNumber(layer.translateY, DEFAULT_LAYER.translateY, -500, 500),
    rotate: clampNumber(layer.rotate, 0, -360, 360),
    zIndex: clampNumber(layer.zIndex, DEFAULT_LAYER.zIndex, -100, 500),
    width: clampNumber(layer.width, 48, 8, 400),
    height: clampNumber(layer.height, 48, 8, 400),
    opacity: clampNumber(layer.opacity, 1, 0, 1),
  };
}

function normalizeDecorationConfig(config) {
  const c = config || DEFAULT_DECORATION_CONFIG;
  const layers = Array.isArray(c.layers) ? c.layers.map(normalizeLayer) : [];
  return { layers: layers.slice(0, 30) };
}

function mergeDecorationConfig(base, overrides) {
  if (overrides && Array.isArray(overrides.layers)) {
    return normalizeDecorationConfig({ layers: overrides.layers });
  }
  return normalizeDecorationConfig(base || DEFAULT_DECORATION_CONFIG);
}

function createLayer(overrides = {}) {
  return normalizeLayer({ ...DEFAULT_LAYER, ...overrides }, 0);
}

const PLACEMENT_CORNERS = {
  'top-left': { left: '0', top: '0' },
  'top-right': { left: '100%', top: '0' },
  'bottom-left': { left: '0', top: '100%' },
  'bottom-right': { left: '100%', top: '100%' },
  'top-center': { left: '50%', top: '0' },
  'bottom-center': { left: '50%', top: '100%' },
  'center-left': { left: '0', top: '50%' },
  'center-right': { left: '100%', top: '50%' },
  center: { left: '50%', top: '50%' },
};

/** Inline style object for overlay DOM (browser) or smoke tests. */
function compileLayerInlineStyle(layer) {
  const l = normalizeLayer(layer);
  const base = {
    position: 'absolute',
    right: 'auto',
    bottom: 'auto',
    zIndex: String(l.zIndex),
    opacity: String(l.opacity),
    width: `${l.width}px`,
    height: `${l.height}px`,
    objectFit: 'contain',
    pointerEvents: 'none',
  };
  const rot = `${l.rotate}deg`;

  if (l.placement === 'custom') {
    return {
      ...base,
      left: '0',
      top: '0',
      transform: `translate(${l.translateX}px, ${l.translateY}px) rotate(${rot})`,
      transformOrigin: 'center center',
    };
  }

  const corner = PLACEMENT_CORNERS[l.placement] || PLACEMENT_CORNERS['bottom-left'];
  return {
    ...base,
    left: corner.left,
    top: corner.top,
    transform: `translate(calc(-50% + ${l.translateX}px), calc(-50% + ${l.translateY}px)) rotate(${rot})`,
    transformOrigin: 'center center',
  };
}

function compileLayerInlineStyleString(layer) {
  return Object.entries(compileLayerInlineStyle(layer))
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
    .join(';');
}

module.exports = {
  ANCHORS,
  PLACEMENTS,
  DEFAULT_DECORATION_CONFIG,
  DEFAULT_LAYER,
  normalizeLayer,
  normalizePlacement,
  normalizeDecorationConfig,
  mergeDecorationConfig,
  createLayer,
  compileLayerInlineStyle,
  compileLayerInlineStyleString,
};
