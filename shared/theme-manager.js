// theme-manager.js — Pure data-layer facade for the Theme System.

'use strict';

const { BUILTIN_THEMES } = require('./theme-presets');

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');
const { DEFAULT_LAYOUT_CONFIG, mergeLayoutConfig } = require('./layout-config');
const { DEFAULT_SLOT_STYLE_CONFIG, mergeSlotStyleConfig } = require('./slot-style-config');
const { DEFAULT_ANIMATION_CONFIG, mergeAnimationConfig } = require('./animation-config');
const { DEFAULT_DECORATION_CONFIG, mergeDecorationConfig } = require('./decoration-config');
const { DEFAULT_ROLE_STYLE_CONFIG, mergeRoleStyleConfig } = require('./role-style-config');
const { DEFAULT_FAN_SERVICE_CONFIG, mergeFanServiceConfig } = require('./fan-service-config');

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Build a lookup map from theme id → theme object (O(1) access).
const _themeMap = new Map(BUILTIN_THEMES.map((p) => [p.id, p]));

// The seven recognised config category keys. fanServiceConfig joined the
const CONFIG_CATEGORIES = [
  'customizeConfig',
  'layoutConfig',
  'slotStyleConfig',
  'animationConfig',
  'decorationConfig',
  'roleStyleConfig',
  'fanServiceConfig',
];

/** Merge helper mapping category name → merge function. */
const MERGE_FN = {
  customizeConfig: (base, overrides) => ({ ...base, ...overrides }),
  layoutConfig: mergeLayoutConfig,
  slotStyleConfig: mergeSlotStyleConfig,
  animationConfig: mergeAnimationConfig,
  decorationConfig: mergeDecorationConfig,
  roleStyleConfig: mergeRoleStyleConfig,
  fanServiceConfig: mergeFanServiceConfig,
};

/** Default baselines mapping category name → default object. */
const CATEGORY_DEFAULTS = {
  customizeConfig: DEFAULT_CUSTOMIZE_CONFIG,
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  slotStyleConfig: DEFAULT_SLOT_STYLE_CONFIG,
  animationConfig: DEFAULT_ANIMATION_CONFIG,
  decorationConfig: DEFAULT_DECORATION_CONFIG,
  roleStyleConfig: DEFAULT_ROLE_STYLE_CONFIG,
  fanServiceConfig: DEFAULT_FAN_SERVICE_CONFIG,
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Returns a lightweight list of available themes for display in picker UIs.
function GetThemeList() {
  return BUILTIN_THEMES.map(({ id, name, description, author, version, category, tags }) => ({
    id, name, description,
    author: author || 'built-in',
    version: version || '1.0.0',
    category: category || 'dark',
    tags: tags || [],
  }));
}

// Loads a theme by id and returns it fully normalised.
function LoadTheme(id) {
  const theme = _themeMap.get(id);
  if (!theme) return null;
  return NormalizeTheme(theme);
}

// Validates that `obj` contains every required config category and that each
function ValidateTheme(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Theme must be a plain object.'] };
  }

  for (const cat of CONFIG_CATEGORIES) {
    if (!(cat in obj)) {
      errors.push(`Missing required category: "${cat}".`);
    } else if (obj[cat] === null || typeof obj[cat] !== 'object') {
      errors.push(`Category "${cat}" must be a non-null object.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Fills every missing field of each config category with canonical defaults,
function NormalizeTheme(raw) {
  const src = raw || {};
  const normalized = {};

  for (const cat of CONFIG_CATEGORIES) {
    const defaults = CATEGORY_DEFAULTS[cat];
    const incoming = src[cat] || {};
    const merge = MERGE_FN[cat];
    normalized[cat] = merge(defaults, incoming);
  }

  return normalized;
}

// Applies a named theme into the given config-store instance and broadcasts
function ApplyTheme(themeId, store) {
  const theme = LoadTheme(themeId);
  if (!theme) {
    return { ok: false, error: `Unknown theme id: "${themeId}".` };
  }

  const {
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  } = theme;

  store.set({
    selectedTheme: themeId,
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  });

  return {
    ok: true,
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  };
}

// Resets all appearance settings to the defaults of whichever theme is
function ResetCurrentTheme(store, resolveThemeState) {
  const themeId = store.get().selectedTheme;
  const fresh = resolveThemeState(themeId);

  const {
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  } = fresh;

  store.set({
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  });

  return {
    ok: true,
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
    fanServiceConfig,
  };
}

// Resets a single config category to its theme baseline while leaving all
function ResetCategory(category, themeId, store) {
  if (!CONFIG_CATEGORIES.includes(category)) {
    return {
      ok: false,
      error: `Unknown config category: "${category}". Valid values: ${CONFIG_CATEGORIES.join(', ')}.`,
    };
  }

  // Determine the reset target: named theme baseline or hard-coded default.
  let resetValue;
  if (themeId) {
    const theme = LoadTheme(themeId);
    resetValue = theme ? theme[category] : CATEGORY_DEFAULTS[category];
  } else {
    resetValue = CATEGORY_DEFAULTS[category];
  }

  store.set({ [category]: resetValue });

  return { ok: true, category, [category]: resetValue };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

module.exports = {
  GetThemeList,
  LoadTheme,
  ValidateTheme,
  NormalizeTheme,
  ApplyTheme,
  ResetCurrentTheme,
  ResetCategory,
  /** Exposed for tests / diagnostics — not part of the public contract. */
  CONFIG_CATEGORIES,
};
