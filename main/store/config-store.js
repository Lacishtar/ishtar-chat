const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { resolveThemeState } = require('./theme-state');

const DEFAULT_STATE = {
  lastSessionUrl: '',
  selectedTheme: 'classic',
  windowBounds: { width: 1180, height: 760 },
};

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
    return {
      ...resolveThemeState(themeId),
      lastSessionUrl: persisted.lastSessionUrl || '',
      windowBounds: persisted.windowBounds || DEFAULT_STATE.windowBounds,
    };
  }

  get() {
    return this.state;
  }

  // Persist only session prefs — theme visuals always reload from themes/ on boot.
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
    };
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('[config-store] failed to write config.json:', err);
    }
  }
}

module.exports = { ConfigStore, DEFAULT_STATE };
