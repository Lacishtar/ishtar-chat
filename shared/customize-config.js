/**
 * CustomizeConfig — the set of user-tunable visual properties that every
 * theme exposes. Themes may add extra keys in their own default-config.json,
 * but every theme MUST support this base set so the Customize Panel works
 * the same way regardless of which theme is active.
 */
const { toImageProxyUrl } = require('./image-url');

const DEFAULT_CUSTOMIZE_CONFIG = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 16, // px
  textColor: '#EAECEF',
  authorColor: '#6E56F0',
  bubbleBg: 'rgba(22, 25, 31, 0.72)',
  bubbleRadius: 14, // px
  bubbleOpacity: 1,
  bubbleBorderWidth: null, // px; null = theme default
  bubbleBorderStyle: null, // solid | dashed | dotted | none
  bubbleBorderColor: null,
  bubbleBoxShadow: null, // CSS shadow string
  bubbleGlow: null, // CSS filter: drop-shadow(...) string — neon/glow halo, independent of bubbleBoxShadow
  bubblePadding: null, // uniform px for bubble shell
  bubblePaddingX: null, // horizontal (left+right) shorthand — kept for backward compatibility
  bubblePaddingY: null, // vertical (top+bottom) shorthand — kept for backward compatibility
  bubblePaddingTop: null, // per-side override, falls back to bubblePaddingY
  bubblePaddingRight: null, // per-side override, falls back to bubblePaddingX
  bubblePaddingBottom: null, // per-side override, falls back to bubblePaddingY
  bubblePaddingLeft: null, // per-side override, falls back to bubblePaddingX
  bubbleTextureUrl: null,
  bubbleTextureSize: 'auto',
  bubbleTextureRepeat: 'repeat',
  bubbleTextureOpacity: 1,
  bubbleBunnyEars: false,
  bubbleBunnyEarsWidth: 32, // px
  bubbleBunnyEarsHeight: 30, // px
  bubbleBunnyEarsRoundness: 0, // 0-100 (%): 0 = ear/leaf shape, 100 = fully round blob
  bubbleBunnyEarsOffsetX: 20, // px inset from left/right edge of bubble
  bubbleBunnyEarsOffsetY: 28, // px the ears poke up above the bubble top
  bubbleBunnyEarsRotate: 0, // deg, tilts ears outward (mirrored L/R)
  bubbleBunnyEarsZIndex: -1, // stacking order vs. the bubble (negative = behind)
  bubbleMinWidth: 0,
  avatarSize: 32, // px
  showAvatar: true,
  showBadges: true,
  animationMs: 220,
  position: 'bottom-up', // 'bottom-up' | 'top-down'
  maxMessages: 40,
};

function isSet(value) {
  return value !== undefined && value !== null;
}

function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

function clampPct(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 100);
}

function compileBubbleDecorationToCssVariables(config) {
  const c = { ...DEFAULT_CUSTOMIZE_CONFIG, ...config };
  const vars = {};

  if (isSet(c.bubbleBorderWidth)) vars['--ovs-bubble-border-width'] = px(c.bubbleBorderWidth);
  if (isSet(c.bubbleBorderStyle)) vars['--ovs-bubble-border-style'] = c.bubbleBorderStyle;
  if (isSet(c.bubbleBorderColor)) vars['--ovs-bubble-border-color'] = c.bubbleBorderColor;
  if (isSet(c.bubbleBoxShadow)) vars['--ovs-bubble-box-shadow'] = c.bubbleBoxShadow;
  if (isSet(c.bubbleGlow)) vars['--ovs-bubble-glow'] = c.bubbleGlow;

  const padX = isSet(c.bubblePaddingX) ? c.bubblePaddingX : (isSet(c.bubblePadding) ? c.bubblePadding : null);
  const padY = isSet(c.bubblePaddingY) ? c.bubblePaddingY : (isSet(c.bubblePadding) ? c.bubblePadding : null);
  if (padX != null) vars['--ovs-bubble-pad-x'] = px(padX);
  if (padY != null) vars['--ovs-bubble-pad-y'] = px(padY);

  const padTop = isSet(c.bubblePaddingTop) ? c.bubblePaddingTop : padY;
  const padRight = isSet(c.bubblePaddingRight) ? c.bubblePaddingRight : padX;
  const padBottom = isSet(c.bubblePaddingBottom) ? c.bubblePaddingBottom : padY;
  const padLeft = isSet(c.bubblePaddingLeft) ? c.bubblePaddingLeft : padX;
  if (padTop != null) vars['--ovs-bubble-pad-top'] = px(padTop);
  if (padRight != null) vars['--ovs-bubble-pad-right'] = px(padRight);
  if (padBottom != null) vars['--ovs-bubble-pad-bottom'] = px(padBottom);
  if (padLeft != null) vars['--ovs-bubble-pad-left'] = px(padLeft);

  if (isSet(c.bubbleBunnyEarsWidth)) vars['--ovs-bunny-ears-width'] = px(c.bubbleBunnyEarsWidth);
  if (isSet(c.bubbleBunnyEarsHeight)) vars['--ovs-bunny-ears-height'] = px(c.bubbleBunnyEarsHeight);
  if (isSet(c.bubbleBunnyEarsRoundness)) {
    vars['--ovs-bunny-ears-radius-v'] = `${clampPct(c.bubbleBunnyEarsRoundness, 0)}%`;
  }
  if (isSet(c.bubbleBunnyEarsOffsetX)) vars['--ovs-bunny-ears-offset-x'] = px(c.bubbleBunnyEarsOffsetX);
  if (isSet(c.bubbleBunnyEarsOffsetY)) {
    vars['--ovs-bunny-ears-top'] = px(-Math.abs(Number(c.bubbleBunnyEarsOffsetY) || 0));
  }
  if (isSet(c.bubbleBunnyEarsRotate)) vars['--ovs-bunny-ears-rotate'] = `${Number(c.bubbleBunnyEarsRotate) || 0}deg`;
  if (isSet(c.bubbleBunnyEarsZIndex)) vars['--ovs-bunny-ears-z'] = String(Math.round(Number(c.bubbleBunnyEarsZIndex) || 0));

  return vars;
}

/**
 * Maps a CustomizeConfig object to the CSS custom properties the overlay
 * page and every theme's style.css read from. Keeping this mapping in one
 * place means adding a theme never requires touching the customize logic.
 */
function toCssVariables(config) {
  const c = { ...DEFAULT_CUSTOMIZE_CONFIG, ...config };
  return {
    '--ovs-font-family': c.fontFamily,
    '--ovs-font-size': `${c.fontSize}px`,
    '--ovs-text-color': c.textColor,
    '--ovs-author-color': c.authorColor,
    '--ovs-bubble-bg': c.bubbleBg,
    '--ovs-bubble-radius': `${c.bubbleRadius}px`,
    '--ovs-bubble-opacity': String(c.bubbleOpacity),
    '--ovs-avatar-size': `${c.avatarSize}px`,
    '--ovs-animation-ms': `${c.animationMs}ms`,
    '--ovs-bubble-texture-url': c.bubbleTextureUrl && typeof c.bubbleTextureUrl === 'string' && c.bubbleTextureUrl.trim()
      ? `url("${toImageProxyUrl(c.bubbleTextureUrl) || c.bubbleTextureUrl.trim()}")`
      : 'none',
    '--ovs-bubble-texture-repeat': c.bubbleTextureRepeat || 'repeat',
    '--ovs-bubble-texture-size': typeof c.bubbleTextureSize === 'number' ? px(c.bubbleTextureSize) : (c.bubbleTextureSize || 'auto'),
    '--ovs-bubble-texture-opacity': String(c.bubbleTextureOpacity ?? 1),
    ...compileBubbleDecorationToCssVariables(c),
  };
}

/**
 * Theme default-config.json files may carry metadata keys (currently just
 * `_label`, the display name) alongside real CustomizeConfig fields. Strip
 * those before merging into the live config so they don't leak into what
 * gets persisted to config.json or broadcast to the overlay/Customize Panel.
 */
function sanitizeThemeDefaults(themeDefaults) {
  const clean = {};
  Object.entries(themeDefaults || {}).forEach(([key, value]) => {
    if (!key.startsWith('_')) clean[key] = value;
  });
  return clean;
}

module.exports = {
  DEFAULT_CUSTOMIZE_CONFIG,
  toCssVariables,
  compileBubbleDecorationToCssVariables,
  sanitizeThemeDefaults,
};