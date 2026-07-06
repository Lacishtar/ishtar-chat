/**
 * ThemeDocument — the canonical in-memory shape a theme resolves to,
 * combining manifest + layout + style + animation + rules into one object
 * (design doc §1.1 "a theme is a declarative document" / §4 package spec).
 *
 * This module owns ONLY the shape and safe defaults — no file I/O, no
 * theme-specific logic. Two things build a ThemeDocument:
 *   - main/theme-engine/legacy-adapter.js, for the 7 existing
 *     themes/<id>/ folders (synthesizes one from template.html +
 *     default-config.json — see that file for details)
 *   - later, main/theme-engine/loader.js, for real *.ovstheme packages
 *     (manifest.json/layout.json/style.json/animation.json/rules.json,
 *     design doc §4)
 * Both are expected to produce this exact same shape, so every later piece
 * (Style Engine, Layout Engine, Animation Engine, Rule Engine, Resolver)
 * can consume a legacy-adapted theme and a native package identically —
 * this is what design doc §1.1 point 5 ("plugins register, they don't
 * fork") depends on structurally.
 *
 * NOTHING in the running app calls this yet. It's pure data — introduced
 * now so the next refactor steps (Style/Layout/Animation/Rule engines)
 * have one real shape to build against, per the doc's refactor order (§8,
 * step 2). See scripts/smoke-test-legacy-themes.js for the check that
 * proves all 7 legacy themes adapt into this shape correctly.
 */

function createManifest(overrides = {}) {
  return {
    id: '',
    name: '',
    version: '0.0.0',
    schemaVersion: '1.0',
    author: null,
    createdWith: null,
    description: '',
    thumbnail: null,
    tags: [],
    compat: {
      requiredComponentPlugins: [],
      requiredAnimationPlugins: [],
      requiredRulePlugins: [],
    },
    ...overrides,
  };
}

function createLayout(overrides = {}) {
  return {
    schemaVersion: '1.0',
    root: null, // see design doc §5.2 for the container/component node shape
    overlays: {},
    ...overrides,
  };
}

function createStyle(overrides = {}) {
  return {
    schemaVersion: '1.0',
    tokens: {},
    componentOverrides: {},
    bubble: null, // see shared/bubble-config.js — filled by legacy-adapter / packages
    ...overrides,
  };
}

function createAnimation(overrides = {}) {
  return {
    schemaVersion: '1.0',
    targets: {},
    ...overrides,
  };
}

function createRules(overrides = {}) {
  return {
    schemaVersion: '1.0',
    rules: [],
    ...overrides,
  };
}

/**
 * Merges the five documents into one ThemeDocument. Each part is optional —
 * an omitted part falls back to an empty-but-structurally-valid default, so
 * a partially synthesized theme (e.g. a legacy theme with no rules yet) is
 * still a complete ThemeDocument. Nothing downstream should ever need to
 * null-check `.rules` or `.style` because a theme "didn't have one."
 */
function createThemeDocument({ manifest, layout, style, animation, rules } = {}) {
  return {
    manifest: createManifest(manifest),
    layout: createLayout(layout),
    style: createStyle(style),
    animation: createAnimation(animation),
    rules: createRules(rules),
  };
}

module.exports = {
  createManifest,
  createLayout,
  createStyle,
  createAnimation,
  createRules,
  createThemeDocument,
};
