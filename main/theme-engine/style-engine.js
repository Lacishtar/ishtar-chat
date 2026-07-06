/**
 * Style Engine (design doc §1.2 / §5.3 / §8 step 3).
 *
 * Compiles a ThemeDocument's `style` section (see
 * shared/theme-document.js#createStyle, and the style.json shape in the
 * design doc §5.3) into the CSS custom properties the overlay actually
 * renders with. This is the data-driven counterpart to what
 * shared/customize-config.js#toCssVariables() and
 * overlay/overlay-client.js#applyCssVariables() already do from the flat
 * CustomizeConfig — same variable names, same values, different input
 * shape (a style.json token tree instead of a flat object).
 *
 * SCOPE — intentionally narrow, matching main/theme-engine/legacy-adapter.js
 * #buildStyle()'s own comment: only the tokens that function currently
 * produces are compiled here (color.text/author/bubbleBg, font.family/size,
 * border.radius). Everything else CustomizeConfig still controls today
 * (bubbleOpacity, avatarSize, animationMs, showAvatar, showBadges, position,
 * maxMessages) belongs to the Layout/Animation engines or stays
 * flat-config-only for now — design doc §5.2 itself places "size" under
 * layout.json, not style.json, so avatarSize was never meant to live here.
 * See scripts/smoke-test-style-engine.js for the check that proves the
 * variables this DOES compile exactly match production values.
 *
 * NOTHING in the running app calls this yet — same status as
 * main/theme-engine/index.js and legacy-adapter.js after step 2. It exists
 * so a real Style Engine is provable before overlay-client.js's rendering
 * path is ever touched (that's refactor step 7).
 */

const { componentOverridesToSlotStyle, compileSlotStyleToCssVariables } = require('../../shared/slot-style-config');

function compileStyleToCssVariables(style) {
  const tokens = (style && style.tokens) || {};
  const color = tokens.color || {};
  const font = tokens.font || {};
  const border = tokens.border || {};

  const vars = {};
  if (font.family !== undefined) vars['--ovs-font-family'] = font.family;
  if (font.size !== undefined) vars['--ovs-font-size'] = `${font.size}px`;
  if (color.text !== undefined) vars['--ovs-text-color'] = color.text;
  if (color.author !== undefined) vars['--ovs-author-color'] = color.author;
  if (color.bubbleBg !== undefined) vars['--ovs-bubble-bg'] = color.bubbleBg;
  if (border.radius !== undefined) vars['--ovs-bubble-radius'] = `${border.radius}px`;

  const overrides = style && style.componentOverrides;
  if (overrides && Object.keys(overrides).length > 0) {
    const slotStyle = componentOverridesToSlotStyle(overrides);
    Object.assign(vars, compileSlotStyleToCssVariables(slotStyle, {
      fontFamily: font.family,
      fontSize: font.size,
      textColor: color.text,
      authorColor: color.author,
    }));
  }

  return vars;
}

/**
 * Renders a compiled variable map as a `:root { ... }` CSS block. This is
 * what a native *.ovstheme package's compiled style.css (design doc §4.3)
 * would be generated from, with any hand-authored "USER OVERRIDES" section
 * appended after it untouched.
 */
function compileStyleToCssText(style) {
  const vars = compileStyleToCssVariables(style);
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

module.exports = { compileStyleToCssVariables, compileStyleToCssText };
