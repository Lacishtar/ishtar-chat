/**
 * Layout Engine (design doc §1.2 / §5.2 / §8 step 4).
 *
 * Compiles a ThemeDocument's `layout.settings` section (see
 * shared/layout-config.js) into CSS custom properties the overlay renders
 * with. Same variable names as shared/layout-config.js#compileLayoutToCssVariables
 * — this module is the theme-engine facade over that compiler.
 *
 * SCOPE — basic v0.2: flex direction, gap, alignment, padding, margin, and
 * slot order for Avatar / Username / Badges / Message. Does not change the
 * DOM renderer or template.html structure; themes consume the variables in
 * their existing style.css rules.
 */

const { compileLayoutToCssVariables, mergeLayoutConfig } = require('../../shared/layout-config');

function compileLayoutFromDocument(layout) {
  const settings = (layout && layout.settings) || layout || {};
  return compileLayoutToCssVariables(settings);
}

function compileLayoutToCssText(layout) {
  const vars = compileLayoutFromDocument(layout);
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

module.exports = {
  compileLayoutToCssVariables: compileLayoutFromDocument,
  compileLayoutToCssText,
  mergeLayoutConfig,
};
