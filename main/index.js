const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, ipcMain, dialog } = require('electron');

const { createMainWindow } = require('./window-manager');
const { CaptureManager } = require('./capture-manager');
const { ConfigStore } = require('./store/config-store');
const { CustomPresetsStore, validateImportedPresets } = require('./store/custom-presets-store');
const { startServer } = require('./server/http-server');
const { attachWebSocketServer } = require('./server/ws-server');
const { mergeLayoutConfig } = require('../shared/layout-config');
const { mergeSlotStyleConfig } = require('../shared/slot-style-config');
const { mergeAnimationConfig } = require('../shared/animation-config');
const { mergeDecorationConfig } = require('../shared/decoration-config');
const { mergeRoleStyleConfig } = require('../shared/role-style-config');
const { resolveThemeState } = require('./store/theme-state');
const { getDirtyFields } = require('./store/theme-baseline');
const { GetThemeList, ApplyTheme, ResetCategory } = require('../shared/theme-manager');
const { initializeAutoUpdater } = require('./auto-updater');

const sessionId = crypto.randomUUID();

const MAX_HISTORY = 200;

let mainWindow;
let captureManager;
let configStore;
let customPresetsStore;
let httpPort;
let wsBroadcast;
let latestStatus = { status: 'idle', error: null, videoId: null };
let messageHistory = [];

function getOverlayState() {
  const state = configStore.get();
  return {
    themeId: state.selectedTheme,
    config: state.customizeConfig,
    layoutConfig: state.layoutConfig,
    slotStyleConfig: state.slotStyleConfig,
    animationConfig: state.animationConfig,
    decorationConfig: state.decorationConfig,
    roleStyleConfig: state.roleStyleConfig,
    sessionId,
    history: messageHistory,
  };
}

function getOverlayUrl() {
  return `http://localhost:${httpPort}/overlay?session=${sessionId}`;
}

function safeSend(win, channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

async function bootstrap() {
  configStore = new ConfigStore();
  customPresetsStore = new CustomPresetsStore();

  mainWindow = createMainWindow({
    preloadPath: path.join(__dirname, '..', 'preload', 'dashboard-preload.js'),
    bounds: configStore.get().windowBounds,
  });

  mainWindow.on('close', () => {
    const { width, height } = mainWindow.getBounds();
    configStore.set({ windowBounds: { width, height } });
  });

  captureManager = new CaptureManager(mainWindow);

  captureManager.on('status', (payload) => {
    latestStatus = payload;
    safeSend(mainWindow, 'status:changed', payload);
  });

  captureManager.on('message', (message) => {
    messageHistory.push(message);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory = messageHistory.slice(-MAX_HISTORY);
    }

    safeSend(mainWindow, 'chat:new', message);
    if (wsBroadcast) wsBroadcast('chat:new', message);
  });

  const { server, port } = await startServer(getOverlayState, 3000, 10);
  httpPort = port;
  const { broadcast } = attachWebSocketServer(server, getOverlayState);
  wsBroadcast = broadcast;

  registerIpcHandlers();

  // Khởi tạo hệ thống tự động cập nhật
  initializeAutoUpdater();
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-initial-state', () => {
    const state = configStore.get();
    return {
      status: latestStatus,
      selectedTheme: state.selectedTheme,
      customizeConfig: state.customizeConfig,
      layoutConfig: state.layoutConfig,
      slotStyleConfig: state.slotStyleConfig,
      animationConfig: state.animationConfig,
      decorationConfig: state.decorationConfig,
      roleStyleConfig: state.roleStyleConfig,
      lastSessionUrl: state.lastSessionUrl,
      overlayUrl: getOverlayUrl(),
      port: httpPort,
    };
  });

  ipcMain.handle('app:connect', async (_event, url) => {
    configStore.set({ lastSessionUrl: url });
    messageHistory = [];
    const result = await captureManager.connect(url);
    return result;
  });

  ipcMain.handle('app:disconnect', async () => {
    await captureManager.disconnect();
    messageHistory = [];
    return { ok: true };
  });

  ipcMain.handle('theme:is-dirty', () => {
    const state = configStore.get();
    const dirtyFields = getDirtyFields(state, state.selectedTheme);
    return { dirty: dirtyFields.length > 0, dirtyFields };
  });

  ipcMain.handle('theme:reset-preset', () => {
    const themeId = configStore.get().selectedTheme;
    const fresh = resolveThemeState(themeId);
    configStore.set({
      customizeConfig: fresh.customizeConfig,
      layoutConfig: fresh.layoutConfig,
      slotStyleConfig: fresh.slotStyleConfig,
      animationConfig: fresh.animationConfig,
      decorationConfig: fresh.decorationConfig,
      roleStyleConfig: fresh.roleStyleConfig,
    });

    const {
      customizeConfig: config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
    } = fresh;
    wsBroadcast('theme:changed', {
      themeId,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
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
    });
    return {
      ok: true,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
    };
  });

  ipcMain.handle('config:update', (_event, partialConfig) => {
    const merged = { ...configStore.get().customizeConfig, ...partialConfig };
    configStore.set({ customizeConfig: merged });

    wsBroadcast('config:updated', merged);
    return { ok: true, config: merged };
  });

  ipcMain.handle('layout:update', (_event, partialLayout) => {
    const merged = mergeLayoutConfig(configStore.get().layoutConfig, partialLayout);
    configStore.set({ layoutConfig: merged });

    wsBroadcast('layout:updated', merged);
    return { ok: true, layoutConfig: merged };
  });

  ipcMain.handle('slot-style:update', (_event, partialSlotStyle) => {
    const merged = mergeSlotStyleConfig(configStore.get().slotStyleConfig, partialSlotStyle);
    configStore.set({ slotStyleConfig: merged });

    wsBroadcast('slot-style:updated', merged);
    return { ok: true, slotStyleConfig: merged };
  });

  ipcMain.handle('animation:update', (_event, partialAnimation) => {
    const merged = mergeAnimationConfig(configStore.get().animationConfig, partialAnimation);
    configStore.set({ animationConfig: merged });

    wsBroadcast('animation:updated', merged);
    return { ok: true, animationConfig: merged };
  });

  ipcMain.handle('decoration:update', (_event, partialDecoration) => {
    const merged = mergeDecorationConfig(configStore.get().decorationConfig, partialDecoration);
    configStore.set({ decorationConfig: merged });

    wsBroadcast('decoration:updated', merged);
    safeSend(mainWindow, 'decoration:updated', merged);
    return { ok: true, decorationConfig: merged };
  });

  ipcMain.handle('role-style:update', (_event, partialRoleStyle) => {
    const before = configStore.get().roleStyleConfig;
    const merged = mergeRoleStyleConfig(before, partialRoleStyle);
    configStore.set({ roleStyleConfig: merged });

    wsBroadcast('role-style:updated', merged);
    safeSend(mainWindow, 'role-style:updated', merged);
    return { ok: true, roleStyleConfig: merged };
  });

  ipcMain.handle('theme:list', () => {
    return GetThemeList();
  });

  ipcMain.handle('theme:apply', (_event, themePresetId) => {
    const result = ApplyTheme(themePresetId, configStore);
    if (!result.ok) return result;

    const { customizeConfig: config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig } = result;
    const themeId = configStore.get().selectedTheme;

    wsBroadcast('theme:changed', { themeId, config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig, history: messageHistory });
    safeSend(mainWindow, 'theme:changed', { themeId, config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig });

    return result;
  });

  // Category → WebSocket broadcast channel mapping
  const CATEGORY_BROADCAST = {
    customizeConfig:  { channel: 'config:updated',     key: 'customizeConfig',  payloadKey: 'config' },
    layoutConfig:     { channel: 'layout:updated',     key: 'layoutConfig',     payloadKey: 'layoutConfig' },
    slotStyleConfig:  { channel: 'slot-style:updated', key: 'slotStyleConfig',  payloadKey: 'slotStyleConfig' },
    animationConfig:  { channel: 'animation:updated',  key: 'animationConfig',  payloadKey: 'animationConfig' },
    decorationConfig: { channel: 'decoration:updated', key: 'decorationConfig', payloadKey: 'decorationConfig' },
    roleStyleConfig:  { channel: 'role-style:updated', key: 'roleStyleConfig',  payloadKey: 'roleStyleConfig' },
  };

  ipcMain.handle('theme:reset-category', (_event, category) => {
    const result = ResetCategory(category, null, configStore);
    if (!result.ok) return result;

    const broadcastInfo = CATEGORY_BROADCAST[category];
    if (broadcastInfo) {
      const value = configStore.get()[broadcastInfo.key];
      wsBroadcast(broadcastInfo.channel, value);
      safeSend(mainWindow, broadcastInfo.channel, value);
    }

    return result;
  });

  // ── Custom Presets ──────────────────────────────────────────────────────────

  ipcMain.handle('custom-preset:list', () => {
    return customPresetsStore.list();
  });

  ipcMain.handle('custom-preset:save', (_event, { name, snapshot }) => {
    const list = customPresetsStore.save(name, snapshot);
    return { ok: true, list };
  });

  ipcMain.handle('custom-preset:delete', (_event, id) => {
    return customPresetsStore.delete(id);
  });

  ipcMain.handle('custom-preset:rename', (_event, { id, newName }) => {
    return customPresetsStore.rename(id, newName);
  });

  ipcMain.handle('custom-preset:apply', (_event, id) => {
    const preset = customPresetsStore.get(id);
    if (!preset) return { ok: false, error: 'preset_not_found' };

    const { customizeConfig, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig } = preset;
    configStore.set({ customizeConfig, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig });

    const themeId = configStore.get().selectedTheme;
    const themePayload = {
      themeId,
      config: customizeConfig,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      history: messageHistory,
    };
    wsBroadcast('theme:changed', themePayload);
    safeSend(mainWindow, 'theme:changed', {
      themeId,
      config: customizeConfig,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
    });

    return { ok: true, customizeConfig, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig };
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
