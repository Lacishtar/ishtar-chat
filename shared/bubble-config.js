/**
 * BubbleConfig — declarative bubble style for ThemeDocument.style.bubble.
 *
 * Render modes (BubbleFactory):
 *   color    — CSS background on .ovs-message (Style Engine tokens)
 *   gradient — CSS linear-gradient on bubble shell
 *   image    — PNG nine-patch via 9-region CSS grid (overlay/bubble/)
 *
 * slice   = source-image pixels (corners never stretch)
 * padding = content inset inside the border box
 * scale   = display multiplier for border widths
 */

const BUBBLE_TYPES = ['color', 'gradient', 'image'];

const { clampSlicesToImage } = require('./bubble-slice-utils');

function createEdgeInsets(overrides = {}) {
  return { top: 24, right: 24, bottom: 24, left: 24, ...overrides };
}

const DEFAULT_GRADIENT = {
  angle: 135,
  from: '#6E56F0',
  to: 'rgba(22, 25, 31, 0.92)',
};

const DEFAULT_BUBBLE_CONFIG = {
  type: 'color',
  image: null,
  slice: createEdgeInsets(),
  padding: createEdgeInsets({ top: 16, right: 20, bottom: 16, left: 20 }),
  scale: 1,
  gradient: { ...DEFAULT_GRADIENT },
};

function clampInset(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function clampScale(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 0.25), 3);
}

function mergeEdgeInsets(base, overrides) {
  const b = base || createEdgeInsets();
  const o = overrides || {};
  return {
    top: clampInset(o.top, b.top),
    right: clampInset(o.right, b.right),
    bottom: clampInset(o.bottom, b.bottom),
    left: clampInset(o.left, b.left),
  };
}

function normalizeBubbleType(type, fallback = 'color') {
  if (BUBBLE_TYPES.includes(type)) return type;
  return fallback;
}

function normalizeImagePath(image) {
  if (image == null || image === '') return null;
  if (typeof image === 'string') return image;
  if (typeof image === 'object' && typeof image.asset === 'string') return image.asset;
  return null;
}

function mergeGradient(base, overrides) {
  const b = { ...DEFAULT_GRADIENT, ...(base || {}) };
  const o = overrides || {};
  return {
    angle: Number.isFinite(Number(o.angle)) ? Number(o.angle) : b.angle,
    from: typeof o.from === 'string' ? o.from : b.from,
    to: typeof o.to === 'string' ? o.to : b.to,
  };
}

function mergeBubbleConfig(base, overrides) {
  const b = base || DEFAULT_BUBBLE_CONFIG;
  const o = overrides || {};
  const type = o.type !== undefined ? normalizeBubbleType(o.type, b.type) : b.type;
  const image =
    o.image !== undefined ? normalizeImagePath(o.image) : normalizeImagePath(b.image);

  return {
    type,
    image,
    slice: mergeEdgeInsets(b.slice, o.slice),
    padding: mergeEdgeInsets(b.padding, o.padding),
    scale: o.scale !== undefined ? clampScale(o.scale, b.scale) : b.scale,
    gradient: mergeGradient(b.gradient, o.gradient),
  };
}

function isImageBubbleActive(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  return b.type === 'image' && typeof b.image === 'string' && b.image.length > 0;
}

function isGradientBubbleActive(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  return b.type === 'gradient';
}

function resolveBubbleMode(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  if (b.type === 'image' && b.image) return 'image';
  if (b.type === 'gradient') return 'gradient';
  return 'color';
}

function px(n) {
  return `${Math.round(n)}px`;
}

/**
 * Compiles bubble config → CSS custom properties for overlay/bubble-engine.css.
 * Keep in sync with overlay/bubble/compiler.js (browser).
 */
function compileBubbleToCssVariables(bubble, imageSize = {}) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  const s =
    imageSize.width && imageSize.height
      ? clampSlicesToImage(b.slice, imageSize)
      : b.slice;
  const p = b.padding;
  const scale = b.scale;
  const mode = resolveBubbleMode(b);
  const activeImage = mode === 'image';

  const imgW = imageSize.width || 1;
  const imgH = imageSize.height || 1;
  const borderTop = s.top * scale;
  const borderRight = s.right * scale;
  const borderBottom = s.bottom * scale;
  const borderLeft = s.left * scale;
  const paintedW = imgW * scale;
  const paintedH = imgH * scale;

  const grad = b.gradient;
  const gradientCss = `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`;

  return {
    '--ovs-bubble-mode': mode,
    '--ovs-bubble-scale': String(scale),
    '--ovs-bubble-slice-top': String(s.top),
    '--ovs-bubble-slice-right': String(s.right),
    '--ovs-bubble-slice-bottom': String(s.bottom),
    '--ovs-bubble-slice-left': String(s.left),
    '--ovs-bubble-border-top': px(borderTop),
    '--ovs-bubble-border-right': px(borderRight),
    '--ovs-bubble-border-bottom': px(borderBottom),
    '--ovs-bubble-border-left': px(borderLeft),
    '--ovs-bubble-pad-top': px(p.top),
    '--ovs-bubble-pad-right': px(p.right),
    '--ovs-bubble-pad-bottom': px(p.bottom),
    '--ovs-bubble-pad-left': px(p.left),
    '--ovs-bubble-img-w': px(imgW),
    '--ovs-bubble-img-h': px(imgH),
    '--ovs-bubble-img-w-raw': String(imgW),
    '--ovs-bubble-img-h-raw': String(imgH),
    '--ovs-bubble-painted-w': px(paintedW),
    '--ovs-bubble-painted-h': px(paintedH),
    '--ovs-bubble-image-url': activeImage ? `url("${b.image}")` : 'none',
    '--ovs-bubble-gradient': gradientCss,
  };
}

module.exports = {
  BUBBLE_TYPES,
  DEFAULT_BUBBLE_CONFIG,
  DEFAULT_GRADIENT,
  createEdgeInsets,
  mergeBubbleConfig,
  mergeEdgeInsets,
  mergeGradient,
  normalizeImagePath,
  isImageBubbleActive,
  isGradientBubbleActive,
  resolveBubbleMode,
  clampSlicesToImage,
  compileBubbleToCssVariables,
};
