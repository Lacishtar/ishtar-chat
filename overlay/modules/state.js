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

// 'stack' is the normal chat feed (bubbles stack up/down per
// currentConfig.position). 'danmaku' flies each message across the screen
// once instead — see overlay/modules/special-modes.js.
let currentDisplayMode = 'stack';

export function getDisplayMode() {
  return state.currentConfig?.displayMode === 'danmaku' ? 'danmaku' : 'stack';
}

// Reflects the active display mode onto #ovs-chat-list via a dataset
// attribute — decoration-layers.css keys off `[data-ovs-theme-mode='stack']`,
// and overlay/danmaku.css keys off `[data-ovs-theme-mode='danmaku']` — and
// wipes the list whenever the mode actually changes so the two rendering
// paths (flex stack vs absolutely-positioned flying bullets) never mix
// leftover DOM nodes. Returns true when the mode changed, so callers know
// whether the message history needs replaying into the new mode.
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
