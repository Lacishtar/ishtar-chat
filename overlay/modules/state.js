// Shared mutable state + DOM refs + theme-mode helpers.
//
// `state` is a single mutable object (not several exported `let`s) because
// ES module bindings are read-only from importing modules — other modules
// need to *write* currentTheme/currentConfig/etc (socket updates, theme
// switches, history tracking), so a shared object with mutable properties
// is the pattern that actually allows that.

const initial = window.__OVS_INITIAL_STATE__ || {};

export const state = {
  currentTheme: initial.theme || initial.themeId || 'classic',
  currentConfig: initial.config || {},
  currentLayout: initial.layoutConfig || {},
  currentSlotStyle: initial.slotStyleConfig || {},
  currentAnimation: initial.animationConfig || {},
  currentDecoration: initial.decorationConfig || { layers: [] },
  currentRoleStyle: initial.roleStyleConfig || { roles: {} },
  messageTemplate: null,
  messageHistory: Array.isArray(initial.history) ? [...initial.history] : [],
};

// Kept around only so the entry file can seed the very first
// applyThemePayload() call with the initial history from the server.
export const initialHistory = initial.history;

export const listEl = document.getElementById('ovs-chat-list');
export const themeStyleEl = document.getElementById('ovs-theme-style');

export const TICKER_THEMES = new Set(['ticker']);
export const DANMAKU_THEMES = new Set(['danmaku']);

export function syncThemeModeClass() {
  if (!listEl) return;
  listEl.classList.toggle('ovs-theme-danmaku', DANMAKU_THEMES.has(state.currentTheme));
  listEl.classList.toggle('ovs-theme-ticker', TICKER_THEMES.has(state.currentTheme));
  if (DANMAKU_THEMES.has(state.currentTheme)) {
    listEl.dataset.ovsThemeMode = 'danmaku';
  } else if (TICKER_THEMES.has(state.currentTheme)) {
    listEl.dataset.ovsThemeMode = 'ticker';
  } else {
    listEl.dataset.ovsThemeMode = 'stack';
  }
}

export function isFlythroughTheme() {
  return DANMAKU_THEMES.has(state.currentTheme) || TICKER_THEMES.has(state.currentTheme);
}
