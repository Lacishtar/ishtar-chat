import { state, listEl, messageTemplateEl, syncThemeModeClass } from './state.js';
import { applyCssVariables } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { renderHistory } from './message-renderer.js';
import { hardResetStackPool } from './render-queue.js';
import { bubblePoolManager } from './pool/PoolManager.js';

// There is only ever one structural message skeleton now — appearance
// presets (shared/theme-presets/, split into index.js + themes/*.js) are pure CSS-variable config, not
// alternate DOM/markup. The template lives inline in overlay/index.html
// (#ovs-message-template), so "loading a theme" no longer means fetching
// per-theme template.html/style.css over HTTP — it's just reading the
// template node once.
export async function loadTheme(themeId) {
  const id = themeId || state.currentTheme || 'default';
  state.currentTheme = id;
  if (!messageTemplateEl) {
    console.error('[ovs] overlay markup missing #ovs-message-template');
    return false;
  }
  state.messageTemplate = messageTemplateEl;
  syncThemeModeClass();
  return true;
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
    // Preview-only sample history — static, no timers/sockets involved.
    // Covers every role x tier combination the Roles panel can style, so
    // toggling a setting (Moderator / Member tier / Super Chat tier / dual
    // role) always has a matching bubble visible in this list instead of
    // only the last entry (previously just one lone Super Chat message).
    incomingHistory = [
      {
        avatarUrl: 'mock-avatar:A Viewer',
        id: 'ovs-mock-1',
        author: 'A Viewer',
        messageHtml: 'Chào bạn 👋👋👋',
        roles: [],
        badges: []
      },
      {
        avatarUrl: 'mock-avatar:B Mod',
        id: 'ovs-mock-2',
        author: 'B Mod',
        messageHtml: 'Vui lòng không spam tin nhắn nha mọi người 😡',
        roles: ['moderator'],
        badges: []
      },
      {
        avatarUrl: 'mock-avatar:C Viewer',
        id: 'ovs-mock-3',
        author: 'C Viewer',
        messageHtml: 'Mình mới bấm tham gia hội viên nè! 🎉',
        roles: ['member'],
        badges: [],
        memberMonths: 1
      },
      {
        avatarUrl: 'mock-avatar:D Viewer',
        id: 'ovs-mock-4',
        author: 'D Viewer',
        messageHtml: 'Ủng hộ kênh được 8 tháng rồi đó nha',
        roles: ['member'],
        badges: [],
        memberMonths: 8
      },
      {
        avatarUrl: 'mock-avatar:E Viewer',
        id: 'ovs-mock-5',
        author: 'E Viewer',
        messageHtml: '2 năm theo dõi kênh không bỏ sót buổi nào luôn 💙',
        roles: ['member'],
        badges: [],
        memberMonths: 24
      },
      {
        avatarUrl: 'mock-avatar:F Mod',
        id: 'ovs-mock-6',
        author: 'F Mod',
        messageHtml: 'Vừa là mod vừa là hội viên, coi chừng bị xoá tin nhắn đó 😏',
        roles: ['moderator', 'member'],
        badges: [],
        memberMonths: 5
      },
      {
        avatarUrl: 'mock-avatar:G Viewer',
        id: 'ovs-mock-7',
        author: 'G Viewer',
        messageHtml: 'Ủng hộ nhẹ cho kênh nè!',
        roles: [],
        badges: [],
        isSuperchat: true,
        superchatCurrencyRaw: '70.000 ₫',
        superchatTier: 2,
        superchatColor: '#00e5ff',
        superchatBg: 'rgba(0, 229, 255, 0.35)',
        superchatBorder: 'rgba(0, 229, 255, 0.7)'
      },
      {
        avatarUrl: 'mock-avatar:H Viewer',
        id: 'ovs-mock-8',
        author: 'H Viewer',
        messageHtml: 'Chúc kênh phát triển thật mạnh nha! 🚀',
        roles: [],
        badges: [],
        isSuperchat: true,
        superchatCurrencyRaw: '350.000 ₫',
        superchatTier: 4,
        superchatColor: '#ffca28',
        superchatBg: 'rgba(255, 202, 40, 0.35)',
        superchatBorder: 'rgba(255, 202, 40, 0.7)'
      },
      {
        avatarUrl: 'mock-avatar:I Viewer',
        id: 'ovs-mock-9',
        author: 'I Viewer',
        messageHtml: 'Bạn này ngố phết kkkkk 😂',
        roles: ['member'],
        badges: [],
        memberMonths: 6,
        isSuperchat: true,
        superchatCurrencyRaw: '3.500.000 ₫',
        superchatTier: 7,
        superchatColor: '#e53935',
        superchatBg: 'rgba(229, 57, 53, 0.35)',
        superchatBorder: 'rgba(229, 57, 53, 0.7)'
      },
      // Membership announcements — YouTube's own 4 event types. These still
      // render with the ovs-event-<eventType> class (see message-renderer.js)
      // for other overlay purposes (e.g. animation state), but role-style-config.js
      // no longer has a memberEvents concept — these preview rows now render
      // with plain Member role styling (Appearance + Mốc tháng) like any
      // other member message, same as real membership announcements do.
      {
        avatarUrl: 'mock-avatar:J Viewer',
        id: 'ovs-mock-10',
        author: 'J Viewer',
        messageHtml: 'đã trở thành Hội viên kênh!',
        roles: ['member'],
        badges: [],
        memberMonths: 0,
        eventType: 'membership_new'
      },
      {
        avatarUrl: 'mock-avatar:K Viewer',
        id: 'ovs-mock-11',
        author: 'K Viewer',
        messageHtml: '',
        roles: ['member'],
        badges: [],
        memberMonths: 12,
        eventType: 'membership_milestone'
      },
      {
        avatarUrl: 'mock-avatar:L Viewer',
        id: 'ovs-mock-12',
        author: 'L Viewer',
        messageHtml: 'đã tặng 5 lượt Hội viên cho cộng đồng!',
        roles: ['member'],
        badges: [],
        memberMonths: 3,
        eventType: 'membership_gift_sent'
      },
      {
        avatarUrl: 'mock-avatar:M Viewer',
        id: 'ovs-mock-13',
        author: 'M Viewer',
        messageHtml: 'đã nhận được một lượt Hội viên được tặng!',
        roles: ['member'],
        badges: [],
        memberMonths: 0,
        eventType: 'membership_gift_received'
      }
    ];
  }

  const finish = () => {
    applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    const modeChanged = syncThemeModeClass();
    if (themeSwitch) {
      // Preset switches no longer swap the DOM template — only appearance
      // config changes — but the stack Pool still needs a hard reset so
      // history replay below picks up the new CSS variables cleanly.
      hardResetStackPool();
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
