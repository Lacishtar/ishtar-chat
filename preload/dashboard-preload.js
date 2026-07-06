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
  updateConfig: (partialConfig) => ipcRenderer.invoke('config:update', partialConfig),
  updateLayout: (partialLayout) => ipcRenderer.invoke('layout:update', partialLayout),

  onStatusChanged: (callback) => subscribe('status:changed', callback),
  onConfigUpdated: (callback) => subscribe('config:updated', callback),
  onLayoutUpdated: (callback) => subscribe('layout:updated', callback),
  onThemeChanged: (callback) => subscribe('theme:changed', callback),
});
