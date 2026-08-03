// DecorationConfig — user-placed image layers on chat message rows.

const { normalizeGoogleDriveImageUrl } = require('./image-url');

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

// Mask targets — the shape a decoration layer's clipping mask is derived
const MASK_TARGETS = ['avatar', 'bubble', 'username', 'chatContainer'];

const MASK_MODES = ['none', 'clipInside', 'clipOutside'];

// Determines where the decoration renders relative to the bubble's text content.
const STACK_LAYERS = ['foreground', 'background'];

// Valid role tokens for the per-layer visibility condition.
// 'moderator' — chỉ hiện với mod
// 'member'    — chỉ hiện với thành viên (+ có thể lọc thêm theo số tháng)
// 'chat'      — chỉ hiện với người xem thường (không có role nào)
// Mảng rỗng (mặc định) → hiện với tất cả, không lọc.
const VISIBILITY_ROLES = ['moderator', 'member', 'chat'];

// Idle animation options for sticker/decoration layers.
// 'none'   — không chạy idle (default)
// 'float'  — trôi lên xuống nhẹ
// 'bounce' — nảy lên xuống
// 'wiggle' — lắc ngang nhanh
// 'tilt'   — nghiêng qua lại chậm
// 'slideX' — trượt trái/phải nhẹ
const IDLE_ANIMATIONS = ['none', 'float', 'bounce', 'wiggle', 'tilt', 'slideX'];

const CONTAINER_ANCHOR = {
  'top-left':      { fx: 0,   fy: 0   },
  'top-right':     { fx: 1,   fy: 0   },
  'bottom-left':   { fx: 0,   fy: 1   },
  'bottom-right':  { fx: 1,   fy: 1   },
  'top-center':    { fx: 0.5, fy: 0   },
  'bottom-center': { fx: 0.5, fy: 1   },
  'center-left':   { fx: 0,   fy: 0.5 },
  'center-right':  { fx: 1,   fy: 0.5 },
  'center':        { fx: 0.5, fy: 0.5 },
  'custom':        { fx: 0,   fy: 0   },
};

const STICKER_ANCHOR = {
  'top-left':      { ax: 0,   ay: 0   },
  'top-right':     { ax: 1,   ay: 0   },
  'bottom-left':   { ax: 0,   ay: 1   },
  'bottom-right':  { ax: 1,   ay: 1   },
  'top-center':    { ax: 0.5, ay: 0   },
  'bottom-center': { ax: 0.5, ay: 1   },
  'center-left':   { ax: 0,   ay: 0.5 },
  'center-right':  { ax: 1,   ay: 0.5 },
  'center':        { ax: 0.5, ay: 0.5 },
  'custom':        { ax: 0,   ay: 0   },
};

const DEFAULT_MASK = {
  maskEnabled: false,
  maskTarget: 'avatar',
  maskMode: 'clipInside',
  maskPadding: 0,
  maskFeather: 0,
  maskInvert: false,
};

const DEFAULT_LAYER = {
  enabled: true,
  imageUrl: '',
  anchor: 'bubble',
  placement: 'bottom-left',
  translateX: -6,
  translateY: 6,
  rotate: 0,
  zIndex: 5,
  size: 48,
  width: 48,
  height: 48,
  opacity: 1,
  ...DEFAULT_MASK,
  stackLayer: 'foreground',
  // [] = hiện với tất cả (no filter). Non-empty = OR logic across tokens.
  visibilityRoles: [],
  memberMonthsMin: 0,
  // Idle animation effect for the sticker layer
  idleAnimation: 'none',
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

function normalizeMaskTarget(target) {
  return MASK_TARGETS.includes(target) ? target : DEFAULT_MASK.maskTarget;
}

function normalizeMaskMode(mode) {
  return MASK_MODES.includes(mode) ? mode : DEFAULT_MASK.maskMode;
}

function normalizeStackLayer(val) {
  return STACK_LAYERS.includes(val) ? val : DEFAULT_LAYER.stackLayer;
}

function normalizeIdleAnimation(val) {
  return IDLE_ANIMATIONS.includes(val) ? val : DEFAULT_LAYER.idleAnimation;
}

/** Normalizes the mask sub-properties of a layer; missing values fall back to sensible defaults. */
function normalizeMask(raw) {
  const m = raw || {};
  return {
    maskEnabled: m.maskEnabled === true,
    maskTarget: normalizeMaskTarget(m.maskTarget),
    maskMode: normalizeMaskMode(m.maskMode),
    maskPadding: clampNumber(m.maskPadding, DEFAULT_MASK.maskPadding, -100, 100),
    maskFeather: clampNumber(m.maskFeather, DEFAULT_MASK.maskFeather, 0, 100),
    maskInvert: m.maskInvert === true,
  };
}

function normalizeVisibilityRoles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => VISIBILITY_ROLES.includes(r));
}

function normalizeLayer(raw, index = 0) {
  const layer = raw || {};
  const id = typeof layer.id === 'string' && layer.id.trim() ? layer.id.trim() : `deco-${index}`;
  let rawSize;
  if (layer.width !== undefined && layer.width !== layer.size) {
    rawSize = layer.width;
  } else if (layer.height !== undefined && layer.height !== layer.size) {
    rawSize = layer.height;
  } else {
    rawSize = layer.size ?? layer.width ?? layer.height ?? 48;
  }
  const size = clampNumber(rawSize, 48, 8, 400);
  const rawUrl = typeof layer.imageUrl === 'string' ? layer.imageUrl.trim() : '';
  const imageUrl = normalizeGoogleDriveImageUrl(rawUrl);
  return {
    id,
    enabled: layer.enabled !== false,
    imageUrl,
    anchor: normalizeAnchor(layer.anchor),
    placement: normalizePlacement(layer.placement),
    translateX: clampNumber(layer.translateX, DEFAULT_LAYER.translateX, -500, 500),
    translateY: clampNumber(layer.translateY, DEFAULT_LAYER.translateY, -500, 500),
    rotate: clampNumber(layer.rotate, 0, -360, 360),
    zIndex: clampNumber(layer.zIndex, DEFAULT_LAYER.zIndex, -100, 500),
    size,
    width: size,
    height: size,
    opacity: clampNumber(layer.opacity, 1, 0, 1),
    // Flat-merged so existing saved layers (no mask keys at all) load with
    // maskEnabled: false and render exactly as before this feature existed.
    ...normalizeMask(layer),
    // Visibility condition — backward-compatible: missing key → [] → show all.
    visibilityRoles: normalizeVisibilityRoles(layer.visibilityRoles),
    memberMonthsMin: clampNumber(layer.memberMonthsMin, 0, 0, 120),
    stackLayer: normalizeStackLayer(layer.stackLayer),
    // Idle animation — backward-compatible: missing key → 'none'.
    idleAnimation: normalizeIdleAnimation(layer.idleAnimation),
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

// Inline style object for overlay DOM (browser) or smoke tests.
function compileLayerInlineStyle(layer) {
  const l = normalizeLayer(layer);
  const base = {
    position: 'absolute',
    zIndex: String(l.zIndex),
    opacity: String(l.opacity),
    width: `${l.size}px`,
    height: `${l.size}px`,
    objectFit: 'contain',
    pointerEvents: 'none',
  };
  const rot = `${l.rotate}deg`;
  const placement = CONTAINER_ANCHOR[l.placement] ? l.placement : 'custom';
  const { fx, fy } = CONTAINER_ANCHOR[placement];
  const { ax, ay } = STICKER_ANCHOR[placement];

  return {
    ...base,
    left: `calc(${fx * 100}% + ${l.translateX}px)`,
    top: `calc(${fy * 100}% + ${l.translateY}px)`,
    right: 'auto',
    bottom: 'auto',
    transform: `translate(${-ax * 100}%, ${-ay * 100}%) rotate(${rot})`,
    transformOrigin: `${ax * 100}% ${ay * 100}%`,
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
  MASK_TARGETS,
  MASK_MODES,
  STACK_LAYERS,
  VISIBILITY_ROLES,
  IDLE_ANIMATIONS,
  CONTAINER_ANCHOR,
  STICKER_ANCHOR,
  DEFAULT_MASK,
  DEFAULT_DECORATION_CONFIG,
  DEFAULT_LAYER,
  normalizeLayer,
  normalizePlacement,
  normalizeMaskTarget,
  normalizeMaskMode,
  normalizeMask,
  normalizeVisibilityRoles,
  normalizeIdleAnimation,
  normalizeDecorationConfig,
  mergeDecorationConfig,
  createLayer,
  compileLayerInlineStyle,
  compileLayerInlineStyleString,
};