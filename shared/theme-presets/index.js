/**
 * theme-presets/index.js — Built-in Theme Library (entry point).
 *
 * This module's public contract is unchanged from the old single-file
 * shared/theme-presets.js: it still exports `{ BUILTIN_THEMES }`, an array
 * of fully-specified theme objects. Everything else (shared/theme-manager.js
 * and any other consumer) keeps working with zero changes — Node resolves
 * `require('./theme-presets')` to this file automatically because the
 * directory shares the old file's name.
 *
 * What changed is internal organisation:
 *   - Each theme now lives in its own file under themes/<id>.js.
 *   - Shared builder functions (defaultRoles, defaultLayout, ...) live in
 *     helpers.js so themes can compose a baseline without duplicating it.
 *   - This file is just a registry: require each theme, list it below.
 *
 * To add a new built-in theme:
 *   1. Create shared/theme-presets/themes/<your-id>.js exporting a single
 *      theme object (see themes/default.js for the shape, or copy the
 *      closest existing theme as a starting point).
 *   2. Require it below and add it to the THEMES array, in the position
 *      you want it to appear in the UI.
 *
 * Rules (unchanged from the original file):
 *   - NO DOM, NO rendering logic, NO UI references here or in themes/*.js.
 *   - Keys must match the exact property names used by the shared configs:
 *       customizeConfig   — shared/customize-config.js#DEFAULT_CUSTOMIZE_CONFIG
 *       layoutConfig      — shared/layout-config.js#DEFAULT_LAYOUT_CONFIG
 *       slotStyleConfig   — shared/slot-style-config.js#DEFAULT_SLOT_STYLE_CONFIG
 *       animationConfig   — shared/animation-config.js#DEFAULT_ANIMATION_CONFIG
 *       decorationConfig  — shared/decoration-config.js#DEFAULT_DECORATION_CONFIG
 *       roleStyleConfig   — shared/role-style-config.js#DEFAULT_ROLE_STYLE_CONFIG
 *       fanServiceConfig  — shared/fan-service-config.js#DEFAULT_FAN_SERVICE_CONFIG
 *         (build with helpers.js#defaultThemeFanService — every built-in theme
 *         ships its own Super Chat/Membership look now, see that helper's
 *         comment and docs/refactor-superchat-to-fanservice.md Open Question OQ-1)
 *   - All seven categories must be fully specified on every theme (no partial
 *     overrides) so ThemeManager.NormalizeTheme() can rely on completeness.
 *   - Do NOT hardcode themes anywhere else in the codebase — import from here.
 */

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
  require('./themes/edgy'),
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { BUILTIN_THEMES: THEMES };
