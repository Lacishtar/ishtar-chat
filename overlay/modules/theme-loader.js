import { state, listEl, themeStyleEl, syncThemeModeClass } from './state.js';
import { applyCssVariables } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { renderHistory } from './message-renderer.js';

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
  if (isPreview && (!incomingHistory || incomingHistory.length === 0)) {
    incomingHistory = [
      {
        avatarUrl: 'mock-avatar:Thanh Bình',
        author: 'Thanh Bình',
        messageHtml: 'Hello anh em! Nhìn giao diện xịn xò quá 👍',
        roles: [],
        badges: []
      },
      {
        avatarUrl: 'mock-avatar:Hoàng Nam',
        author: 'Hoàng Nam',
        messageHtml: 'Mọi người nhớ like và đăng ký kênh ủng hộ streamer nhé! 🔔',
        roles: ['moderator'],
        badges: ['MOD']
      },
      {
        avatarUrl: 'mock-avatar:Minh Thư',
        author: 'Minh Thư',
        messageHtml: 'Kênh live stream đều đặn quá, thiết kế overlay này rất đẹp 💖',
        roles: ['member'],
        badges: ['★'],
        memberMonths: 12
      },
      {
        avatarUrl: 'mock-avatar:Khánh Linh',
        author: 'Khánh Linh',
        messageHtml: 'Chúc kênh ngày càng phát triển hơn nữa nha!',
        roles: ['member'],
        badges: ['★'],
        isSuperchat: true,
        superchatCurrencyRaw: '50.000 ₫',
        memberMonths: 6
      }
    ];
  }

  const finish = () => {
    applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    if (themeSwitch) {
      listEl.innerHTML = '';
    }
    if (incomingHistory && (themeSwitch || options.forceHistory || listEl.children.length === 0)) {
      state.messageHistory = [...incomingHistory];
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
