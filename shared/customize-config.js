/**
 * CustomizeConfig — the set of user-tunable visual properties that every
 * theme exposes. Themes may add extra keys in their own default-config.json,
 * but every theme MUST support this base set so the Customize Panel works
 * the same way regardless of which theme is active.
 */
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
  bubblePadding: null, // uniform px for bubble shell
  bubblePaddingX: null,
  bubblePaddingY: null,
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

function compileBubbleDecorationToCssVariables(config) {
  const c = { ...DEFAULT_CUSTOMIZE_CONFIG, ...config };
  const vars = {};

  if (isSet(c.bubbleBorderWidth)) vars['--ovs-bubble-border-width'] = px(c.bubbleBorderWidth);
  if (isSet(c.bubbleBorderStyle)) vars['--ovs-bubble-border-style'] = c.bubbleBorderStyle;
  if (isSet(c.bubbleBorderColor)) vars['--ovs-bubble-border-color'] = c.bubbleBorderColor;
  if (isSet(c.bubbleBoxShadow)) vars['--ovs-bubble-box-shadow'] = c.bubbleBoxShadow;

  const padX = isSet(c.bubblePaddingX) ? c.bubblePaddingX : (isSet(c.bubblePadding) ? c.bubblePadding : null);
  const padY = isSet(c.bubblePaddingY) ? c.bubblePaddingY : (isSet(c.bubblePadding) ? c.bubblePadding : null);
  if (padX != null) vars['--ovs-bubble-pad-x'] = px(padX);
  if (padY != null) vars['--ovs-bubble-pad-y'] = px(padY);

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
