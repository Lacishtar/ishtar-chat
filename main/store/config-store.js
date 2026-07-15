const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { resolveThemeState } = require('./theme-state');

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

const DEFAULT_STATE = {
  lastSessionUrl: '',
  selectedTheme: 'classic',
  windowBounds: { width: 1180, height: 760 },
};

function buildUserOverlayProfile(state) {
  return {
    customizeConfig: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
    animationConfig: state.animationConfig,
    decorationConfig: state.decorationConfig,
    roleStyleConfig: state.roleStyleConfig,
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
      return {
        ...baseline,
        selectedTheme: themeId,
        customizeConfig: profile.customizeConfig,
        layoutConfig: profile.layoutConfig ?? baseline.layoutConfig,
        slotStyleConfig: profile.slotStyleConfig ?? baseline.slotStyleConfig,
        animationConfig: profile.animationConfig ?? baseline.animationConfig,
        decorationConfig: profile.decorationConfig ?? baseline.decorationConfig,
        roleStyleConfig: stripStaleRoleRowDefaults(profile.roleStyleConfig) ?? baseline.roleStyleConfig,
        lastSessionUrl: persisted.lastSessionUrl || '',
        windowBounds: persisted.windowBounds || DEFAULT_STATE.windowBounds,
      };
    }

    return {
      ...baseline,
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

module.exports = { ConfigStore, DEFAULT_STATE, buildUserOverlayProfile };