const fs = require('fs');
const path = require('path');
const { createThemeDocument } = require('../../shared/theme-document');
const { DEFAULT_LAYOUT_CONFIG } = require('../../shared/layout-config');
const { DEFAULT_BUBBLE_CONFIG } = require('../../shared/bubble-config');

const THEMES_DIR = path.join(__dirname, '..', '..', 'themes');

// The 4 data-slots every legacy template.html uses (see themes/*/template.html)
// mapped to the component names the future Layout Engine will look up in its
// component-registry.js (design doc §5.2 / §6 step 4) — using the same names
// here means a legacy-adapted layout.json is not a special case downstream.
const SLOT_TO_COMPONENT = {
  avatar: 'Avatar',
  author: 'Username',
  badges: 'Badges',
  message: 'Message',
};

// No remaining legacy theme positions messages absolutely (that was
// danmaku/ticker's flying/scrolling behavior); every legacy theme now
// stacks in a flex column. Kept as a Set (rather than deleting the
// isAbsolute branch in buildLayout) so a future absolute-layout legacy
// theme can opt in the same way without re-plumbing buildLayout.
const ABSOLUTE_LAYOUT_THEMES = new Set();

/**
 * Extracts the ordered list of data-slot names from a legacy template.html
 * string. This is a small, purpose-built scanner — not a general HTML
 * parser — because legacy templates are first-party, fixed-shape markup we
 * already own (themes/*\/template.html), so pulling in a full DOM/HTML
 * parsing dependency isn't warranted just for this.
 */
function parseSlotOrder(templateHtml) {
  const slotRegex = /data-slot=["']([a-z]+)["']/gi;
  const slots = [];
  let match = slotRegex.exec(templateHtml);
  while (match !== null) {
    const slot = match[1].toLowerCase();
    if (SLOT_TO_COMPONENT[slot]) slots.push(slot);
    match = slotRegex.exec(templateHtml);
  }
  return slots;
}

function buildLayout(themeId, slots) {
  const isAbsolute = ABSOLUTE_LAYOUT_THEMES.has(themeId);

  const messageRowChildren = slots.map((slot) => ({
    type: 'component',
    component: SLOT_TO_COMPONENT[slot],
    id: slot,
    visibility: 'visible',
  }));

  return {
    schemaVersion: '1.0',
    root: {
      type: 'container',
      mode: isAbsolute ? 'absolute' : 'flex-column',
      id: 'chat-root',
      children: [
        {
          type: 'component',
          component: 'MessageRow',
          id: 'message-row',
          mode: 'flex-row',
          children: messageRowChildren,
        },
      ],
    },
    overlays: {},
    // User-tunable layout settings (Layout Engine v0.2). Stored in Theme
    // JSON and persisted as layoutConfig in config.json.
    settings: { ...DEFAULT_LAYOUT_CONFIG },
  };
}

// Maps the flat 9-key customize-config (shared/customize-config.js) into the
// token-tree shape style.json uses (design doc §5.3). This is a MIRROR for
// now, not a new rendering path: overlay-client.js still reads the flat
// config directly via shared/customize-config.js#toCssVariables, so nothing
// about what actually renders changes. It exists so the Style Engine
// (refactor step 3) has a real style.json to start from for legacy themes
// instead of nothing.
function buildStyle(config) {
  return {
    schemaVersion: '1.0',
    tokens: {
      color: {
        text: config.textColor,
        author: config.authorColor,
        bubbleBg: config.bubbleBg,
      },
      font: {
        family: config.fontFamily,
        size: config.fontSize,
      },
      border: {
        radius: config.bubbleRadius,
      },
    },
    componentOverrides: {},
    bubble: { ...DEFAULT_BUBBLE_CONFIG },
    // Fields with no style.json token equivalent yet (showAvatar, showBadges,
    // avatarSize, bubbleOpacity, position, maxMessages) intentionally stay
    // only in the flat customize-config for now — mirroring them here too
    // would just be a second copy with no consumer yet.
  };
}

function buildAnimation(config) {
  return {
    schemaVersion: '1.0',
    targets: {
      messageEnter: {
        type: 'fade',
        duration: config.animationMs || 220,
        easing: 'ease-out',
      },
    },
  };
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return fallback;
  }
}

function legacyThemeExists(themeId) {
  return fs.existsSync(path.join(THEMES_DIR, themeId, 'template.html'));
}

/**
 * Synthesizes a full ThemeDocument (shared/theme-document.js shape) from an
 * existing themes/<id>/ folder, without reading or requiring any change to
 * that folder. This is what lets "all 7 existing themes load through the
 * new engine unchanged, with identical visual output" (design doc §8 step
 * 2) — nothing here touches how overlay-client.js actually renders.
 */
function adaptLegacyTheme(themeId) {
  if (!legacyThemeExists(themeId)) {
    throw new Error(`[legacy-adapter] no legacy theme found at themes/${themeId}`);
  }

  const dir = path.join(THEMES_DIR, themeId);
  const templateHtml = fs.readFileSync(path.join(dir, 'template.html'), 'utf-8');
  const config = readJson(path.join(dir, 'default-config.json'));
  const slots = parseSlotOrder(templateHtml);
  const hasThumbnail = fs.existsSync(path.join(dir, 'thumbnail.png'));

  return createThemeDocument({
    manifest: {
      id: themeId,
      name: config._label || themeId,
      version: '1.0.0',
      schemaVersion: 'legacy',
      thumbnail: hasThumbnail ? 'thumbnail.png' : null,
      description: `Legacy theme (auto-adapted from themes/${themeId}).`,
    },
    layout: buildLayout(themeId, slots),
    style: buildStyle(config),
    animation: buildAnimation(config),
    // rules is left at its empty default — no legacy theme has any
    // conditional behavior, and none should suddenly gain any just from
    // being adapted.
  });
}

function listLegacyThemeIds() {
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && legacyThemeExists(entry.name))
    .map((entry) => entry.name);
}

module.exports = { adaptLegacyTheme, listLegacyThemeIds, legacyThemeExists, parseSlotOrder };
