import { state, listEl, themeStyleEl, syncThemeModeClass } from './state.js';
import { applyCssVariables } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { renderHistory } from './message-renderer.js';
import { hardResetStackPool } from './render-queue.js';
import { bubblePoolManager } from './pool/PoolManager.js';

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

  const isPreview = new URLSearchParams(window.location.search).has('preview');
  let incomingHistory = Array.isArray(data.history) ? data.history : null;
  const hasRealHistory = incomingHistory !== null && incomingHistory.length > 0;
  const usingMockFallback = isPreview && !hasRealHistory;
  if (usingMockFallback) {
    incomingHistory = [
      {
        avatarUrl: 'mock-avatar:A Viewer',
        author: 'A Viewer',
        messageHtml: 'Chào bạn 👋👋👋',
        roles: [],
        badges: []
      },
      {
        avatarUrl: 'mock-avatar:B Viewer',
        author: 'B Viewer',
        messageHtml: 'Vui lòng ko spam tn nha mn 😡😡😡',
        roles: ['moderator' , 'member'],
        badges: []
      },
      {
        avatarUrl: 'mock-avatar:C Viewer',
        author: 'C Viewer',
        messageHtml: 'bạn này ngố phết kkkkk',
        roles: ['member'],
        badges: [],
        memberMonths: 12
      },
      {
        avatarUrl: 'mock-avatar:D Viewer',
        author: 'D Viewer',
        messageHtml: 'Vtuber này thuần sinh tố bịch :vv',
        roles: ['member'],
        badges: [],
        isSuperchat: true,
        superchatCurrencyRaw: '500.000 ₫',
        memberMonths: 6
      }
    ];
  }

  const finish = () => {
    applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    const modeChanged = syncThemeModeClass();
    if (themeSwitch) {
      // Every node the stack-mode Pool is currently holding (visible or
      // IDLE) was cloned from the PREVIOUS theme's template — a plain
      // listEl.innerHTML = '' would drop the visible ones but leave any
      // IDLE-pooled nodes sitting around to be handed out, stale, by a
      // future acquire(). hardResetStackPool() clears both.
      hardResetStackPool();
      // The pool is now completely empty (see above) and the new
      // template is already in place (state.messageTemplate was set by
      // the loadTheme() call that led here) — re-warm immediately so the
      // first messages rendered under the new theme (the history replay
      // just below, or the next live one) still get a pre-built node
      // instead of the pool building one on demand right after a switch.
      bubblePoolManager.warmup();
    }
    if (incomingHistory && (themeSwitch || modeChanged || options.forceHistory || listEl.children.length === 0)) {
      state.messageHistory = [...incomingHistory];
      state.isMockHistory = usingMockFallback;
      renderHistory(state.messageHistory);
    }
    refreshAllDecorations();
  };

  if (themeSwitch || !state.messageTemplate) {
    return loadTheme(nextTheme).then((ok) => {
      if (ok) finish();
    });
  }
  finish();
  return Promise.resolve();
}
