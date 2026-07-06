const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  getInitialState: () => ipcRenderer.invoke('app:get-initial-state'),
  connect: (url) => ipcRenderer.invoke('app:connect', url),
  disconnect: () => ipcRenderer.invoke('app:disconnect'),
  selectTheme: (themeId) => ipcRenderer.invoke('theme:select', themeId),
  isThemeDirty: () => ipcRenderer.invoke('theme:is-dirty'),
  resetPreset: () => ipcRenderer.invoke('theme:reset-preset'),
  updateConfig: (partialConfig) => ipcRenderer.invoke('config:update', partialConfig),
  updateLayout: (partialLayout) => ipcRenderer.invoke('layout:update', partialLayout),
  updateSlotStyle: (partialSlotStyle) => ipcRenderer.invoke('slot-style:update', partialSlotStyle),
  updateAnimation: (partialAnimation) => ipcRenderer.invoke('animation:update', partialAnimation),

  onStatusChanged: (callback) => subscribe('status:changed', callback),
  onConfigUpdated: (callback) => subscribe('config:updated', callback),
  onLayoutUpdated: (callback) => subscribe('layout:updated', callback),
  onSlotStyleUpdated: (callback) => subscribe('slot-style:updated', callback),
  onAnimationUpdated: (callback) => subscribe('animation:updated', callback),
  onThemeChanged: (callback) => subscribe('theme:changed', callback),
});
