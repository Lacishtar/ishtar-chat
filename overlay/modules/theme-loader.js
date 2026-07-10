import { state, listEl, themeStyleEl, syncThemeModeClass, isFlythroughTheme } from './state.js';
import { applyCssVariables } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { renderHistory } from './message-renderer.js';
import { resetTickerPlayback, resetDanmaku } from './special-modes.js';

export async function loadTheme(themeId) {
  const id = themeId || state.currentTheme || 'classic';
  try {
    const res = await fetch(`/themes/${encodeURIComponent(id)}/template.html`);
    if (!res.ok) throw new Error(`template HTTP ${res.status}`);
    const html = await res.text();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const tpl = wrapper.querySelector('template');
    if (!tpl) throw new Error('template element missing');
    state.currentTheme = id;
    themeStyleEl.href = `/themes/${encodeURIComponent(id)}/style.css`;
    syncThemeModeClass();
    state.messageTemplate = tpl;
    return true;
  } catch (err) {
    console.error('[ovs] loadTheme failed:', id, err);
    if (id !== 'classic') return loadTheme('classic');
    return Boolean(state.messageTemplate);
  }
}

export function applyThemePayload(data, options = {}) {
  const nextTheme = data.themeId || data.theme || state.currentTheme;
  const themeSwitch = Boolean(nextTheme && nextTheme !== state.currentTheme);
  if (data.config) state.currentConfig = data.config;
  if (data.layoutConfig) state.currentLayout = data.layoutConfig;
  if (data.slotStyleConfig) state.currentSlotStyle = data.slotStyleConfig;
  if (data.animationConfig) state.currentAnimation = data.animationConfig;
  if (data.decorationConfig) state.currentDecoration = data.decorationConfig;
  if (data.roleStyleConfig) state.currentRoleStyle = data.roleStyleConfig;

  const incomingHistory = Array.isArray(data.history) ? data.history : null;

  const finish = () => {
    applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    if (themeSwitch) {
      resetTickerPlayback();
      resetDanmaku();
      listEl.innerHTML = '';
    }
    if (incomingHistory && (themeSwitch || options.forceHistory || listEl.children.length === 0)) {
      state.messageHistory = [...incomingHistory];
      renderHistory(state.messageHistory);
    }
    if (!isFlythroughTheme()) {
      refreshAllDecorations();
    }
  };

  if (themeSwitch || !state.messageTemplate) {
    return loadTheme(nextTheme).then((ok) => {
      if (ok) finish();
    });
  }
  finish();
  return Promise.resolve();
}
