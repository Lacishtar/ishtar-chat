
const initial = window.__OVS_INITIAL_STATE__ || {};

export const state = {
  currentTheme: initial.theme || initial.themeId || 'default',
  currentConfig: initial.config || {},
  currentLayout: initial.layoutConfig || {},
  currentSlotStyle: initial.slotStyleConfig || {},
  currentAnimation: initial.animationConfig || {},
  currentDecoration: initial.decorationConfig || { layers: [] },
  currentRoleStyle: initial.roleStyleConfig || { roles: {} },
  currentFanService: initial.fanServiceConfig || { superchat: {}, membership: {} },
  messageTemplate: null,
  messageHistory: Array.isArray(initial.history) ? [...initial.history] : [],
  isMockHistory: false,
};

// Kept around only so the entry file can seed the very first
// applyThemePayload() call with the initial history from the server.
export const initialHistory = initial.history;

export const listEl = document.getElementById('ovs-chat-list');
export const messageTemplateEl = document.getElementById('ovs-message-template');

let currentDisplayMode = 'stack';

export function getDisplayMode() {
  const mode = state.currentConfig?.displayMode;
  if (mode === 'danmaku') return 'danmaku';
  if (mode === 'ticker') return 'ticker';
  if (mode === 'horizontal-bar') return 'horizontal-bar';
  return 'stack';
}

export function syncThemeModeClass() {
  if (!listEl) return false;
  const mode = getDisplayMode();
  const changed = mode !== currentDisplayMode;
  if (changed) {
    currentDisplayMode = mode;
    listEl.innerHTML = '';
  }
  listEl.dataset.ovsThemeMode = mode;
  return changed;
}
