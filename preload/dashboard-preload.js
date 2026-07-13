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
  isThemeDirty: () => ipcRenderer.invoke('theme:is-dirty'),
  resetPreset: () => ipcRenderer.invoke('theme:reset-preset'),
  getThemeList: () => ipcRenderer.invoke('theme:list'),
  applyTheme: (themeId) => ipcRenderer.invoke('theme:apply', themeId),
  resetCategory: (category) => ipcRenderer.invoke('theme:reset-category', category),
  updateConfig: (partialConfig) => ipcRenderer.invoke('config:update', partialConfig),
  updateLayout: (partialLayout) => ipcRenderer.invoke('layout:update', partialLayout),
  updateSlotStyle: (partialSlotStyle) => ipcRenderer.invoke('slot-style:update', partialSlotStyle),
  updateAnimation: (partialAnimation) => ipcRenderer.invoke('animation:update', partialAnimation),
  updateDecorationConfig: (partialDecoration) => ipcRenderer.invoke('decoration:update', partialDecoration),
  updateRoleStyleConfig: (partialRoleStyle) => ipcRenderer.invoke('role-style:update', partialRoleStyle),

  // Custom presets
  listCustomPresets: () => ipcRenderer.invoke('custom-preset:list'),
  saveCustomPreset: (name, snapshot) => ipcRenderer.invoke('custom-preset:save', { name, snapshot }),
  deleteCustomPreset: (id) => ipcRenderer.invoke('custom-preset:delete', id),
  renameCustomPreset: (id, newName) => ipcRenderer.invoke('custom-preset:rename', { id, newName }),
  applyCustomPreset: (id) => ipcRenderer.invoke('custom-preset:apply', id),
  exportCustomPresets: () => ipcRenderer.invoke('custom-preset:export'),
  importCustomPresets: () => ipcRenderer.invoke('custom-preset:import'),

  onStatusChanged: (callback) => subscribe('status:changed', callback),
  onConfigUpdated: (callback) => subscribe('config:updated', callback),
  onLayoutUpdated: (callback) => subscribe('layout:updated', callback),
  onSlotStyleUpdated: (callback) => subscribe('slot-style:updated', callback),
  onAnimationUpdated: (callback) => subscribe('animation:updated', callback),
  onDecorationUpdated: (callback) => subscribe('decoration:updated', callback),
  onRoleStyleUpdated: (callback) => subscribe('role-style:updated', callback),
  onThemeChanged: (callback) => subscribe('theme:changed', callback),
});
