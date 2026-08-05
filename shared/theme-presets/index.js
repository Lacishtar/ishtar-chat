// theme-presets/index.js — Built-in Theme Library (entry point).

const THEMES = [
  require('./themes/default'),
  require('./themes/minimal-white'),
  require('./themes/minimal-dark'),
  require('./themes/discord'),
  require('./themes/pastel-pink'),
  require('./themes/glassmorphism'),
  require('./themes/cute-bubble'),
  require('./themes/anime'),
  require('./themes/vtuber-cute'),
  require('./themes/night-sky'),
  require('./themes/cute'),
  require('./themes/retro'),
  require('./themes/neon'),
  require('./themes/maid'),
  require('./themes/ca-phe'),
  require('./themes/karaoke'),
  require('./themes/ticker-news'),
];

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

module.exports = { BUILTIN_THEMES: THEMES };
