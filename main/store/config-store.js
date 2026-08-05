const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { resolveThemeState } = require('./theme-state');
const { DEFAULT_FAN_SERVICE_CONFIG, mergeFanServiceConfig } = require('../../shared/fan-service-config');

// Per-port config files live under userData/ports/<storeId>.json.
// The default port also tries to migrate from the legacy userData/config.json
// on first run so existing users don't lose their settings.
function resolveStorePath(storeId) {
  return path.join(app.getPath('userData'), 'ports', `${storeId}.json`);
}

function legacyConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function stripStaleRoleRowDefaults(roleStyleConfig) {
  if (!roleStyleConfig?.roles) return roleStyleConfig;
  const roles = {};
  Object.entries(roleStyleConfig.roles).forEach(([key, role]) => {
    roles[key] = { ...role, rowBg: null, rowBorderColor: null };
  });
  return { roles };
}

// "Chia đôi bubble" header/body split colors used to live at
// layoutConfig.screen.headerBgColor/bodyBgColor. They now read
// slotStyleConfig.slots.author.bubbleBg / slots.message.bubbleBg instead —
// the same fields split-wrap mode's "🖌️ Bubble riêng" panel already writes
// to (see shared/layout-config.js's compileLayoutToCssVariables). This
// one-time migration carries an existing user's chosen header/body colors
// over to their new home so upgrading doesn't visually reset their overlay.
// Only fills in bubbleBg when the slot doesn't already have one set, so it
// never clobbers a color the user picked independently in "🖌️ Bubble riêng".
function migrateHeaderSplitColorsIntoSlotBubbleBg(layoutConfig, slotStyleConfig) {
  const legacyHeader = layoutConfig?.screen?.headerBgColor;
  const legacyBody = layoutConfig?.screen?.bodyBgColor;
  if (legacyHeader == null && legacyBody == null) return slotStyleConfig;

  const slots = slotStyleConfig?.slots || {};
  const author = slots.author || {};
  const message = slots.message || {};

  return {
    ...slotStyleConfig,
    slots: {
      ...slots,
      author: legacyHeader != null && author.bubbleBg == null
        ? { ...author, bubbleBg: legacyHeader }
        : author,
      message: legacyBody != null && message.bubbleBg == null
        ? { ...message, bubbleBg: legacyBody }
        : message,
    },
  };
}

function migrateSuperchatRoleIntoFanService(rawRoleStyleConfig, fanServiceConfig) {
  const legacy = rawRoleStyleConfig?.roles?.superchat;
  // roles.superchat), or legacy.enabled === false (user never actually
  if (!legacy || legacy.enabled === false) {
    return fanServiceConfig;
  }

  // legacy.enabled === true means the user HAD actively customized Super
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
  constructor(storeId = 'default') {
    this.storeId = storeId;
    this.filePath = resolveStorePath(storeId);
    this.state = this._load();
    this._saveTimer = null;
  }

  _load() {
    let persisted = {};
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      persisted = JSON.parse(raw);
    } catch (_err) {
      // New port or first run — try legacy path for the default store
      if (this.storeId === 'default') {
        try {
          const raw = fs.readFileSync(legacyConfigPath(), 'utf-8');
          persisted = JSON.parse(raw);
        } catch { /* truly first run */ }
      }
    }

    const themeId = persisted.selectedTheme || DEFAULT_STATE.selectedTheme;
    const baseline = resolveThemeState(themeId);
    const profile = persisted.userOverlayProfile;

    if (profile?.customizeConfig) {
      const migratedFanServiceConfig = migrateSuperchatRoleIntoFanService(
        profile.roleStyleConfig,
        mergeFanServiceConfig(baseline.fanServiceConfig, profile.fanServiceConfig),
      );
      const migratedSlotStyleConfig = migrateHeaderSplitColorsIntoSlotBubbleBg(
        profile.layoutConfig,
        profile.slotStyleConfig ?? baseline.slotStyleConfig,
      );
      return {
        ...baseline,
        selectedTheme: themeId,
        customizeConfig: profile.customizeConfig,
        layoutConfig: profile.layoutConfig ?? baseline.layoutConfig,
        slotStyleConfig: migratedSlotStyleConfig,
        animationConfig: profile.animationConfig ?? baseline.animationConfig,
        decorationConfig: profile.decorationConfig ?? baseline.decorationConfig,
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
      console.error(`[config-store:${this.storeId}] failed to write config:`, err);
    }
  }

  /** Remove the backing file when this port is deleted. */
  deleteFile() {
    try { fs.unlinkSync(this.filePath); } catch { /* already gone */ }
  }
}

module.exports = {
  ConfigStore,
  DEFAULT_STATE,
  buildUserOverlayProfile,
  migrateSuperchatRoleIntoFanService,
  migrateHeaderSplitColorsIntoSlotBubbleBg,
};