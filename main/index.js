const fs = require('fs');
const path = require('path');
const { app, ipcMain, dialog } = require('electron');

const { createMainWindow } = require('./window-manager');
const { CaptureManager } = require('./capture-manager');
const { CreditsManager } = require('./credits-manager');
const { CustomPresetsStore, validateImportedPresets } = require('./store/custom-presets-store');
const { PortManager } = require('./port-manager');
const { mergeLayoutConfig } = require('../shared/layout-config');
const { mergeSlotStyleConfig } = require('../shared/slot-style-config');
const { mergeAnimationConfig } = require('../shared/animation-config');
const { mergeDecorationConfig } = require('../shared/decoration-config');
const { mergeRoleStyleConfig } = require('../shared/role-style-config');
const { mergeFanServiceConfig } = require('../shared/fan-service-config');
const { resolveThemeState } = require('./store/theme-state');
const { getDirtyFields } = require('./store/theme-baseline');
const { GetThemeList, ApplyTheme, ResetCategory } = require('../shared/theme-manager');
const { initializeAutoUpdater } = require('./auto-updater');

const MAX_HISTORY = 200;

let mainWindow;
let captureManager;
let creditsManager;
let customPresetsStore;
let portManager;
let latestStatus = { status: 'idle', error: null, videoId: null };
let messageHistory = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeSend(win, channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

/** Selected port's configStore (shorthand). */
function cs() {
  return portManager.getSelected().configStore;
}

// ── Stream Credits: scroll-speed persistence ────────────────────────────────
// Global (not per-port) — the credits roll-up speed is a viewing preference,
// not part of an overlay's visual profile, so one file next to
// palette-colors.json is enough; no need to fold it into ConfigStore.
const { MIN_SCROLL_SPEED, MAX_SCROLL_SPEED, DEFAULT_SCROLL_SPEED } = require('./credits-manager');

function creditsScrollSpeedPath() {
  return path.join(app.getPath('userData'), 'credits-scroll-speed.json');
}

function loadCreditsScrollSpeed() {
  try {
    const raw = fs.readFileSync(creditsScrollSpeedPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    const n = Number(parsed?.scrollSpeed);
    if (Number.isFinite(n)) return Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, n));
  } catch { /* first run */ }
  return DEFAULT_SCROLL_SPEED;
}

function saveCreditsScrollSpeed(value) {
  try {
    fs.writeFileSync(creditsScrollSpeedPath(), JSON.stringify({ scrollSpeed: value }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[credits-scroll-speed] failed to save:', err);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  portManager = new PortManager(
    () => messageHistory,
    () => (creditsManager
      ? { sections: creditsManager.listSections(), snapshots: creditsManager.getAllSnapshots(), scrollSpeed: creditsManager.getScrollSpeed(), isPlaying: creditsManager.getIsPlaying() }
      : { sections: [], snapshots: {}, scrollSpeed: 1, isPlaying: false }),
  );
  customPresetsStore = new CustomPresetsStore();

  await portManager.initialize();

  // Read window bounds from the default (first) port's config
  const defaultConfig = portManager.getSelected().configStore.get();

  mainWindow = createMainWindow({
    preloadPath: path.join(__dirname, '..', 'preload', 'dashboard-preload.js'),
    bounds: defaultConfig.windowBounds,
  });

  mainWindow.on('close', () => {
    const { width, height } = mainWindow.getBounds();
    // Persist window size into the default port store only
    const defaultEntry = Array.from(portManager.ports.values())[0];
    defaultEntry?.configStore.set({ windowBounds: { width, height } });
  });

  captureManager = new CaptureManager(mainWindow);
  // Reuses captureManager.fetchLeaderboard() under the hood, but purely as a
  // background data source — no UI is tied to it directly anymore.
  creditsManager = new CreditsManager(captureManager, { scrollSpeed: loadCreditsScrollSpeed() });

  captureManager.on('status', (payload) => {
    latestStatus = payload;
    safeSend(mainWindow, 'status:changed', payload);
    // Credits data is never auto-refreshed here — it accumulates silently
    // in the background (CreditsManager.recordMessage) and only becomes a
    // visible snapshot when the streamer manually hits "Tải lại" in the
    // dashboard's Credits tab.
  });

  captureManager.on('message', (message) => {
    messageHistory.push(message);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory = messageHistory.slice(-MAX_HISTORY);
    }

    safeSend(mainWindow, 'chat:new', message);
    // Broadcast new chat messages to EVERY port so all OBS scenes stay in sync
    portManager.broadcastAll('chat:new', message);
  });

  registerIpcHandlers();

  initializeAutoUpdater();
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {

  // ── App / Connection ────────────────────────────────────────────────────────

  ipcMain.handle('app:get-initial-state', () => {
    const state = cs().get();
    const sel = portManager.getSelected();
    return {
      status: latestStatus,
      selectedTheme: state.selectedTheme,
      customizeConfig: state.customizeConfig,
      layoutConfig: state.layoutConfig,
      slotStyleConfig: state.slotStyleConfig,
      animationConfig: state.animationConfig,
      decorationConfig: state.decorationConfig,
      roleStyleConfig: state.roleStyleConfig,
      fanServiceConfig: state.fanServiceConfig,
      lastSessionUrl: state.lastSessionUrl,
      overlayUrl: `http://localhost:${sel.httpPort}/overlay`,
      creditsOverlayUrl: `http://localhost:${sel.httpPort}/overlay/credits`,
      port: sel.httpPort,
      // Multi-port additions
      ports: portManager.list(),
      selectedPortId: portManager.selectedPortId,
    };
  });

  ipcMain.handle('app:connect', async (_event, url) => {
    // lastSessionUrl is stored per-port so each port remembers the same stream
    portManager.ports.forEach(({ configStore }) => configStore.set({ lastSessionUrl: url }));
    messageHistory = [];
    portManager.broadcastAll('chat:cleared', {});
    // Fresh stream — don't carry over the previous session's Credits data.
    creditsManager.reset();
    const result = await captureManager.connect(url);
    return result;
  });

  ipcMain.handle('app:disconnect', async () => {
    // No automatic Credits capture here anymore — data only ever updates via
    // a manual "Tải lại" from the dashboard's Credits tab.
    await captureManager.disconnect();
    messageHistory = [];
    return { ok: true };
  });

  // ── Stream Credits (background-scraped, section-based) ──────────────────

  ipcMain.handle('credits:get-all', () => ({
    sections: creditsManager.listSections(),
    snapshots: creditsManager.getAllSnapshots(),
    scrollSpeed: creditsManager.getScrollSpeed(),
    isPlaying: creditsManager.getIsPlaying(),
  }));

  ipcMain.handle('credits:get-snapshot', (_event, sectionId) => creditsManager.getSnapshot(sectionId));

  ipcMain.handle('credits:refresh-section', async (_event, sectionId) => creditsManager.refreshSection(sectionId));

  ipcMain.handle('credits:refresh-all', async () => creditsManager.refreshAll());

  ipcMain.handle('credits:get-playing', () => creditsManager.getIsPlaying());

  // Turning play ON is the one moment the roll needs to feel instant rather
  // than waiting for the overlay's next ~poll cycle — see POLL_INTERVAL_MS
  // in overlay/credits-client.js for the tradeoff.
  ipcMain.handle('credits:set-playing', (_event, value) => creditsManager.setIsPlaying(value));

  ipcMain.handle('credits:get-scroll-speed', () => creditsManager.getScrollSpeed());

  ipcMain.handle('credits:set-scroll-speed', (_event, value) => {
    const applied = creditsManager.setScrollSpeed(value);
    saveCreditsScrollSpeed(applied);
    return applied;
  });

  // ── Palette Lock Colors (global, persisted across restarts) ─────────────────

  const paletteColorsPath = path.join(app.getPath('userData'), 'palette-colors.json');
  const DEFAULT_PALETTE_COLORS = ['#0F172A', '#38BDF8', '#F87171', '#FACC15'];

  function loadPaletteColors() {
    try {
      const raw = fs.readFileSync(paletteColorsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    } catch { /* first run */ }
    return DEFAULT_PALETTE_COLORS;
  }

  function savePaletteColors(colors) {
    try {
      fs.writeFileSync(paletteColorsPath, JSON.stringify(colors, null, 2), 'utf-8');
    } catch (err) {
      console.error('[palette-colors] failed to save:', err);
    }
  }

  ipcMain.handle('palette-colors:get', () => loadPaletteColors());

  ipcMain.handle('palette-colors:set', (_event, colors) => {
    if (!Array.isArray(colors) || colors.length < 2) return { ok: false };
    savePaletteColors(colors);
    return { ok: true };
  });

  // ── Port Management ─────────────────────────────────────────────────────────

  ipcMain.handle('port:list', () => portManager.list());

  ipcMain.handle('port:create', async (_event, { name }) => {
    const result = await portManager.create(name);
    // After creation, auto-select the new port
    portManager.select(result.id);
    return { ok: true, ...result, ports: portManager.list(), selectedPortId: portManager.selectedPortId };
  });

  ipcMain.handle('port:remove', async (_event, id) => {
    const result = await portManager.remove(id);
    if (!result.ok) return result;
    return { ...result, ports: portManager.list(), selectedPortId: portManager.selectedPortId };
  });

  ipcMain.handle('port:rename', (_event, { id, name }) => {
    const result = portManager.rename(id, name);
    if (!result.ok) return result;
    return { ...result, ports: portManager.list() };
  });

  /**
   * port:select — switch which port the dashboard is editing.
   * Returns the full state of the newly selected port so the dashboard can
   * update its editing buffers without a separate round-trip.
   */
  ipcMain.handle('port:select', (_event, id) => {
    const ok = portManager.select(id);
    if (!ok) return { ok: false, error: 'port_not_found' };

    const state = cs().get();
    const sel = portManager.getSelected();
    return {
      ok: true,
      id,
      selectedTheme: state.selectedTheme,
      customizeConfig: state.customizeConfig,
      layoutConfig: state.layoutConfig,
      slotStyleConfig: state.slotStyleConfig,
      animationConfig: state.animationConfig,
      decorationConfig: state.decorationConfig,
      roleStyleConfig: state.roleStyleConfig,
      fanServiceConfig: state.fanServiceConfig,
      overlayUrl: `http://localhost:${sel.httpPort}/overlay`,
      creditsOverlayUrl: `http://localhost:${sel.httpPort}/overlay/credits`,
      port: sel.httpPort,
      ports: portManager.list(),
      selectedPortId: id,
    };
  });

  // ── Theme ───────────────────────────────────────────────────────────────────

  ipcMain.handle('theme:is-dirty', () => {
    const state = cs().get();
    const dirtyFields = getDirtyFields(state, state.selectedTheme);
    return { dirty: dirtyFields.length > 0, dirtyFields };
  });

  ipcMain.handle('theme:reset-preset', () => {
    const themeId = cs().get().selectedTheme;
    const fresh = resolveThemeState(themeId);
    cs().set({
      customizeConfig: fresh.customizeConfig,
      layoutConfig: fresh.layoutConfig,
      slotStyleConfig: fresh.slotStyleConfig,
      animationConfig: fresh.animationConfig,
      decorationConfig: fresh.decorationConfig,
      roleStyleConfig: fresh.roleStyleConfig,
      fanServiceConfig: fresh.fanServiceConfig,
    });

    const {
      customizeConfig: config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
    } = fresh;

    portManager.broadcastSelected('theme:changed', {
      themeId,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
      history: messageHistory,
    });
    safeSend(mainWindow, 'theme:changed', {
      themeId,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
    });
    return {
      ok: true,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
    };
  });

  ipcMain.handle('theme:list', () => GetThemeList());

  ipcMain.handle('theme:apply', (_event, themePresetId) => {
    const result = ApplyTheme(themePresetId, cs());
    if (!result.ok) return result;

    const { customizeConfig: config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, fanServiceConfig } = result;
    const themeId = cs().get().selectedTheme;

    portManager.broadcastSelected('theme:changed', { themeId, config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, fanServiceConfig, history: messageHistory });
    safeSend(mainWindow, 'theme:changed', { themeId, config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, fanServiceConfig });

    return result;
  });

  // Category → WebSocket broadcast channel mapping
  const CATEGORY_BROADCAST = {
    customizeConfig:  { channel: 'config:updated',      key: 'customizeConfig',  payloadKey: 'config' },
    layoutConfig:     { channel: 'layout:updated',      key: 'layoutConfig',     payloadKey: 'layoutConfig' },
    slotStyleConfig:  { channel: 'slot-style:updated',  key: 'slotStyleConfig',  payloadKey: 'slotStyleConfig' },
    animationConfig:  { channel: 'animation:updated',   key: 'animationConfig',  payloadKey: 'animationConfig' },
    decorationConfig: { channel: 'decoration:updated',  key: 'decorationConfig', payloadKey: 'decorationConfig' },
    roleStyleConfig:  { channel: 'role-style:updated',  key: 'roleStyleConfig',  payloadKey: 'roleStyleConfig' },
    fanServiceConfig: { channel: 'fan-service:updated', key: 'fanServiceConfig', payloadKey: 'fanServiceConfig' },
  };

  ipcMain.handle('theme:reset-category', (_event, category) => {
    const result = ResetCategory(category, null, cs());
    if (!result.ok) return result;

    const broadcastInfo = CATEGORY_BROADCAST[category];
    if (broadcastInfo) {
      const value = cs().get()[broadcastInfo.key];
      portManager.broadcastSelected(broadcastInfo.channel, value);
      safeSend(mainWindow, broadcastInfo.channel, value);
    }

    return result;
  });

  // ── Config updates (all apply to the selected port) ─────────────────────────

  ipcMain.handle('config:update', (_event, partialConfig) => {
    const merged = { ...cs().get().customizeConfig, ...partialConfig };
    cs().set({ customizeConfig: merged });
    portManager.broadcastSelected('config:updated', merged);
    return { ok: true, config: merged };
  });

  ipcMain.handle('layout:update', (_event, partialLayout) => {
    const merged = mergeLayoutConfig(cs().get().layoutConfig, partialLayout);
    cs().set({ layoutConfig: merged });
    portManager.broadcastSelected('layout:updated', merged);
    return { ok: true, layoutConfig: merged };
  });

  ipcMain.handle('slot-style:update', (_event, partialSlotStyle) => {
    const merged = mergeSlotStyleConfig(cs().get().slotStyleConfig, partialSlotStyle);
    cs().set({ slotStyleConfig: merged });
    portManager.broadcastSelected('slot-style:updated', merged);
    return { ok: true, slotStyleConfig: merged };
  });

  ipcMain.handle('animation:update', (_event, partialAnimation) => {
    const merged = mergeAnimationConfig(cs().get().animationConfig, partialAnimation);
    cs().set({ animationConfig: merged });
    portManager.broadcastSelected('animation:updated', merged);
    return { ok: true, animationConfig: merged };
  });

  ipcMain.handle('decoration:update', (_event, partialDecoration) => {
    const merged = mergeDecorationConfig(cs().get().decorationConfig, partialDecoration);
    cs().set({ decorationConfig: merged });
    portManager.broadcastSelected('decoration:updated', merged);
    safeSend(mainWindow, 'decoration:updated', merged);
    return { ok: true, decorationConfig: merged };
  });

  ipcMain.handle('role-style:update', (_event, partialRoleStyle) => {
    const merged = mergeRoleStyleConfig(cs().get().roleStyleConfig, partialRoleStyle);
    cs().set({ roleStyleConfig: merged });
    portManager.broadcastSelected('role-style:updated', merged);
    safeSend(mainWindow, 'role-style:updated', merged);
    return { ok: true, roleStyleConfig: merged };
  });

  ipcMain.handle('fan-service:update', (_event, partialFanService) => {
    const merged = mergeFanServiceConfig(cs().get().fanServiceConfig, partialFanService);
    cs().set({ fanServiceConfig: merged });
    portManager.broadcastSelected('fan-service:updated', merged);
    safeSend(mainWindow, 'fan-service:updated', merged);
    return { ok: true, fanServiceConfig: merged };
  });

  // ── Custom Presets ──────────────────────────────────────────────────────────

  ipcMain.handle('custom-preset:list', () => customPresetsStore.list());

  ipcMain.handle('custom-preset:save', (_event, { name, snapshot }) => {
    const list = customPresetsStore.save(name, snapshot);
    return { ok: true, list };
  });

  ipcMain.handle('custom-preset:delete', (_event, id) => customPresetsStore.delete(id));

  ipcMain.handle('custom-preset:rename', (_event, { id, newName }) => customPresetsStore.rename(id, newName));

  ipcMain.handle('custom-preset:apply', (_event, id) => {
    const preset = customPresetsStore.get(id);
    if (!preset) return { ok: false, error: 'preset_not_found' };

    const { customizeConfig, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, fanServiceConfig } = preset;
    cs().set({
      customizeConfig,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      ...(fanServiceConfig !== undefined ? { fanServiceConfig } : {}),
    });

    const themeId = cs().get().selectedTheme;
    const themePayload = {
      themeId,
      config: customizeConfig,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
      history: messageHistory,
    };
    portManager.broadcastSelected('theme:changed', themePayload);
    safeSend(mainWindow, 'theme:changed', {
      themeId,
      config: customizeConfig,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
    });

    return { ok: true, customizeConfig, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, fanServiceConfig };
  });

  ipcMain.handle('custom-preset:export', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Xuất Custom Presets',
      defaultPath: 'custom-presets.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    try {
      const data = { version: 1, presets: customPresetsStore.exportAll() };
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { ok: true };
    } catch (err) {
      console.error('[main] custom-preset:export failed:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('custom-preset:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Nhập Custom Presets',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };

    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(raw);
      const { valid, errors, presets } = validateImportedPresets(parsed);

      if (!valid) return { ok: false, errors };

      const stats = customPresetsStore.importPresets(presets);
      return { ok: true, ...stats, list: customPresetsStore.list() };
    } catch (err) {
      console.error('[main] custom-preset:import failed:', err);
      return { ok: false, error: err.message };
    }
  });
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  app.quit();
});
