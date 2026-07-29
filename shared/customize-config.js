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
  textAlign: 'left',
  textColor: '#EAECEF',
  authorColor: '#6E56F0',
  textGlow: null, // CSS filter: drop-shadow(...) string — glow halo around author/message text
  textStrokeWidth: 0, // px — outline thickness around the text glyphs
  textStrokeColor: null, // stroke color; falls back to '#000000' when width > 0 and no color chosen yet
  bubbleBg: 'rgba(22, 25, 31, 0.72)',
  bubbleRadius: 14, // px
  bubbleOpacity: 1,
  bubbleBorderWidth: null, // px; null = theme default
  bubbleBorderStyle: null, // solid | dashed | dotted | none
  bubbleBorderColor: null,
  bubbleBorderOffset: null, // px; outline-offset equivalent — push the ring outside(+)/inside(-) the bubble edge
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
  bubbleTexturePositionX: 50, // % (0 = left edge, 100 = right edge) — horizontal axis of the texture
  bubbleTexturePositionY: 50, // % (0 = top edge, 100 = bottom edge) — vertical axis of the texture
  bubbleTextureBlendMode: 'normal', // CSS mix-blend-mode — how the texture blends with bubbleBg beneath it
  bubbleBunnyEars: false,
  bubbleBunnyEarsWidth: 32, // px
  bubbleBunnyEarsHeight: 30, // px
  bubbleBunnyEarsRoundness: 0, // 0-100 (%): 0 = ear/leaf shape, 100 = fully round blob
  bubbleBunnyEarsOffsetX: 20, // px inset from left/right edge of bubble
  bubbleBunnyEarsOffsetY: 28, // px the ears poke up above the bubble top
  bubbleBunnyEarsRotate: 0, // deg, tilts ears outward (mirrored L/R)
  bubbleBunnyEarsZIndex: -1, // stacking order vs. the bubble (negative = behind)
  bubbleMinWidth: 0,
  bubbleMaxWidth: 0, // 0 = no cap
  bubbleFixedWidth: 0, // 0 = auto / fit-content
  bubbleMinHeight: 0,
  bubbleMaxHeight: 0, // 0 = no cap
  bubbleFixedHeight: 0, // 0 = auto
  avatarSize: 32, // px
  showAvatar: true,
  showBadges: false,
  animationMs: 220,
  position: 'bottom-up', // 'bottom-up' | 'top-down'
  maxMessages: 40,
  // Pool Warmup — how many Bubble DOM nodes overlay/modules/pool/PoolManager.js
  // pre-builds into the Object Pool right after the app boots, so the very
  // first messages (and the very first messages after a theme switch) reuse
  // an already-built, hidden bubble node instead of paying factory() cost
  // inline once the stream starts. This is a floor, not a ceiling: if the
  // Pool ever runs dry mid-stream it's still allowed to grow past this by
  // building new nodes on demand (see BubblePool#acquire) — there's no hard
  // cap on live growth, only on how much stays IDLE long-term. See
  // overlay/modules/pool/PoolConfig.js#DEFAULT_WARMUP_SIZE for the
  // engine-level fallback used when this is unset.
  poolWarmupSize: 20,
  // 'stack' = normal chat feed (bubbles stack up/down, see `position`).
  // 'danmaku' = bullet-comment mode: each message flies across the screen
  // once (Niconico/Bilibili style) instead of stacking.
  // 'ticker' = continuous horizontal scrolling marquee/ticker with queuing.
  // Handled client-side by overlay/modules/special-modes.js — see
  // overlay/modules/state.js#getDisplayMode / #syncThemeModeClass for the
  // switch-over logic.
  displayMode: 'stack', // 'stack' | 'danmaku' | 'ticker'
  danmakuSpeed: 1, // speed multiplier for danmaku flight — 1 = default, >1 faster, <1 slower
  danmakuLanes: 12, // number of horizontal lanes danmaku bullets cycle through
  // How much of the screen height danmaku lanes are allowed to use, as a
  // margin (%) kept clear at the top and bottom respectively. Raising these
  // shrinks the flyable band so bullets can't land right at the very edge
  // (e.g. behind a webcam/alert overlay, or just too close together near
  // the top/bottom for comfortable reading). Independent top/bottom values
  // let users protect only the edge that actually overlaps other overlays.
  danmakuAreaTopPct: 4,
  danmakuAreaBottomPct: 4,
  tickerSpeed: 1, // speed multiplier for ticker scroll — 1 = default (~120px/s)
  tickerGap: 32, // gap (px) between consecutive ticker message items
  tickerPosition: 'bottom', // 'bottom' | 'top'
  idleAnimation: 'none', // 'none' | 'float' | 'slidex' — shimmer is separate now (see idleShimmerEnabled), because unlike this select, shimmer isn't mutually exclusive with float/slidex: it animates via ::after (background-position sweep), never touches `transform`, so it never fights the transform-based float/slidex keyframes on the same element.
  idleAnimationSpeed: 3, // duration in seconds — smaller = faster (float/slidex only)
  idleAnimationIntensity: 5, // amplitude in px (float/slidex only)
  idleShimmerEnabled: false, // independent on/off — can run at the same time as float or slidex
  idleShimmerSpeed: 3, // duration in seconds — smaller = faster
  idleShimmerIntensity: 5, // 0-20, mapped to a 0-0.2 opacity range for the sweep highlight
  // Emoji-only messages get each glyph wrapped in its own square "chip"
  // (see overlay/modules/emoji.js + overlay/layout-text.css .ovs-emoji-glyph).
  // These four fields are the chip's full customizable surface: background
  // (color/gradient via the same rgba/gradient string bubbleBg uses),
  // corner rounding, overall opacity, and an optional glow halo (same
  // `filter: drop-shadow(...)` string shape as bubbleGlow/textGlow).
  emojiGlyphEnabled: true, // master on/off for the chip decoration — false strips bg/radius/opacity/glow but never touches the emoji glyph itself (size/position/content are set directly in CSS, not via these vars)
  emojiGlyphBg: 'rgba(255, 255, 255, 0.1)',
  emojiGlyphRadius: 6, // px
  emojiGlyphOpacity: 1,
  emojiGlyphGlow: null, // CSS filter: drop-shadow(...) string, or null = no glow
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

/**
 * Builds a combined CSS text-shadow value from glow + stroke config.
 *
 * Replaces the old `filter: drop-shadow()` + `-webkit-text-stroke` approach:
 *  - filter: collides with --ovs-bubble-glow / --ovs-slot-*-bubble-glow in
 *    wrap-bubble mode (bubble-wrap.css applies `filter` directly on .ovs-author
 *    and .ovs-text with higher specificity, completely clobbering any text-glow
 *    filter set by the theme)
 *  - -webkit-text-stroke: renders inconsistently/jaggedly across fonts and
 *    eats into the glyph interior rather than extending outward
 *
 * Both effects are expressed as text-shadow layers instead — a separate CSS
 * property that never conflicts with filter.
 *
 * Stroke is rendered as an 8-direction offset faux-outline, which extends
 * outside the glyph (unlike -webkit-text-stroke which cuts inward), so even
 * thick strokes don't affect letterform readability.
 *
 * @param {string|null} glow        - CSS filter drop-shadow() string, e.g.
 *                                    "drop-shadow(0 0 8px rgba(100,200,255,0.8))"
 *                                    (same format used by the bubble glow UI)
 * @param {number}      strokeWidth - outline thickness in px (0 = no stroke)
 * @param {string|null} strokeColor - outline color; defaults to '#000000'
 * @returns {string} CSS text-shadow value, or 'none'
 */
function buildTextShadow(glow, strokeWidth, strokeColor) {
  const parts = [];

  // Stroke — 8-direction faux-outline via text-shadow offsets.
  const w = Number(strokeWidth) || 0;
  if (w > 0) {
    const sc = strokeColor || '#000000';
    [
      [-w, -w], [ 0, -w], [ w, -w],
      [-w,  0],            [ w,  0],
      [-w,  w], [ 0,  w], [ w,  w],
    ].forEach(([dx, dy]) => parts.push(`${dx}px ${dy}px 0 ${sc}`));
  }

  // Glow — text-shadow uses the same "x y blur color" syntax as drop-shadow(),
  // so just strip the function wrapper to reuse the stored filter string.
  // Walk paren depth manually because the color may itself be rgba(...) or
  // oklch(...), which would trip up a naive [^)]+ regex.
  if (glow && typeof glow === 'string') {
    const prefix = 'drop-shadow(';
    const start = glow.indexOf(prefix);
    if (start !== -1) {
      let depth = 1;
      let i = start + prefix.length;
      while (i < glow.length && depth > 0) {
        if (glow[i] === '(') depth++;
        else if (glow[i] === ')') { if (--depth === 0) break; }
        i++;
      }
      const inner = glow.slice(start + prefix.length, i).trim();
      if (inner) parts.push(inner);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'none';
}

function compileBubbleDecorationToCssVariables(config) {
  const c = { ...DEFAULT_CUSTOMIZE_CONFIG, ...config };
  const vars = {};

  if (isSet(c.bubbleBorderWidth)) vars['--ovs-bubble-border-width'] = px(c.bubbleBorderWidth);
  if (isSet(c.bubbleBorderStyle)) vars['--ovs-bubble-border-style'] = c.bubbleBorderStyle;
  if (isSet(c.bubbleBorderColor)) vars['--ovs-bubble-border-color'] = c.bubbleBorderColor;
  if (isSet(c.bubbleBorderOffset)) vars['--ovs-bubble-border-offset'] = px(c.bubbleBorderOffset);
  if (isSet(c.bubbleBoxShadow)) vars['--ovs-bubble-box-shadow'] = c.bubbleBoxShadow;
  if (isSet(c.bubbleGlow)) vars['--ovs-bubble-glow'] = c.bubbleGlow;

  // Emoji chip (.ovs-emoji-glyph) — bg/radius/opacity/glow are ALWAYS emitted
  // (never conditionally omitted) so that toggling any of them off actually
  // resets the live CSS variable on :root. The applier (css-variables.js)
  // only calls setProperty for keys present in the compiled vars object; a
  // key that's skipped here just leaves whatever value was set on a
  // *previous* render sitting on :root forever — e.g. turning "glow" off
  // used to leave the old drop-shadow() filter applied indefinitely because
  // this used to only emit the key when emojiGlyphGlow was non-null.
  //
  // emojiGlyphEnabled is the master switch for the chip's *decoration* only
  // — it never touches the emoji glyph itself (the glyph's size/position/
  // content come from fixed rules in layout-text.css, not from these vars),
  // so flipping it off just strips the chip's background/radius/opacity/glow
  // back to neutral values while the emoji stays exactly where it was.
  const emojiChipEnabled = c.emojiGlyphEnabled !== false;
  vars['--ovs-emoji-glyph-bg'] = emojiChipEnabled ? (isSet(c.emojiGlyphBg) ? c.emojiGlyphBg : 'rgba(255, 255, 255, 0.1)') : 'transparent';
  vars['--ovs-emoji-glyph-radius'] = emojiChipEnabled ? px(isSet(c.emojiGlyphRadius) ? c.emojiGlyphRadius : 6) : '0px';
  vars['--ovs-emoji-glyph-opacity'] = emojiChipEnabled
    ? String(clampPct(Number(c.emojiGlyphOpacity ?? 1) * 100, 100) / 100)
    : '1';
  vars['--ovs-emoji-glyph-glow'] = emojiChipEnabled && isSet(c.emojiGlyphGlow) ? c.emojiGlyphGlow : 'none';

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

  // Bubble texture — single source of truth for the global texture layer.
  // Previously this exact mapping was hand-duplicated in toCssVariables()
  // below AND in overlay/modules/css-variables.js (the client-side applier),
  // which meant any new texture field had to be added in three places to
  // actually work end-to-end. It's compiled once here now; both call sites
  // just spread compileBubbleDecorationToCssVariables(cfg) and pick it up.
  vars['--ovs-bubble-texture-url'] = c.bubbleTextureUrl && typeof c.bubbleTextureUrl === 'string' && c.bubbleTextureUrl.trim()
    ? `url("${toImageProxyUrl(c.bubbleTextureUrl) || c.bubbleTextureUrl.trim()}")`
    : 'none';
  vars['--ovs-bubble-texture-repeat'] = c.bubbleTextureRepeat || 'repeat';
  vars['--ovs-bubble-texture-size'] = typeof c.bubbleTextureSize === 'number' ? px(c.bubbleTextureSize) : (c.bubbleTextureSize || 'auto');
  // Opacity is stored as a 0-1 float but the UI now round-trips it through a
  // whole-percent number field, so snap to 2 decimal places here — without
  // this, repeated slider/number-field edits could accumulate float noise
  // like 0.6699999999999999 in the saved config.
  vars['--ovs-bubble-texture-opacity'] = String(Math.round(clampPct(Number(c.bubbleTextureOpacity ?? 1) * 100, 100)) / 100);
  // X/Y axis position, each independently clamped to 0-100%.
  const texPosX = clampPct(c.bubbleTexturePositionX, 50);
  const texPosY = clampPct(c.bubbleTexturePositionY, 50);
  vars['--ovs-bubble-texture-position'] = `${texPosX}% ${texPosY}%`;
  vars['--ovs-bubble-texture-blend'] = c.bubbleTextureBlendMode || 'normal';

  return vars;
}

/**
 * Maps a CustomizeConfig object to the CSS custom properties the overlay
 * page and every theme's style.css read from. Keeping this mapping in one
 * place means adding a theme never requires touching the customize logic.
 */
function toCssVariables(config) {
  const c = { ...DEFAULT_CUSTOMIZE_CONFIG, ...config };

  // Idle animation amplitude — px, float/slidex only now.
  const idleIntensity = Number.isFinite(Number(c.idleAnimationIntensity)) ? Number(c.idleAnimationIntensity) : 5;
  // Shimmer has its own independent speed/intensity — see idleShimmerEnabled comment above.
  const idleShimmerIntensity = Number.isFinite(Number(c.idleShimmerIntensity)) ? Number(c.idleShimmerIntensity) : 5;
  const idleShimmerOpacity = Math.round(Math.min(Math.max(idleShimmerIntensity, 0), 20) * 10) / 1000; // 0–0.2 range

  return {
    '--ovs-font-family': c.fontFamily,
    '--ovs-text-align': c.textAlign,
    '--ovs-font-size': `${c.fontSize}px`,
    '--ovs-text-color': c.textColor,
    '--ovs-author-color': c.authorColor,
    '--ovs-text-shadow': buildTextShadow(c.textGlow, c.textStrokeWidth, c.textStrokeColor),
    '--ovs-bubble-bg': c.bubbleBg,
    '--ovs-bubble-radius': `${c.bubbleRadius}px`,
    '--ovs-bubble-opacity': String(c.bubbleOpacity),
    '--ovs-avatar-size': `${c.avatarSize}px`,
    '--ovs-animation-ms': `${c.animationMs}ms`,
    '--ovs-idle-animation-duration': `${Number.isFinite(Number(c.idleAnimationSpeed)) ? Number(c.idleAnimationSpeed) : 3}s`,
    '--ovs-idle-float-amplitude': `-${Math.abs(idleIntensity)}px`,
    '--ovs-idle-slidex-amplitude': `${Math.abs(idleIntensity)}px`,
    '--ovs-idle-shimmer-duration': `${Number.isFinite(Number(c.idleShimmerSpeed)) ? Number(c.idleShimmerSpeed) : 3}s`,
    '--ovs-idle-shimmer-opacity': String(idleShimmerOpacity),
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
  buildTextShadow,
  toCssVariables,
  compileBubbleDecorationToCssVariables,
  sanitizeThemeDefaults,
};