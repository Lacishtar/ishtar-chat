/**
 * BubbleConfig — declarative bubble style for ThemeDocument.style.bubble.
 *
 * Render modes (BubbleFactory):
 *   color    — CSS background on .ovs-message (Style Engine tokens)
 *   gradient — CSS linear-gradient on bubble shell
 *
 * padding = content inset inside the border box
 */

const BUBBLE_TYPES = ['color', 'gradient'];

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
  padding: createEdgeInsets({ top: 16, right: 20, bottom: 16, left: 20 }),
  gradient: { ...DEFAULT_GRADIENT },
};

function clampInset(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
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

  return {
    type,
    padding: mergeEdgeInsets(b.padding, o.padding),
    gradient: mergeGradient(b.gradient, o.gradient),
  };
}

function isGradientBubbleActive(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  return b.type === 'gradient';
}

function resolveBubbleMode(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  if (b.type === 'gradient') return 'gradient';
  return 'color';
}

function px(n) {
  return `${Math.round(n)}px`;
}

/**
 * Compiles bubble config → CSS custom properties for overlay/bubble-engine.css.
 */
function compileBubbleToCssVariables(bubble) {
  const b = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, bubble);
  const p = b.padding;
  const mode = resolveBubbleMode(b);

  const grad = b.gradient;
  const gradientCss = `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`;

  return {
    '--ovs-bubble-mode': mode,
    '--ovs-bubble-pad-top': px(p.top),
    '--ovs-bubble-pad-right': px(p.right),
    '--ovs-bubble-pad-bottom': px(p.bottom),
    '--ovs-bubble-pad-left': px(p.left),
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
  isGradientBubbleActive,
  resolveBubbleMode,
  compileBubbleToCssVariables,
};
