const path = require('path');
const crypto = require('crypto');
const { app, ipcMain } = require('electron');

const { createMainWindow } = require('./window-manager');
const { ScraperManager } = require('./scraper-manager');
const { ConfigStore } = require('./store/config-store');
const { startServer } = require('./server/http-server');
const { attachWebSocketServer } = require('./server/ws-server');
const { listThemes, themeExists } = require('./theme-registry');
const { mergeLayoutConfig } = require('../shared/layout-config');
const { mergeSlotStyleConfig } = require('../shared/slot-style-config');
const { mergeAnimationConfig } = require('../shared/animation-config');
const { mergeDecorationConfig } = require('../shared/decoration-config');
const { mergeRoleStyleConfig } = require('../shared/role-style-config');
const { resolveThemeState } = require('./store/theme-state');
const { getDirtyFields } = require('./store/theme-baseline');

const sessionId = crypto.randomUUID();

const MAX_HISTORY = 200;

let mainWindow;
let scraperManager;
let configStore;
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

  mainWindow = createMainWindow({
    preloadPath: path.join(__dirname, '..', 'preload', 'dashboard-preload.js'),
    bounds: configStore.get().windowBounds,
  });

  mainWindow.on('close', () => {
    const { width, height } = mainWindow.getBounds();
    configStore.set({ windowBounds: { width, height } });
  });

  scraperManager = new ScraperManager(mainWindow);

  scraperManager.on('status', (payload) => {
    latestStatus = payload;
    safeSend(mainWindow, 'status:changed', payload);
  });

  scraperManager.on('message', (message) => {
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
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-initial-state', () => {
    const state = configStore.get();
    return {
      status: latestStatus,
      themes: listThemes(),
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
    const result = await scraperManager.connect(url);
    return result;
  });

  ipcMain.handle('app:disconnect', async () => {
    await scraperManager.disconnect();
    messageHistory = [];
    return { ok: true };
  });

  ipcMain.handle('theme:select', (_event, themeId) => {
    if (!themeExists(themeId)) {
      return { ok: false, error: 'theme_not_found' };
    }
    const themeState = resolveThemeState(themeId);
    configStore.set(themeState);

    const {
      customizeConfig: config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
    } = themeState;
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
    const merged = mergeRoleStyleConfig(configStore.get().roleStyleConfig, partialRoleStyle);
    configStore.set({ roleStyleConfig: merged });

    wsBroadcast('role-style:updated', merged);
    safeSend(mainWindow, 'role-style:updated', merged);
    return { ok: true, roleStyleConfig: merged };
  });
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  app.quit();
});
