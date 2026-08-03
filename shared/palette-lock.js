/**
 * Palette Lock Engine — shared/palette-lock.js
 *
 * Enforces a user-defined color palette (2–5 hex colors) across all 3 config buckets:
 *   1. customizeConfig (global theme appearance & text styling)
 *   2. roleStyleConfig (moderator & member role overrides & member tier badges)
 *   3. fanServiceConfig (Super Chat & Membership dedicated events)
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
 */

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
    // Renders on manualBgColor if set -> else global bubbleBg
    getBg: (group, _groupKey, globalBubbleBg) => group.manualBgColor || globalBubbleBg,
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
 * Snaps color tokens inside complex CSS strings (e.g. drop-shadow, box-shadow).
 * Preserves all surrounding non-color CSS syntax.
 */
function snapCssString(cssStr, paletteEntries) {
  if (!cssStr || typeof cssStr !== 'string') return cssStr;

  const colorRegex = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/gi;

  return cssStr.replace(colorRegex, (match) => {
    const parsed = parseColor(match);
    if (!parsed) return match;
    const closest = findClosestPaletteColor(parsed, paletteEntries);
    return formatSnappedColor(match, closest);
  });
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
function selectBestTextColor(rawBgStr, paletteEntries, targetThreshold = 4.5) {
  const parsedBg = parseColor(rawBgStr) || parseColor('rgba(22, 25, 31, 0.72)');
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

  // Use baselineBundle if provided (for comparing against original un-locked state)
  const sourceBundle = options.baselineBundle || bundle;

  const rawCustomize = sourceBundle?.customizeConfig || {};
  const rawRoleStyle = sourceBundle?.roleStyleConfig || {};
  const rawFanService = sourceBundle?.fanServiceConfig || {};

  // Deep clone working copies
  const newCustomize = JSON.parse(JSON.stringify(rawCustomize));
  const newRoleStyle = JSON.parse(JSON.stringify(rawRoleStyle));
  const newFanService = JSON.parse(JSON.stringify(rawFanService));

  // Step 1: Assign Color 0 (Main Color 1) to general bubbleBg
  const mainColor1Entry = paletteEntries[0];
  const origBubbleBg = rawCustomize.bubbleBg || 'rgba(22, 25, 31, 0.72)';
  newCustomize.bubbleBg = formatSnappedColor(origBubbleBg, mainColor1Entry);

  // Step 2: Assign Color 1 (Main Color 2) to Member bubble background
  const mainColor2Entry = paletteEntries[1] || paletteEntries[0];
  if (newRoleStyle.roles?.member) {
    const origMemBg = rawRoleStyle.roles?.member?.messageBg || 'rgba(30, 58, 95, 0.9)';
    newRoleStyle.roles.member.messageBg = formatSnappedColor(origMemBg, mainColor2Entry);
  }

  if (newFanService.membership) {
    const origMsBg = rawFanService.membership?.manualBgColor || 'rgba(22, 25, 31, 0.72)';
    newFanService.membership.manualBgColor = formatSnappedColor(origMsBg, mainColor2Entry);
  }

  // Step 3: Assign distinct palette colors to distinct role & event surfaces
  if (paletteEntries.length >= 3 && newRoleStyle.roles?.moderator) {
    const origModBg = rawRoleStyle.roles?.moderator?.messageBg || 'rgba(86, 50, 54, 0.78)';
    newRoleStyle.roles.moderator.messageBg = formatSnappedColor(origModBg, paletteEntries[2]);
  }

  if (paletteEntries.length >= 4 && newFanService.superchat) {
    const origScBg = rawFanService.superchat?.manualBgColor || 'rgba(104, 87, 34, 0.8)';
    newFanService.superchat.manualBgColor = formatSnappedColor(origScBg, paletteEntries[3]);
  }

  // Step 3: Snap remaining surface fields via Euclidean distance
  CUSTOMIZE_SURFACE_FIELDS.forEach((field) => {
    if (field === 'bubbleBg') return;
    if (newCustomize[field] != null) {
      newCustomize[field] = snapCssString(newCustomize[field], paletteEntries);
    }
  });

  ['moderator', 'member'].forEach((roleKey) => {
    if (!newRoleStyle.roles?.[roleKey]) return;
    const role = newRoleStyle.roles[roleKey];
    ROLE_SURFACE_FIELDS.forEach((field) => {
      if (field === 'messageBg') return;
      if (role[field] != null) {
        role[field] = snapCssString(role[field], paletteEntries);
      }
    });
  });

  ['superchat', 'membership'].forEach((groupKey) => {
    if (!newFanService[groupKey]) return;
    const group = newFanService[groupKey];
    FAN_SERVICE_SURFACE_FIELDS.forEach((field) => {
      if (field === 'manualBgColor') return;
      if (group[field] != null) {
        group[field] = snapCssString(group[field], paletteEntries);
      }
    });
  });

  // Step 4: Evaluate all text fields using WCAG contrast against their assigned surface background
  CUSTOMIZE_TEXT_FIELDS.forEach(({ field, targetThreshold, getBg }) => {
    const bgStr = getBg(newCustomize);
    newCustomize[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold);
  });

  ['moderator', 'member'].forEach((roleKey) => {
    if (!newRoleStyle.roles?.[roleKey]) return;
    const role = newRoleStyle.roles[roleKey];
    ROLE_TEXT_FIELDS.forEach(({ field, targetThreshold, getBg }) => {
      if (role[field] != null || field === 'authorColor') {
        const bgStr = getBg(role, newCustomize.bubbleBg);
        role[field] = selectBestTextColor(bgStr, paletteEntries, targetThreshold);
      }
    });

    if (roleKey === 'member' && Array.isArray(role.memberTiers)) {
      role.memberTiers = role.memberTiers.map((tier, idx) => {
        if (!tier) return tier;
        const tierPaletteColor = paletteEntries[(idx + 1) % paletteEntries.length].hex;
        const tierBgStr = role.messageBg || newCustomize.bubbleBg;
        const contrastBest = selectBestTextColor(tierBgStr, paletteEntries, 3.0);
        return { ...tier, color: tier.color ? contrastBest : tierPaletteColor };
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

  // Step 5: Final Check — Guarantee 100% Coverage of Palette Colors
  const assignedHexes = new Set();
  const extractHexes = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.values(obj).forEach((val) => {
      if (typeof val === 'string') {
        const matches = val.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
        if (matches) matches.forEach((h) => assignedHexes.add(h.toUpperCase()));
      } else if (typeof val === 'object') {
        extractHexes(val);
      }
    });
  };

  extractHexes(newCustomize);
  extractHexes(newRoleStyle);
  extractHexes(newFanService);

  paletteEntries.forEach((entry, idx) => {
    if (!assignedHexes.has(entry.hex)) {
      if (idx === 1 && newRoleStyle.roles?.moderator) {
        newRoleStyle.roles.moderator.authorBorderColor = entry.hex;
      } else if (idx === 2 && newRoleStyle.roles?.member) {
        newRoleStyle.roles.member.authorBorderColor = entry.hex;
      } else if (idx === 3 && newFanService.superchat) {
        newFanService.superchat.manualBorderColor = entry.hex;
      } else if (idx === 4 && newFanService.membership) {
        newFanService.membership.manualBorderColor = entry.hex;
      } else {
        newCustomize.bubbleBorderColor = entry.hex;
      }
    }
  });

  return {
    customizeConfig: newCustomize,
    roleStyleConfig: newRoleStyle,
    fanServiceConfig: newFanService,
  };
}

module.exports = {
  normalizePalette,
  parseColor,
  euclideanDistance,
  findClosestPaletteColor,
  snapCssString,
  getRelativeLuminance,
  getContrastRatio,
  selectBestTextColor,
  applyPaletteLock,
  CUSTOMIZE_SURFACE_FIELDS,
  CUSTOMIZE_TEXT_FIELDS,
  ROLE_SURFACE_FIELDS,
  ROLE_TEXT_FIELDS,
  FAN_SERVICE_SURFACE_FIELDS,
  FAN_SERVICE_TEXT_FIELDS,
};
