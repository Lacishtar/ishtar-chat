/**
 * Palette Lock Engine — shared/palette-lock.js
 *
 * Enforces a user-defined color palette (2–5 hex colors) across all 4 config buckets:
 *   1. customizeConfig (global theme appearance & text styling)
 *   2. roleStyleConfig (moderator & member role overrides & member tier badges)
 *   3. fanServiceConfig (Super Chat & Membership dedicated events)
 *   4. slotStyleConfig (per-slot avatar/author/message overrides — this is also
 *      where "Chia đôi bubble kiểu YouTube" header/body split colors live, via
 *      slots.author.bubbleBg / slots.message.bubbleBg; see shared/layout-config.js)
 *
 * Header/body split (layoutConfig.screen.headerSplit === true):
 *   Unlike every other slotStyleConfig surface field (only snapped when the
 *   user already set it), slots.author.bubbleBg / slots.message.bubbleBg are
 *   FORCE-ASSIGNED to two distinct palette entries whenever headerSplit is
 *   on — even if both were still at their default `null`. Leaving them
 *   untouched (the old behavior) meant a user who never manually opened
 *   "🖌️ Bubble riêng" got a Palette Lock that visibly recolored every role
 *   (mod/member) bubble but left the header/body split flat on the old
 *   default color — Palette Lock claiming to "apply the palette" while
 *   silently skipping a feature the user has explicitly turned on. When
 *   headerSplit is off, these two fields fall back to the normal
 *   snap-only-if-set behavior alongside every other slot field.
 *
 *   IMPORTANT: whether headerSplit is "on" is evaluated against the LIVE
 *   `bundle.layoutConfig` argument, never against `options.baselineBundle`.
 *   The baseline exists only to anchor color VALUES against drift across
 *   repeated re-locks — it can be stale relative to structural toggles the
 *   user flipped after the baseline was captured (e.g. turning the split on,
 *   then re-locking). Gating on stale structural state would silently skip
 *   the split and leave both bands on the same inherited color — visually
 *   indistinguishable from a bug. See scripts/smoke-test-palette-lock.js
 *   Test 9.
 *
 * Processing logic:
 *   a) Surface fields (backgrounds, borders, shadows, glows, texture bg...):
 *      Snapped to the CLOSEST palette color via Euclidean distance in sRGB space.
 *      Retains original alpha channel if color is in rgba() format.
 *      Nested color tokens inside complex CSS strings (e.g. drop-shadow, box-shadow)
 *      are snapped individually while preserving non-color structural CSS.
 *
 *   b) Text fields (text color, author name, Super Chat author/message...):
 *      Evaluated against their specific background color using W3C WCAG relative luminance
 *      contrast ratios.
 *      - Normal text: target threshold ≥ 4.5:1
 *      - Large / Bold text (author names, tier badges, member months): target threshold ≥ 3.0:1
 *      If any palette color meets the threshold, the highest contrast color from the palette is selected.
 *      If NO palette color meets the threshold, falls back to #FFFFFF or #000000 (whichever yields higher contrast).
 *
 * Side effects (non-color fields mutated by this engine — NOT simple color snaps):
 *   - fanServiceConfig.superchat.useTierColor: forced to `false` whenever the palette
 *     has ≥4 colors, because Super Chat's "tier color" mode (useTierColor: true) reads
 *     the actual YouTube-assigned tier color at render time (CSS var with a hardcoded
 *     `#fde047` fallback) and would otherwise ignore the locked palette entirely.
 *     This toggle is fully reversible: every call to applyPaletteLock() recomputes it
 *     from scratch (false for ≥4 colors, true otherwise) instead of only ever setting
 *     it once, so re-locking with a shorter palette — or the caller restoring the
 *     baseline snapshot — puts it back the way it was.
 *     When forced to `false`, `superchat.authorColor` is guaranteed to already hold a
 *     WCAG-checked palette color (computed right here, not deferred to Step 4) because
 *     fan-service-config.js's amount-badge/author color falls back to `authorColor` in
 *     that mode — leaving it unset would silently show the non-palette `#fde047` fallback.
 */

const { isRowBubbleWrap } = require('./layout-config');

// ── 1. EXPLICIT FIELD MAPPINGS FROM SOURCE CONFIG FILES ─────────────────────

/**
 * Surface fields in customizeConfig (shared/customize-config.js).
 * Values are colors or CSS color-containing strings snapped via Euclidean RGB distance.
 */
const CUSTOMIZE_SURFACE_FIELDS = [
  'bubbleBg',           // Main bubble background (Primary background color for contrast)
  'bubbleBorderColor',   // Bubble outline border color
  'bubbleBoxShadow',     // Bubble box-shadow string (e.g. "0 4px 12px rgba(...)")
  'bubbleGlow',          // Bubble drop-shadow filter string
  'emojiGlyphBg',        // Emoji chip background
  'emojiGlyphGlow',      // Emoji chip drop-shadow filter string
  'textGlow',            // Author/message text drop-shadow filter string
  'textStrokeColor',     // Text outline stroke color
];

/**
 * Text fields in customizeConfig (shared/customize-config.js).
 * Each entry specifies:
 *   - field: property name
 *   - targetThreshold: WCAG contrast ratio target (4.5:1 for normal text, 3.0:1 for bold/large)
 *   - bgResolver: function to resolve background color for WCAG calculation
 */
const CUSTOMIZE_TEXT_FIELDS = [
  {
    field: 'textColor',
    targetThreshold: 4.5,
    // Message body text renders on bubbleBg
    getBg: (config) => config.bubbleBg,
  },
  {
    field: 'authorColor',
    targetThreshold: 3.0, // Author name is bold
    // Author name renders on bubbleBg
    getBg: (config) => config.bubbleBg,
  },
];

/**
 * Surface fields in roleStyleConfig (shared/role-style-config.js) per role.
 */
const ROLE_SURFACE_FIELDS = [
  'messageBg',           // Background of role message bubble
  'messageBorderColor',   // Border color of role message bubble
  'authorBg',            // Background behind author name tag inside role
  'authorBorderColor',   // Border around author name tag
  'rowBg',               // Row-level background
  'rowBorderColor',      // Row-level border color
  'earColor',            // Bunny ear color for role
];

/**
 * Surface fields in slotStyleConfig (shared/slot-style-config.js) per slot.
 * Applies to all 3 slots (avatar, author, message) — fields that don't exist
 * on a given slot are simply skipped (see the `slot[field] != null` guard at
 * the call site).
 */
const SLOT_SURFACE_FIELDS = [
  'bubbleBg',           // Slot-level bubble background override
  'bubbleBorderColor',  // Slot-level bubble border color override
  'bubbleBoxShadow',    // Slot-level bubble box-shadow string (author/message)
  'bubbleGlow',         // Slot-level bubble drop-shadow filter string (author/message)
  'borderColor',        // Slot element border color (e.g. avatar border)
  'glow',               // Text drop-shadow filter string (author/message)
  'strokeColor',        // Text outline stroke color (author/message)
];

/**
 * Text fields in slotStyleConfig (shared/slot-style-config.js) for the
 * author/message slots. Mirrors ROLE_TEXT_FIELDS: only touches the field when
 * the user has already set a per-slot override (`!= null`) — a slot left at
 * its default `null` keeps inheriting customizeConfig.authorColor/textColor,
 * which is already snapped via CUSTOMIZE_TEXT_FIELDS.
 */
const SLOT_TEXT_FIELDS = [
  {
    slotKey: 'author',
    field: 'color',
    targetThreshold: 3.0, // Author name is bold
    // Renders on the slot's own bubble override if set, else the global bubbleBg
    getBg: (slot, globalBubbleBg) => slot.bubbleBg || globalBubbleBg,
  },
  {
    slotKey: 'message',
    field: 'color',
    targetThreshold: 4.5, // Message text is normal weight
    getBg: (slot, globalBubbleBg) => slot.bubbleBg || globalBubbleBg,
  },
];

/**
 * Text fields in roleStyleConfig (shared/role-style-config.js) per role.
 */
const ROLE_TEXT_FIELDS = [
  {
    field: 'authorColor',
    targetThreshold: 3.0, // Author name is bold
    // Author renders on authorBg if present -> else rowBg -> else messageBg -> else global bubbleBg
    getBg: (role, globalBubbleBg) => role.authorBg || role.rowBg || role.messageBg || globalBubbleBg,
  },
  {
    field: 'messageTextColor',
    targetThreshold: 4.5, // Message text is normal weight
    // Message text renders on messageBg -> else rowBg -> else global bubbleBg
    getBg: (role, globalBubbleBg) => role.messageBg || role.rowBg || globalBubbleBg,
  },
];

/**
 * NOTE: layoutConfig.screen no longer has its own color fields to snap here.
 * The header/body split bands (see shared/layout-config.js) read the exact
 * same per-slot bubble background as split-wrap mode
 * (slotStyleConfig.slots.author.bubbleBg / slots.message.bubbleBg), which is
 * already covered by SLOT_SURFACE_FIELDS below — so there is nothing
 * layout-specific left to snap independently.
 */

/**
 * Surface fields in fanServiceConfig (shared/fan-service-config.js) per group.
 */
const FAN_SERVICE_SURFACE_FIELDS = [
  'manualBgColor',      // Manual background color for event bubble
  'manualBorderColor',  // Manual border color for event bubble
  'bubbleBoxShadow',    // Event bubble box-shadow string
  'bubbleGlow',         // Event bubble drop-shadow filter string
];

/**
 * Text fields in fanServiceConfig (shared/fan-service-config.js) per group.
 */
const FAN_SERVICE_TEXT_FIELDS = [
  {
    field: 'authorColor',
    targetThreshold: 3.0, // Author name is bold
    // Renders on manualBgColor if set -> else group default (Super Chat default bg: rgba(104, 87, 34, 0.8))
    getBg: (group, groupKey, globalBubbleBg) =>
      group.manualBgColor || (groupKey === 'superchat' ? 'rgba(104, 87, 34, 0.8)' : globalBubbleBg),
  },
  {
    field: 'messageColor',
    targetThreshold: 4.5, // Message text is normal weight
    // Renders on manualBgColor if set -> else group default
    getBg: (group, groupKey, globalBubbleBg) =>
      group.manualBgColor || (groupKey === 'superchat' ? 'rgba(104, 87, 34, 0.8)' : globalBubbleBg),
  },
  {
    field: 'monthsColor',
    targetThreshold: 3.0, // "Hội viên trong N tháng" line is prominent / scale 1.25
    // Renders on manualBgColor if set -> else group default for superchat vs global bubbleBg
    getBg: (group, groupKey, globalBubbleBg) =>
      group.manualBgColor || (groupKey === 'superchat' ? 'rgba(104, 87, 34, 0.8)' : globalBubbleBg),
  },
];

// Default OBS canvas background used to blend semi-transparent surface colors before WCAG calculation
const BASE_CANVAS_RGB = { r: 14, g: 16, b: 19 }; // #0E1013

// ── 2. COLOR PARSING & MATH UTILITIES ───────────────────────────────────────

/**
 * Normalizes an input array of hex strings:
 * - Strips invalid entries
 * - Formats to upper-case 6-digit hex (#RRGGBB)
 * - Deduplicates
 * - Clamps length to min 2, max 5
 */
function normalizePalette(paletteHexList) {
  if (!Array.isArray(paletteHexList)) {
    throw new Error('paletteHexList phải là một mảng mã màu hex.');
  }

  const validHexes = [];

  for (let raw of paletteHexList) {
    if (typeof raw !== 'string') continue;
    let hex = raw.trim();
    if (!hex.startsWith('#')) hex = `#${hex}`;

    // Validate 3, 4, 6, 8 hex characters
    const match = hex.match(/^#([0-9a-fA-F]{3,8})$/);
    if (!match) continue;

    const chars = match[1];
    let fullHex = '';
    if (chars.length === 3 || chars.length === 4) {
      fullHex = `#${chars[0]}${chars[0]}${chars[1]}${chars[1]}${chars[2]}${chars[2]}`.toUpperCase();
    } else if (chars.length >= 6) {
      fullHex = `#${chars.slice(0, 6)}`.toUpperCase();
    } else {
      continue;
    }

    if (!validHexes.includes(fullHex)) {
      validHexes.push(fullHex);
    }
  }

  if (validHexes.length < 2) {
    throw new Error('Palette cần ít nhất 2 mã màu hex hợp lệ.');
  }

  return validHexes.slice(0, 5);
}

/**
 * Parses hex/rgb/rgba color strings into { r, g, b, a }.
 * Returns null if string is not a valid color.
 */
function parseColor(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgba(r, g, b, a)
  const rgbaMatch = s.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: parseFloat(rgbaMatch[4]),
    };
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: 1,
    };
  }

  return null;
}

/**
 * Calculates Euclidean distance between two RGB colors in sRGB space.
 */
function euclideanDistance(c1, c2) {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Finds the closest color entry in palette (array of { hex, r, g, b }) to targetColor.
 */
function findClosestPaletteColor(targetColor, paletteEntries) {
  let closest = paletteEntries[0];
  let minDistance = Infinity;

  for (const entry of paletteEntries) {
    const dist = euclideanDistance(targetColor, entry);
    if (dist < minDistance) {
      minDistance = dist;
      closest = entry;
    }
  }

  return closest;
}

/**
 * Reconstructs a snapped color string while preserving original alpha if present.
 */
function formatSnappedColor(originalColorStr, closestPaletteEntry) {
  const parsed = parseColor(originalColorStr);
  if (parsed && typeof parsed.a === 'number' && parsed.a < 1) {
    const alphaStr = Number.isInteger(parsed.a) ? parsed.a : parsed.a.toFixed(2).replace(/\.?0+$/, '');
    return `rgba(${closestPaletteEntry.r}, ${closestPaletteEntry.g}, ${closestPaletteEntry.b}, ${alphaStr})`;
  }
  return closestPaletteEntry.hex;
}

/**
 * Shared regex for locating embedded color tokens (hex/rgb/rgba) inside a
 * larger CSS string — used by both snapCssString (nearest-color-per-token)
 * and forceSnapColorOrCss (same-forced-entry-for-every-token) below.
 */
const COLOR_TOKEN_REGEX = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/gi;

/**
 * Snaps color tokens inside complex CSS strings (e.g. drop-shadow, box-shadow).
 * Preserves all surrounding non-color CSS syntax.
 */
function snapCssString(cssStr, paletteEntries) {
  if (!cssStr || typeof cssStr !== 'string') return cssStr;

  return cssStr.replace(COLOR_TOKEN_REGEX, (match) => {
    const parsed = parseColor(match);
    if (!parsed) return match;
    const closest = findClosestPaletteColor(parsed, paletteEntries);
    return formatSnappedColor(match, closest);
  });
}

/**
 * Like formatSnappedColor, but also handles complex CSS values that contain
 * MULTIPLE embedded color tokens — most notably a user-set
 * `linear-gradient(135deg, rgba(...), rgba(...))` background (customizeConfig.
 * bubbleBg, role messageBg, and slot bubbleBg all allow gradients in the UI's
 * ColorPicker — see renderer-dashboard's `allowGradient` prop). The "direct
 * assignment" steps below (Step 1-3, headerSplit) intentionally force ONE
 * specific palette entry onto ONE specific field, so unlike snapCssString
 * (which finds each token's own nearest color) every embedded token here
 * gets forced to the SAME entry — but each token's own alpha channel is
 * still preserved individually, so a translucency gradient (e.g. 0.22 ->
 * 0.72 alpha) still reads as a gradient, just recolored to the locked hue,
 * instead of collapsing into one flat block.
 *
 * Plain flat colors (hex/rgb/rgba) still take the historical single-token
 * path — this is a strict superset of the old formatSnappedColor, not a
 * behavior change for non-gradient values.
 */
function forceSnapColorOrCss(cssStr, forcedEntry) {
  if (!cssStr || typeof cssStr !== 'string') return cssStr;
  if (parseColor(cssStr)) {
    return formatSnappedColor(cssStr, forcedEntry);
  }
  return cssStr.replace(COLOR_TOKEN_REGEX, (match) => formatSnappedColor(match, forcedEntry));
}

// ── 3. WCAG RELATIVE LUMINANCE & CONTRAST RATIO MATH ──────────────────────

/**
 * W3C WCAG 2.1 Relative Luminance formula.
 */
function getRelativeLuminance(rgb) {
  const rs = rgb.r / 255;
  const gs = rgb.g / 255;
  const bs = rgb.b / 255;

  const rLin = rs <= 0.04045 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const gLin = gs <= 0.04045 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const bLin = bs <= 0.04045 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates W3C WCAG contrast ratio between two RGB colors (returns 1.0 to 21.0).
 */
function getContrastRatio(c1, c2) {
  const l1 = getRelativeLuminance(c1);
  const l2 = getRelativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Composites a semi-transparent foreground color over a base background color.
 */
function blendOverBase(fgColor, baseColor = BASE_CANVAS_RGB) {
  if (!fgColor) return baseColor;
  const a = typeof fgColor.a === 'number' ? fgColor.a : 1;
  if (a >= 1) return { r: fgColor.r, g: fgColor.g, b: fgColor.b };

  return {
    r: Math.round(fgColor.r * a + baseColor.r * (1 - a)),
    g: Math.round(fgColor.g * a + baseColor.g * (1 - a)),
    b: Math.round(fgColor.b * a + baseColor.b * (1 - a)),
  };
}

/**
 * Selects the optimal text color from palette based on WCAG contrast against background.
 * If any palette color satisfies targetThreshold (>= 4.5 for normal text, >= 3.0 for bold/large),
 * picks the palette color with the HIGHEST contrast ratio.
 * If NO palette color meets the threshold, falls back to #FFFFFF or #000000 (highest contrast).
 */
function selectBestTextColor(rawBgStr, paletteEntries, targetThreshold = 4.5, defaultBgStr = 'rgba(22, 25, 31, 0.72)') {
  const parsedBg = parseColor(rawBgStr) || parseColor(defaultBgStr) || { r: 22, g: 25, b: 31, a: 0.72 };
  const effectiveBgRgb = blendOverBase(parsedBg);

  let bestPaletteColor = null;
  let maxPassingContrast = -1;

  for (const entry of paletteEntries) {
    const cr = getContrastRatio(entry, effectiveBgRgb);
    if (cr >= targetThreshold) {
      if (cr > maxPassingContrast) {
        maxPassingContrast = cr;
        bestPaletteColor = entry.hex;
      }
    }
  }

  if (bestPaletteColor) {
    return bestPaletteColor;
  }

  // Fallback: compare #FFFFFF vs #000000
  const whiteRgb = { r: 255, g: 255, b: 255 };
  const blackRgb = { r: 0, g: 0, b: 0 };

  const crWhite = getContrastRatio(whiteRgb, effectiveBgRgb);
  const crBlack = getContrastRatio(blackRgb, effectiveBgRgb);

  return crWhite >= crBlack ? '#FFFFFF' : '#000000';
}

// ── 3b. LOW-ALPHA / TRANSPARENCY DETECTION ─────────────────────────────────

/**
 * Below this alpha, a bubble background is considered "too transparent" for
 * Palette Lock's WCAG guarantee to be trusted. The engine's contrast math
 * (selectBestTextColor / blendOverBase) only ever blends a color over the
 * single fixed BASE_CANVAS_RGB canvas — a reasonable stand-in for "the
 * overlay sitting on an empty/dark scene", but the real overlay is
 * composited over whatever the streamer's scene actually is (gameplay
 * footage, bright webcam, white slides...). The more transparent a bubble
 * is, the more that arbitrary real background — not BASE_CANVAS_RGB —
 * dominates what the viewer actually sees behind the text, so a contrast
 * ratio computed against BASE_CANVAS_RGB stops being a reliable predictor
 * of real-world legibility "trên mọi nền" (over any background).
 */
const LOW_ALPHA_THRESHOLD = 0.15;

/**
 * Gathers every bubble-background surface string currently in the bundle
 * that Palette Lock treats as a "bubble": the global bubble, the
 * moderator/member role bubbles, the Super Chat / Membership event
 * bubbles, and every per-slot bubble override (avatar/author/message...).
 * Mirrors the exact fields Step 1-3 of applyPaletteLock() assigns into, so
 * the check reflects the same surfaces the lock is about to touch.
 */
function collectBubbleBgStrings(bundle) {
  const strings = [];

  const customize = bundle?.customizeConfig || {};
  if (customize.bubbleBg) strings.push(customize.bubbleBg);

  const roles = bundle?.roleStyleConfig?.roles || {};
  ['moderator', 'member'].forEach((roleKey) => {
    const bg = roles[roleKey]?.messageBg;
    if (bg) strings.push(bg);
  });

  const fanService = bundle?.fanServiceConfig || {};
  ['superchat', 'membership'].forEach((groupKey) => {
    const bg = fanService[groupKey]?.manualBgColor;
    if (bg) strings.push(bg);
  });

  const slots = bundle?.slotStyleConfig?.slots || {};
  Object.values(slots).forEach((slot) => {
    if (slot?.bubbleBg) strings.push(slot.bubbleBg);
  });

  return strings;
}

/**
 * Extracts every explicit rgba() alpha embedded in a color/CSS string
 * (handles multi-token strings like gradients via COLOR_TOKEN_REGEX).
 * Opaque hex/rgb tokens have an implicit alpha of 1 and are not reported —
 * only colors that actually carry a translucency value are relevant here.
 */
function extractAlphaValues(cssStr) {
  if (!cssStr || typeof cssStr !== 'string') return [];
  const tokens = cssStr.match(COLOR_TOKEN_REGEX) || [];
  return tokens
    .map((token) => parseColor(token))
    .filter((parsed) => parsed && typeof parsed.a === 'number')
    .map((parsed) => parsed.a);
}

/**
 * Returns true if any bubble background surface currently in the bundle
 * (see collectBubbleBgStrings) has an alpha channel below
 * LOW_ALPHA_THRESHOLD — i.e. the theme is so transparent that Palette
 * Lock's contrast guarantee can't be trusted against arbitrary real-world
 * backgrounds. Callers (e.g. the Palette Lock panel UI) should surface this
 * as a warning rather than silently applying the lock.
 */
function hasLowAlphaBubble(bundle, threshold = LOW_ALPHA_THRESHOLD) {
  return collectBubbleBgStrings(bundle).some((cssStr) =>
    extractAlphaValues(cssStr).some((alpha) => alpha < threshold),
  );
}

// ── 4. MAIN ENGINE: applyPaletteLock ────────────────────────────────────────

/**
 * Applies Palette Lock to a bundle of configs.
 *
 * @param {object} bundle - Current config bundle { customizeConfig, roleStyleConfig, fanServiceConfig }
 * @param {string[]} paletteHexList - Array of 2–5 hex color codes
 * @param {object} [options] - Options:
 *   - baselineBundle: Original un-locked config bundle to use as source data for snapping
 * @returns {object} { customizeConfig, roleStyleConfig, fanServiceConfig }
 */
function applyPaletteLock(bundle, paletteHexList, options = {}) {
  const normalizedHexes = normalizePalette(paletteHexList);
  const paletteEntries = normalizedHexes.map((hex) => ({
    hex,
    ...parseColor(hex),
  }));

  // `sourceBundle` (baseline if provided) supplies the ORIGINAL color
  // values to snap FROM — so repeated re-locking with a different palette
  // always measures distance against the pre-lock colors instead of
  // compounding drift off previously-snapped ones. It must NEVER be used
  // as the base object we clone and mutate: baselineBundle can be
  // arbitrarily stale on every field that ISN'T a color (layout position,
  // size, rotation, font, visibility...) — and slotStyleConfig in
  // particular (shared/slot-style-config.js) mixes color fields together
  // with those non-color layout/typography fields inside the very same
  // slot objects (avatar/author/message). Cloning the working copy from
  // baseline would silently revert any non-color edit the user made after
  // the baseline was captured (e.g. resized the avatar, moved a slot,
  // changed a font) the next time they hit "Áp dụng Bảng màu" — Palette
  // Lock is only supposed to touch colors, never layout.
  const sourceBundle = options.baselineBundle || bundle;

  const rawCustomize = sourceBundle?.customizeConfig || {};
  const rawRoleStyle = sourceBundle?.roleStyleConfig || {};
  const rawFanService = sourceBundle?.fanServiceConfig || {};
  const rawSlot = sourceBundle?.slotStyleConfig || {};
  const rawLayout = sourceBundle?.layoutConfig || {};

  // The base object we actually mutate and return is always the LIVE
  // bundle, so every non-color field passes through completely untouched,
  // exactly as it is right now. Only the explicit color fields below get
  // overwritten (optionally snapping FROM the baseline value via rawXxx
  // for anti-drift, per field, but always assigning back into these
  // live-based clones).
  const newCustomize = JSON.parse(JSON.stringify(bundle?.customizeConfig || {}));
  const newRoleStyle = JSON.parse(JSON.stringify(bundle?.roleStyleConfig || {}));
  const newFanService = JSON.parse(JSON.stringify(bundle?.fanServiceConfig || {}));
  const newSlot = JSON.parse(JSON.stringify(bundle?.slotStyleConfig || {}));
  const newLayout = JSON.parse(JSON.stringify(bundle?.layoutConfig || {}));

  // Step 1: Assign Color 0 (Main Color 1) to general bubbleBg
  const mainColor1Entry = paletteEntries[0];
  const origBubbleBg = rawCustomize.bubbleBg || 'rgba(22, 25, 31, 0.72)';
  newCustomize.bubbleBg = forceSnapColorOrCss(origBubbleBg, mainColor1Entry);

  // Step 2: Assign Color 1 (Main Color 2) to Member bubble background
  const mainColor2Entry = paletteEntries[1] || paletteEntries[0];
  if (newRoleStyle.roles?.member) {
    const origMemBg = rawRoleStyle.roles?.member?.messageBg || 'rgba(30, 58, 95, 0.9)';
    newRoleStyle.roles.member.messageBg = forceSnapColorOrCss(origMemBg, mainColor2Entry);
  }

  if (newFanService.membership) {
    // Mirrors the ACTUAL fallback chain fan-service-config.js renders when
    // manualBgColor is unset: `var(--ovs-role-member-message-bg,
    // var(--ovs-bubble-bg, rgba(22, 25, 31, 0.72)))` — i.e. the membership
    // bubble visually inherits role.member.messageBg first, then
    // customizeConfig.bubbleBg, and only falls back to the hardcoded
    // literal as a last resort. Snapping straight from that literal
    // whenever manualBgColor was null (skipping the two real inherited
    // values) meant the "original" alpha used to anti-drift the snap
    // rarely matched what the user was actually seeing — e.g. a member
    // bubble customized to 0.92 opacity would silently snap from the
    // literal's 0.72 instead, visibly changing the opacity even though
    // Palette Lock is only supposed to touch hue.
    const origMsBg =
      rawFanService.membership?.manualBgColor ||
      rawRoleStyle.roles?.member?.messageBg ||
      rawCustomize.bubbleBg ||
      'rgba(22, 25, 31, 0.72)';
    newFanService.membership.manualBgColor = forceSnapColorOrCss(origMsBg, mainColor2Entry);
  }

  // Step 3: Assign distinct palette colors to distinct role & event surfaces
  //
  // Track per-role which fields got a DIRECT color assignment above, so the
  // generic ROLE_SURFACE_FIELDS snap loop below only skips messageBg when it
  // was actually touched here. member.messageBg is unconditionally assigned
  // in Step 2, but moderator.messageBg is gated on paletteEntries.length>=3
  // — with a 2-color palette that condition is false, so without this
  // tracking the generic loop's blanket "messageBg — directly assigned"
  // skip would silently leave moderator.messageBg completely untouched by
  // Palette Lock (neither Step 3 nor the generic loop ever snaps it).
  const roleDirectlyAssigned = { moderator: new Set(), member: new Set(['messageBg']) };
  if (paletteEntries.length >= 3 && newRoleStyle.roles?.moderator) {
    const origModBg = rawRoleStyle.roles?.moderator?.messageBg || 'rgba(86, 50, 54, 0.78)';
    newRoleStyle.roles.moderator.messageBg = forceSnapColorOrCss(origModBg, paletteEntries[2]);
    roleDirectlyAssigned.moderator.add('messageBg');
  }

  // Track per-group which fields got a DIRECT color assignment above, so the
  // generic FAN_SERVICE_SURFACE_FIELDS snap loop below only skips
  // manualBgColor when it was actually touched here. membership.manualBgColor
  // is unconditionally assigned in Step 2, but superchat.manualBgColor is
  // gated on `shouldUseManualColor` (paletteEntries.length >= 4) — with a
  // <4-color palette that condition is false, so without this tracking the
  // generic loop's blanket "manualBgColor — directly assigned" skip would
  // silently leave superchat.manualBgColor completely untouched by Palette
  // Lock (neither Step 3 nor the generic loop ever snaps it) whenever the
  // user disabled "Tự động dùng màu theo tier" and picked a palette under 4
  // colors — same class of bug as the moderator.messageBg one above.
  const fanServiceDirectlyAssigned = { superchat: new Set(), membership: new Set(['manualBgColor']) };
  if (newFanService.superchat) {
    // useTierColor is a boolean, not a color — it can't live in
    // FAN_SERVICE_SURFACE_FIELDS/FAN_SERVICE_TEXT_FIELDS, so it's handled here
    // explicitly and deterministically on every call (see JSDoc header above):
    // ≥4 palette colors → force it off so the locked palette actually shows;
    // otherwise restore the value from the baseline being snapped (falls back
    // to `true`, its own default), so shrinking the palette and re-locking
    // reverses the side effect instead of leaving it stuck at `false`.
    const shouldUseManualColor = paletteEntries.length >= 4;
    newFanService.superchat.useTierColor = shouldUseManualColor
      ? false
      : (rawFanService.superchat?.useTierColor ?? true);

    if (shouldUseManualColor) {
      const origScBg = rawFanService.superchat?.manualBgColor || 'rgba(104, 87, 34, 0.8)';
      newFanService.superchat.manualBgColor = forceSnapColorOrCss(origScBg, paletteEntries[3]);
      fanServiceDirectlyAssigned.superchat.add('manualBgColor');

      // Guarantee a palette-derived authorColor right away: with useTierColor
      // false, fan-service-config.js's amount badge / author text fall back to
      // `g.authorColor || '#fde047'` — a stale/missing authorColor here would
      // silently render the non-palette yellow instead of the locked palette.
      // Step 4 below recomputes this anyway, but we don't want correctness to
      // depend on Step 4 staying unconditional in future edits.
      const scAuthorBg = newFanService.superchat.manualBgColor;
      newFanService.superchat.authorColor = selectBestTextColor(scAuthorBg, paletteEntries, 3.0);
    }
  }

  // Color 4 (5th color) → bubble border / accent viền chung
  if (paletteEntries.length >= 5) {
    newCustomize.bubbleBorderColor = paletteEntries[4].hex;
  }

  // Step 3b: "Chia đôi bubble kiểu YouTube" (headerSplit) — force two
  // DISTINCT palette colors onto slots.author.bubbleBg (header band: avatar
  // + tên) and slots.message.bubbleBg (content band), regardless of whether
  // the user ever set them manually. normalizePalette() guarantees at least
  // 2 deduplicated entries, so paletteEntries[0] and paletteEntries[1] are
  // always two different colors — the split is guaranteed to actually be
  // visible after locking, not just "whatever it already happened to be".
  // Tracked in slotDirectlyAssigned so the generic slot-surface snap loop
  // below skips these two fields instead of re-snapping (harmless either
  // way since it's the same palette, but keeps the "already assigned"
  // bookkeeping honest, matching the pattern used for bubbleBg/messageBg
  // above).
  // NOTE: headerSplitOn is deliberately read from `bundle.layoutConfig` (the
  // LIVE current state passed in by the caller), NOT from `rawLayout`
  // (sourceBundle/baseline). The baseline snapshot only exists to freeze
  // *color values* so repeated re-locking doesn't drift — it can otherwise
  // be arbitrarily stale relative to *structural* toggles like "Chia đôi
  // bubble kiểu YouTube", which the user may switch on/off after the
  // baseline was captured but before clicking "Áp dụng" again. Deciding
  // whether to force-assign the split colors from stale structural state
  // would silently skip the split the user just turned on — exactly the
  // "áp dụng nhưng vẫn trùng màu" bug this guards against. The raw color to
  // snap FROM still prefers the live slot value (falls back to baseline,
  // then default) so an in-session manual pick isn't discarded either.
  const liveLayoutScreen = bundle?.layoutConfig?.screen;
  const liveSlot = bundle?.slotStyleConfig || {};
  const slotDirectlyAssigned = { author: new Set(), message: new Set() };
  const headerSplitOn = isRowBubbleWrap(liveLayoutScreen) && Boolean(liveLayoutScreen?.headerSplit);
  if (headerSplitOn) {
    newSlot.slots = newSlot.slots || {};
    const rawAuthorBg =
      liveSlot?.slots?.author?.bubbleBg || rawSlot?.slots?.author?.bubbleBg || rawCustomize.bubbleBg || 'rgba(22, 25, 31, 0.72)';
    const rawMessageBg =
      liveSlot?.slots?.message?.bubbleBg || rawSlot?.slots?.message?.bubbleBg || 'rgba(22, 25, 31, 0.55)';

    const headerEntry = paletteEntries[0];
    const bodyEntry = paletteEntries[1] || paletteEntries[0];

    newSlot.slots.author = {
      ...newSlot.slots.author,
      bubbleBg: forceSnapColorOrCss(rawAuthorBg, headerEntry),
    };
    newSlot.slots.message = {
      ...newSlot.slots.message,
      bubbleBg: forceSnapColorOrCss(rawMessageBg, bodyEntry),
    };
    slotDirectlyAssigned.author.add('bubbleBg');
    slotDirectlyAssigned.message.add('bubbleBg');
  }

  // Snap remaining customize surface fields via Euclidean distance
  // (skip fields that were directly assigned in Steps 1-3 above)
  const directlyAssigned = new Set(['bubbleBg']);
  if (paletteEntries.length >= 5) directlyAssigned.add('bubbleBorderColor');

  // For every field below: whether to touch it at all is decided by the
  // LIVE value (newXxx) — if the user cleared/never set it, it stays
  // untouched. But the color actually snapped is the BASELINE value
  // (rawXxx) when available, falling back to the live value otherwise —
  // this is what keeps repeated re-locking measuring distance from the
  // original pre-lock colors instead of compounding drift off previously
  // snapped ones, without requiring the whole object to come from baseline.
  CUSTOMIZE_SURFACE_FIELDS.forEach((field) => {
    if (directlyAssigned.has(field)) return;
    if (newCustomize[field] != null) {
      const originValue = rawCustomize[field] != null ? rawCustomize[field] : newCustomize[field];
      newCustomize[field] = snapCssString(originValue, paletteEntries);
    }
  });

  // Snap role surface fields (skip messageBg which is directly assigned above)
  ['moderator', 'member'].forEach((roleKey) => {
    if (!newRoleStyle.roles?.[roleKey]) return;
    const role = newRoleStyle.roles[roleKey];
    const rawRole = rawRoleStyle.roles?.[roleKey] || {};
    ROLE_SURFACE_FIELDS.forEach((field) => {
      if (field === 'messageBg' && roleDirectlyAssigned[roleKey]?.has('messageBg')) return; // already assigned above (Step 2/3)
      if (role[field] != null) {
        const originValue = rawRole[field] != null ? rawRole[field] : role[field];
        role[field] = snapCssString(originValue, paletteEntries);
      }
    });
  });

  // Snap fan service surface fields (skip manualBgColor which is directly assigned above)
  ['superchat', 'membership'].forEach((groupKey) => {
    if (!newFanService[groupKey]) return;
    const group = newFanService[groupKey];
    const rawGroup = rawFanService[groupKey] || {};
    FAN_SERVICE_SURFACE_FIELDS.forEach((field) => {
      if (field === 'manualBgColor' && fanServiceDirectlyAssigned[groupKey]?.has('manualBgColor')) return; // already assigned above (Step 2/3)
      if (group[field] != null) {
        const originValue = rawGroup[field] != null ? rawGroup[field] : group[field];
        group[field] = snapCssString(originValue, paletteEntries);
      }
    });
  });

  // Snap slotStyleConfig surface fields (all slots: avatar, author, message, ...)
  if (newSlot.slots && typeof newSlot.slots === 'object') {
    Object.entries(newSlot.slots).forEach(([slotKey, slot]) => {
      if (!slot || typeof slot !== 'object') return;
      const rawSlotEntry = rawSlot.slots?.[slotKey] || {};
      SLOT_SURFACE_FIELDS.forEach((field) => {
        if (slotDirectlyAssigned[slotKey]?.has(field)) return; // already force-assigned by headerSplit above
        if (slot[field] != null) {
          const originValue = rawSlotEntry[field] != null ? rawSlotEntry[field] : slot[field];
          slot[field] = snapCssString(originValue, paletteEntries);
        }
      });
    });
  }

  // layoutConfig.screen has no colors of its own anymore (see the NOTE above
  // LAYOUT_SURFACE_FIELDS' old spot) — newLayout is returned unchanged so
  // callers that still read result.layoutConfig keep getting a valid object.

  // Step 4: Evaluate all text fields using WCAG contrast against their assigned surface background.
  //
  // headerSplit override: when "Chia đôi bubble kiểu YouTube" is on, the
  // header band (slots.author.bubbleBg) and body band (slots.message.bubbleBg)
  // are what the overlay ACTUALLY paints behind the author name / message
  // content for every message kind — viewer (default), moderator, member —
  // because bubble-wrap.css's split-grid bands sit visually on top of each
  // role's own background (only role text COLOR keeps its own !important
  // override; role background does not). Checking authorColor/messageText
  // contrast against each bucket's own logical bg field (customizeConfig.
  // bubbleBg, role.messageBg, etc.) would silently validate against a color
  // that isn't the one actually behind the text on screen. Super Chat /
  // Membership are unaffected — they render through a separate inline-style
  // path that doesn't participate in the split grid — so they keep using
  // their own manualBgColor-based bg below.
  const headerBandBg = headerSplitOn ? newSlot.slots.author.bubbleBg : null;
  const bodyBandBg = headerSplitOn ? newSlot.slots.message.bubbleBg : null;

  CUSTOMIZE_TEXT_FIELDS.forEach(({ field, targetThreshold, getBg }) => {
    const bgStr = headerSplitOn ? (field === 'authorColor' ? headerBandBg : bodyBandBg) : getBg(newCustomize);
    newCustomize[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold);
  });

  ['moderator', 'member'].forEach((roleKey) => {
    if (!newRoleStyle.roles?.[roleKey]) return;
    const role = newRoleStyle.roles[roleKey];
    ROLE_TEXT_FIELDS.forEach(({ field, targetThreshold, getBg }) => {
      if (role[field] != null) {
        const bgStr = headerSplitOn
          ? (field === 'authorColor' ? headerBandBg : bodyBandBg)
          : getBg(role, newCustomize.bubbleBg);
        role[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold, bgStr);
      }
    });

    if (roleKey === 'member' && Array.isArray(role.memberTiers)) {
      // Mốc tháng (member tier) badge/border/author-name color — role-styles.css's
      // --ovs-member-tier-color overrides BOTH the member's author text color AND
      // the bubble border once a tier is active, so it needs the exact same WCAG
      // treatment as authorColor. The old cyclic
      // `paletteEntries[(idx + 1) % paletteEntries.length]` assignment ignored
      // contrast entirely — for the common case of one palette color per
      // "surface" (bubbleBg, member.messageBg, mod.messageBg, superchat...),
      // it could land a tier on the EXACT SAME color already assigned to
      // member.messageBg in Step 2 above. Concretely: tiers are sorted by
      // minMonths descending, so idx 0 is normally the highest tier (e.g. "12
      // tháng"); with the old formula that tier always got
      // paletteEntries[(0 + 1) % length] = paletteEntries[1] — which Step 2
      // *also* assigns to member.messageBg — making the top tier's
      // badge/border/author-name invisible against its own bubble.
      //
      // Fix: only cycle through palette colors that actually pass the 3.0:1
      // (bold/large text) contrast threshold against the background the tier
      // color renders on — the header band if headerSplit is on, otherwise the
      // member's own resolved surface (mirrors ROLE_TEXT_FIELDS' authorColor
      // getBg). This keeps tiers visually distinct from each other where
      // possible, while guaranteeing every tier stays readable; if literally no
      // palette color passes, fall back to the same best-effort WCAG pick used
      // everywhere else in the engine.
      const tierBgStr = headerSplitOn
        ? headerBandBg
        : (role.authorBg || role.rowBg || role.messageBg || newCustomize.bubbleBg);
      const tierEffectiveBg = blendOverBase(parseColor(tierBgStr) || parseColor('rgba(22, 25, 31, 0.72)'));
      const passingTierEntries = paletteEntries.filter((entry) => getContrastRatio(entry, tierEffectiveBg) >= 3.0);

      role.memberTiers = role.memberTiers.map((tier, idx) => {
        if (!tier) return tier;
        const tierPaletteColor = passingTierEntries.length > 0
          ? passingTierEntries[idx % passingTierEntries.length].hex
          : selectBestTextColor(tierBgStr, paletteEntries, 3.0);
        return { ...tier, color: tierPaletteColor };
      });
    }
  });

  ['superchat', 'membership'].forEach((groupKey) => {
    if (!newFanService[groupKey]) return;
    const group = newFanService[groupKey];
    FAN_SERVICE_TEXT_FIELDS.forEach(({ field, targetThreshold, getBg }) => {
      const bgStr = getBg(group, groupKey, newCustomize.bubbleBg);
      group[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold);
    });
  });

  // Slot text colors (author.color / message.color) — only when the user has
  // already set a per-slot override; otherwise the slot keeps inheriting the
  // already-snapped customizeConfig color and is left untouched.
  if (newSlot.slots && typeof newSlot.slots === 'object') {
    SLOT_TEXT_FIELDS.forEach(({ slotKey, field, targetThreshold, getBg }) => {
      const slot = newSlot.slots[slotKey];
      if (!slot || slot[field] == null) return;
      const bgStr = getBg(slot, newCustomize.bubbleBg);
      slot[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold);
    });
  }

  // Step 5: Guarantee 100% Coverage — ensure every palette color appears at least once.
  // Collect all hex values AND rgb/rgba values currently present in the output.
  const assignedHexes = new Set();
  const allOutputJson = JSON.stringify({ newCustomize, newRoleStyle, newFanService, newSlot, newLayout });

  paletteEntries.forEach((entry) => {
    const hexPattern = entry.hex.toUpperCase();
    const rgbPattern = `${entry.r}, ${entry.g}, ${entry.b}`;
    const rgbPatternTight = `${entry.r},${entry.g},${entry.b}`;

    if (
      allOutputJson.toUpperCase().includes(hexPattern) ||
      allOutputJson.includes(rgbPattern) ||
      allOutputJson.includes(rgbPatternTight)
    ) {
      assignedHexes.add(entry.hex);
    }
  });

  // Fallback assignment slots for any palette color that didn't land anywhere:
  //   idx 0 → bubbleBorderColor (viền bubble chung)
  //   idx 1 → member.messageBorderColor (viền bubble hội viên)
  //   idx 2 → moderator.messageBorderColor (viền bubble quản trị viên)
  //   idx 3 → superchat.manualBorderColor (viền super chat)
  //   idx 4 → membership.manualBorderColor (viền membership)
  const fallbackSlots = [
    () => { newCustomize.bubbleBorderColor = paletteEntries[0].hex; },
    () => { if (newRoleStyle.roles?.member) newRoleStyle.roles.member.messageBorderColor = paletteEntries[1].hex; },
    () => { if (newRoleStyle.roles?.moderator) newRoleStyle.roles.moderator.messageBorderColor = paletteEntries[2].hex; },
    () => { if (newFanService.superchat) newFanService.superchat.manualBorderColor = paletteEntries[3].hex; },
    () => { if (newFanService.membership) newFanService.membership.manualBorderColor = paletteEntries[4].hex; },
  ];

  paletteEntries.forEach((entry, idx) => {
    if (!assignedHexes.has(entry.hex) && fallbackSlots[idx]) {
      fallbackSlots[idx]();
    }
  });

  return {
    customizeConfig: newCustomize,
    roleStyleConfig: newRoleStyle,
    fanServiceConfig: newFanService,
    slotStyleConfig: newSlot,
    layoutConfig: newLayout,
  };
}

module.exports = {
  normalizePalette,
  parseColor,
  euclideanDistance,
  findClosestPaletteColor,
  snapCssString,
  forceSnapColorOrCss,
  getRelativeLuminance,
  getContrastRatio,
  selectBestTextColor,
  applyPaletteLock,
  hasLowAlphaBubble,
  LOW_ALPHA_THRESHOLD,
  CUSTOMIZE_SURFACE_FIELDS,
  CUSTOMIZE_TEXT_FIELDS,
  SLOT_SURFACE_FIELDS,
  SLOT_TEXT_FIELDS,
  ROLE_SURFACE_FIELDS,
  ROLE_TEXT_FIELDS,
  FAN_SERVICE_SURFACE_FIELDS,
  FAN_SERVICE_TEXT_FIELDS,
};