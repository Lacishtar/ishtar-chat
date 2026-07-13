/**
 * theme-manager.js — Pure data-layer facade for the Theme System.
 *
 * Responsibilities:
 *   GetThemeList()       — return the full list of available themes (metadata only).
 *   LoadTheme(id)        — return a fully-normalised theme object by id.
 *   ValidateTheme(obj)   — verify that an object looks like a complete theme.
 *   NormalizeTheme(obj)  — fill every missing/null field with canonical defaults.
 *   ApplyTheme(id, store) — apply a theme into the live config-store and return
 *                           the resulting six config categories.
 *   ResetCurrentTheme(store) — re-apply the current theme's defaults (delegates to
 *                              the existing theme:reset-preset flow).
 *   ResetCategory(category, store) — reset only one config category to its
 *                                     theme baseline while leaving others intact.
 *
 * RULES (kept by design):
 *   - NO DOM manipulation.
 *   - NO rendering logic.
 *   - NO UI / IPC references.
 *   - Depends ONLY on shared/* config modules and shared/theme-presets.js.
 *   - The renderer must not know how themes are stored.
 *   - The UI must not know theme implementation details.
 */

'use strict';

const { BUILTIN_THEMES } = require('./theme-presets');

const { DEFAULT_CUSTOMIZE_CONFIG } = require('./customize-config');
const { DEFAULT_LAYOUT_CONFIG, mergeLayoutConfig } = require('./layout-config');
const { DEFAULT_SLOT_STYLE_CONFIG, mergeSlotStyleConfig } = require('./slot-style-config');
const { DEFAULT_ANIMATION_CONFIG, mergeAnimationConfig } = require('./animation-config');
const { DEFAULT_DECORATION_CONFIG, mergeDecorationConfig } = require('./decoration-config');
const { DEFAULT_ROLE_STYLE_CONFIG, mergeRoleStyleConfig } = require('./role-style-config');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a lookup map from theme id → theme object (O(1) access).
 * Rebuilt once on module load — the built-in list is static.
 */
const _themeMap = new Map(BUILTIN_THEMES.map((p) => [p.id, p]));

/** The six recognised config category keys. */
const CONFIG_CATEGORIES = [
  'customizeConfig',
  'layoutConfig',
  'slotStyleConfig',
  'animationConfig',
  'decorationConfig',
  'roleStyleConfig',
];

/** Merge helper mapping category name → merge function. */
const MERGE_FN = {
  customizeConfig: (base, overrides) => ({ ...base, ...overrides }),
  layoutConfig: mergeLayoutConfig,
  slotStyleConfig: mergeSlotStyleConfig,
  animationConfig: mergeAnimationConfig,
  decorationConfig: mergeDecorationConfig,
  roleStyleConfig: mergeRoleStyleConfig,
};

/** Default baselines mapping category name → default object. */
const CATEGORY_DEFAULTS = {
  customizeConfig: DEFAULT_CUSTOMIZE_CONFIG,
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  slotStyleConfig: DEFAULT_SLOT_STYLE_CONFIG,
  animationConfig: DEFAULT_ANIMATION_CONFIG,
  decorationConfig: DEFAULT_DECORATION_CONFIG,
  roleStyleConfig: DEFAULT_ROLE_STYLE_CONFIG,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a lightweight list of available themes for display in picker UIs.
 * Only safe-to-expose metadata is included — no full config objects.
 *
 * @returns {{ id: string, name: string, description: string, author: string,
 *             version: string, category: string, tags: string[] }[]}
 */
function GetThemeList() {
  return BUILTIN_THEMES.map(({ id, name, description, author, version, category, tags }) => ({
    id, name, description,
    author: author || 'built-in',
    version: version || '1.0.0',
    category: category || 'dark',
    tags: tags || [],
  }));
}

/**
 * Loads a theme by id and returns it fully normalised.
 * Returns null if no theme with that id exists.
 *
 * @param {string} id
 * @returns {object|null}
 */
function LoadTheme(id) {
  const theme = _themeMap.get(id);
  if (!theme) return null;
  return NormalizeTheme(theme);
}

/**
 * Validates that `obj` contains every required config category and that each
 * category is a non-null plain object.
 *
 * @param {unknown} obj
 * @returns {{ valid: boolean, errors: string[] }}
 */
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

/**
 * Fills every missing field of each config category with canonical defaults,
 * using the same merge functions the rest of the application relies on.
 * This guarantees that the returned object is complete and safe to apply.
 *
 * @param {object} raw — a (possibly partial) preset or user-supplied theme object.
 * @returns {object} — a fully-normalised theme object with all six categories.
 */
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

/**
 * Applies a named theme into the given config-store instance and broadcasts
 * the change, without touching the overlay theme (the existing theme stays
 * selected; only appearance settings change).
 *
 * The `store` parameter is expected to expose `.get()` and `.set(partial)`,
 * matching the ConfigStore class in main/store/config-store.js.
 *
 * @param {string} themeId
 * @param {{ get: () => object, set: (partial: object) => object }} store
 * @returns {{ ok: boolean, error?: string, customizeConfig?, layoutConfig?,
 *             slotStyleConfig?, animationConfig?, decorationConfig?, roleStyleConfig? }}
 */
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
  } = theme;

  store.set({
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
  });

  return {
    ok: true,
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
  };
}

/**
 * Resets all appearance settings to the defaults of whichever theme is
 * currently selected in the store. This is identical to the existing
 * `theme:reset-preset` IPC handler's logic, expressed as a pure data call.
 *
 * The `resolveThemeState` function is injected by the caller (typically
 * main/store/theme-state.js#resolveThemeState) so that ThemeManager stays
 * decoupled from the file system.
 *
 * @param {{ get: () => object, set: (partial: object) => object }} store
 * @param {(themeId: string) => object} resolveThemeState
 * @returns {{ ok: boolean, customizeConfig?, layoutConfig?,
 *             slotStyleConfig?, animationConfig?, decorationConfig?, roleStyleConfig? }}
 */
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
  } = fresh;

  store.set({
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
  });

  return {
    ok: true,
    customizeConfig,
    layoutConfig,
    slotStyleConfig,
    animationConfig,
    decorationConfig,
    roleStyleConfig,
  };
}

/**
 * Resets a single config category to its theme baseline while leaving all
 * other categories unchanged. The baseline comes from the currently active
 * theme (identified by `themeId`) or, when no matching theme exists, from
 * the category's hard-coded defaults.
 *
 * Valid category values: 'customizeConfig' | 'layoutConfig' | 'slotStyleConfig'
 *                        | 'animationConfig' | 'decorationConfig' | 'roleStyleConfig'
 *
 * @param {string} category — one of CONFIG_CATEGORIES
 * @param {string|null} themeId — the id of the currently active theme (may be null)
 * @param {{ get: () => object, set: (partial: object) => object }} store
 * @returns {{ ok: boolean, error?: string, category?: string, [category]?: object }}
 */
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
// Exports
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
