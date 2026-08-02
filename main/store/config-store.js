const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { resolveThemeState } = require('./theme-state');
const { DEFAULT_FAN_SERVICE_CONFIG, mergeFanServiceConfig } = require('../../shared/fan-service-config');

// One-time migration for config.json files saved before the row-bg fix:
// older code let a role's `rowBg`/`rowBorderColor` get permanently baked in
// as a literal value (from the default config, or from whichever theme was
// selected at the time) and then kept echoing it back on every dashboard
// edit forever, since no dashboard panel actually exposes a control for
// these two fields. There's no legitimate source for them once a profile
// has been through that old code path, so on load we just release them —
// the normal fallback (rowBg -> messageBg -> theme default) takes over
// again immediately and reflects whatever messageBg is actually set to.
function stripStaleRoleRowDefaults(roleStyleConfig) {
  if (!roleStyleConfig?.roles) return roleStyleConfig;
  const roles = {};
  Object.entries(roleStyleConfig.roles).forEach(([key, role]) => {
    roles[key] = { ...role, rowBg: null, rowBorderColor: null };
  });
  return { roles };
}

// One-time migration for config.json files saved before the Super Chat ->
// Fan Service refactor (docs/refactor-superchat-to-fanservice.md section 4):
// older code let the user customize Super Chat's color/badge/amount via
// roleStyleConfig.roles.superchat. That key no longer exists in the
// normalized shape (shared/role-style-config.js#ROLE_KEYS is now
// ['moderator', 'member']), so a legacy config.json still carrying it needs
// its meaningful fields carried over into fanServiceConfig.superchat before
// the old key is dropped — otherwise a user who had customized Super Chat
// via the old Role tab would silently lose that customization the first
// time they open the app after updating.
//
// `roleStyleConfig` here is the RAW persisted object (read directly from
// config.json, not yet run through normalizeRoleStyleConfig() — which
// would already have stripped roles.superchat) — see how this is called in
// _load() below, using `profile.roleStyleConfig` rather than the already-
// normalized `roleStyleConfig` local.
function migrateSuperchatRoleIntoFanService(rawRoleStyleConfig, fanServiceConfig) {
  const legacy = rawRoleStyleConfig?.roles?.superchat;
  // Nothing to migrate: config is already on the new schema (no
  // roles.superchat), or legacy.enabled === false (user never actually
  // turned on a custom Super Chat style via the old Role tab) — leave
  // fanServiceConfig.superchat exactly as-is, don't overwrite with legacy
  // defaults just because the key happened to exist.
  if (!legacy || legacy.enabled === false) {
    return fanServiceConfig;
  }

  // legacy.enabled === true means the user HAD actively customized Super
  // Chat color/badge/amount via the old Role tab. If Fan Service's own
  // superchat.enabled is already true (user is also using Fan Service),
  // prefer what's already there — don't clobber a deliberate Fan Service
  // choice with old Role values. Only migrate when Fan Service superchat
  // is NOT yet enabled, so the overlay's appearance doesn't change out from
  // under the user the moment they update.
  const fsSuperchat = fanServiceConfig?.superchat || {};
  if (fsSuperchat.enabled) {
    return fanServiceConfig;
  }

  return {
    ...fanServiceConfig,
    superchat: {
      ...fsSuperchat,
      enabled: true, // turn Fan Service on so the overlay keeps looking the same as before
      useTierColor: legacy.useTierColor !== false,
      badgeBefore: legacy.badgeBefore ?? fsSuperchat.badgeBefore ?? null,
      badgeAfter: legacy.badgeAfter ?? fsSuperchat.badgeAfter ?? null,
      // Always on now — no user-facing switch exists for this any more,
      // so the migration ignores whatever the legacy value was.
      showAmount: true,
      amountPosition: legacy.amountPosition === 'block' ? 'block' : 'inline',
      // amountFontSize (old absolute px) -> amountFontScale (new scale,
      // 1 = BASE_SIZES.amountFontSize = 16px — see shared/fan-service-config.js).
      amountFontScale: typeof legacy.amountFontSize === 'number' && legacy.amountFontSize > 0
        ? legacy.amountFontSize / 16
        : (fsSuperchat.amountFontScale ?? 1),
      amountFontWeight: legacy.amountFontWeight || 'bold',
      // No tier color: carry the old manual colors over to the fields Fan
      // Service already has for this (authorColor/messageColor), rather
      // than adding a new field.
      ...(legacy.useTierColor === false
        ? {
            authorColor: legacy.authorColor || fsSuperchat.authorColor,
            messageColor: legacy.messageTextColor || fsSuperchat.messageColor,
          }
        : {}),
    },
  };
}

const DEFAULT_STATE = {
  lastSessionUrl: '',
  selectedTheme: 'default',
  windowBounds: { width: 1180, height: 760 },
  // Fan Service is now part of the theme-baseline system, same as the
  // other six config categories — every built-in theme ships its own
  // fanServiceConfig (see shared/theme-presets/helpers.js#defaultThemeFanService
  // and docs/refactor-superchat-to-fanservice.md Open Question OQ-1).
  // DEFAULT_FAN_SERVICE_CONFIG here only backs a brand-new profile before
  // _load() below resolves the actual selected theme's own baseline.
  fanServiceConfig: DEFAULT_FAN_SERVICE_CONFIG,
};

function buildUserOverlayProfile(state) {
  return {
    customizeConfig: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
    animationConfig: state.animationConfig,
    decorationConfig: state.decorationConfig,
    roleStyleConfig: state.roleStyleConfig,
    fanServiceConfig: state.fanServiceConfig,
  };
}

class ConfigStore {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'config.json');
    this.state = this._load();
    this._saveTimer = null;
  }

  _load() {
    let persisted = {};
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      persisted = JSON.parse(raw);
    } catch (_err) {
      // first run — no config.json yet
    }

    const themeId = persisted.selectedTheme || DEFAULT_STATE.selectedTheme;
    const baseline = resolveThemeState(themeId);
    const profile = persisted.userOverlayProfile;

    if (profile?.customizeConfig) {
      const migratedFanServiceConfig = migrateSuperchatRoleIntoFanService(
        profile.roleStyleConfig,
        // Merge onto the selected theme's OWN fanServiceConfig baseline
        // now (not the app-wide DEFAULT_FAN_SERVICE_CONFIG) — a profile
        // that never touched Fan Service should pick up its theme's
        // preset, exactly like every other category below falls back to
        // `baseline.<category>`. A profile that DID save a full
        // fanServiceConfig still wins entirely, since mergeFanServiceConfig
        // overrides every field the saved object already has.
        mergeFanServiceConfig(baseline.fanServiceConfig, profile.fanServiceConfig),
      );
      return {
        ...baseline,
        selectedTheme: themeId,
        customizeConfig: profile.customizeConfig,
        layoutConfig: profile.layoutConfig ?? baseline.layoutConfig,
        slotStyleConfig: profile.slotStyleConfig ?? baseline.slotStyleConfig,
        animationConfig: profile.animationConfig ?? baseline.animationConfig,
        decorationConfig: profile.decorationConfig ?? baseline.decorationConfig,
        // normalizeRoleStyleConfig() (called inside stripStaleRoleRowDefaults's
        // consumers, e.g. compileRoleStyleToCssVariables) drops roles.superchat
        // on its own now that ROLE_KEYS no longer includes it — no extra
        // stripping needed here beyond what stripStaleRoleRowDefaults already did.
        roleStyleConfig: stripStaleRoleRowDefaults(profile.roleStyleConfig) ?? baseline.roleStyleConfig,
        fanServiceConfig: migratedFanServiceConfig,
        lastSessionUrl: persisted.lastSessionUrl || '',
        windowBounds: persisted.windowBounds || DEFAULT_STATE.windowBounds,
      };
    }

    return {
      ...baseline,
      fanServiceConfig: mergeFanServiceConfig(baseline.fanServiceConfig, persisted.userOverlayProfile?.fanServiceConfig),
      lastSessionUrl: persisted.lastSessionUrl || '',
      windowBounds: persisted.windowBounds || DEFAULT_STATE.windowBounds,
    };
  }

  get() {
    return this.state;
  }

  set(partial) {
    this.state = { ...this.state, ...partial };
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 300);
    return this.state;
  }

  _flush() {
    const payload = {
      lastSessionUrl: this.state.lastSessionUrl,
      selectedTheme: this.state.selectedTheme,
      windowBounds: this.state.windowBounds,
      userOverlayProfile: buildUserOverlayProfile(this.state),
    };
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('[config-store] failed to write config.json:', err);
    }
  }
}

module.exports = { ConfigStore, DEFAULT_STATE, buildUserOverlayProfile, migrateSuperchatRoleIntoFanService };