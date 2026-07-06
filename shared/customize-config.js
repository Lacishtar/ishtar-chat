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
  avatarSize: 32, // px
  showAvatar: true,
  showBadges: true,
  animationMs: 220,
  position: 'bottom-up', // 'bottom-up' | 'top-down'
  maxMessages: 40,
};

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

module.exports = { DEFAULT_CUSTOMIZE_CONFIG, toCssVariables, sanitizeThemeDefaults };
