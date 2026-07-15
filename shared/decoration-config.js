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

/**
 * Mask targets — the shape a decoration layer's clipping mask is derived
 * from. 'avatar', 'bubble', 'username', and 'chatContainer' are wired up to
 * real shape sources (see resolveMaskTargetElement in overlay-client.js);
 * 'bottomAccentBar', 'glowLayer', and 'customShape' remain reserved so
 * future work can add them without touching the schema, normalization, or
 * UI wiring again.
 */
const MASK_TARGETS = [
  'avatar',
  'bubble',
  'username',
  'chatContainer',
  'bottomAccentBar',
  'glowLayer',
  'customShape',
];

const MASK_MODES = ['none', 'clipInside', 'clipOutside'];

/**
 * Determines where the decoration renders relative to the bubble's text content.
 *   'foreground' — rendered above all slot content (z-index: 50). Default.
 *   'background' — rendered inside the bubble, UNDER text (z-index: -1,
 *                  clipped to the bubble's border-radius). Useful for bubble
 *                  background images, watermarks, and texture overlays.
 */
const STACK_LAYERS = ['foreground', 'background'];

/**
 * Valid role tokens for the per-layer visibility condition.
 *   'moderator' — chỉ hiện với mod
 *   'member'    — chỉ hiện với thành viên (+ có thể lọc thêm theo số tháng)
 *   'chat'      — chỉ hiện với người xem thường (không có role nào)
 * Mảng rỗng (mặc định) → hiện với tất cả, không lọc.
 */
const VISIBILITY_ROLES = ['moderator', 'member', 'chat'];

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
  width: 48,
  height: 48,
  opacity: 1,
  ...DEFAULT_MASK,
  // Determines z-axis render position relative to bubble text content.
  // 'foreground' = above text (z-index: 50); 'background' = below text,
  // clipped inside the bubble (z-index: -1, overflow: hidden).
  stackLayer: 'foreground',
  // Visibility condition — which role types this layer renders for.
  // [] = hiện với tất cả (no filter). Non-empty = OR logic across tokens.
  // 'member' token pairs with memberMonthsMin for month-threshold filtering.
  visibilityRoles: [],
  memberMonthsMin: 0,
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
    // Flat-merged so existing saved layers (no mask keys at all) load with
    // maskEnabled: false and render exactly as before this feature existed.
    ...normalizeMask(layer),
    // Visibility condition — backward-compatible: missing key → [] → show all.
    visibilityRoles: normalizeVisibilityRoles(layer.visibilityRoles),
    memberMonthsMin: clampNumber(layer.memberMonthsMin, 0, 0, 120),
    // Stack layer — backward-compatible: missing key → 'foreground' (existing behavior).
    stackLayer: normalizeStackLayer(layer.stackLayer),
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
  MASK_TARGETS,
  MASK_MODES,
  STACK_LAYERS,
  VISIBILITY_ROLES,
  DEFAULT_MASK,
  DEFAULT_DECORATION_CONFIG,
  DEFAULT_LAYER,
  normalizeLayer,
  normalizePlacement,
  normalizeMaskTarget,
  normalizeMaskMode,
  normalizeMask,
  normalizeVisibilityRoles,
  normalizeDecorationConfig,
  mergeDecorationConfig,
  createLayer,
  compileLayerInlineStyle,
  compileLayerInlineStyleString,
};