import { state, listEl, messageTemplateEl, syncThemeModeClass } from './state.js';
import { applyCssVariables, applyFanServiceStyle } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { renderHistory } from './message-renderer.js';
import { hardResetStackPool } from './render-queue.js';
import { bubblePoolManager } from './pool/PoolManager.js';
import { syncTickerPositionAttr } from './special-modes.js';

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
  if (data.fanServiceConfig) state.currentFanService = data.fanServiceConfig;

  const isPreview = new URLSearchParams(window.location.search).has('preview');
  let incomingHistory = Array.isArray(data.history) ? data.history : null;
  const hasRealHistory = incomingHistory !== null && incomingHistory.length > 0;
  const usingMockFallback = isPreview && !hasRealHistory;
  if (usingMockFallback) {
    // covers the Mốc tháng badge), one Super Chat tier, and the 4 YouTube
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
        messageHtml: '2 năm theo dõi kênh không bỏ sót buổi nào luôn 💙',
        roles: ['member'],
        badges: [],
        memberMonths: 24
      },
      {
        avatarUrl: 'mock-avatar:D Viewer',
        id: 'ovs-mock-4',
        author: 'D Viewer',
        messageHtml: 'Chúc kênh phát triển thật mạnh nha! 🚀',
        roles: [],
        badges: [],
        isSuperchat: true,
        superchatCurrencyRaw: '350.000 ₫',
        superchatTier: 4,
        superchatColor: '#ffca28',
        superchatBg: 'rgba(255, 202, 40, 0.9)',
        superchatBorder: 'rgba(255, 202, 40, 0.7)'
      },
      // plain Member styling (Appearance + Mốc tháng) every other member
      //     badge at this point usually just reads "Hội viên mới" (no month
      //     count from '#header-primary-text' (e.g. "Hội viên trong 12
      //     tháng" — first in the array, so deriveMemberMonths() reads it
      //     (e.g. "Hội viên (1 năm)"), which can legitimately show a smaller
      //     optional thank-you note in #message is the common case, not the
      //     just the channel/team name — no "chào mừng" wording, that
      //     "Đã tặng N gói hội viên của kênh {channel}" line, read straight
      //     "đã nhận được một gói hội viên do @X tặng" line from '#message'.
      {
        avatarUrl: 'mock-avatar:E Viewer',
        id: 'ovs-mock-5',
        author: 'E Viewer',
        messageHtml: '',
        roles: ['member'],
        badges: ['Hội viên mới'],
        membershipTierName: 'Chào mừng bạn đến với Team Ví Dụ!',
        memberMonths: 0,
        eventType: 'membership_new'
      },
      {
        avatarUrl: 'mock-avatar:F Viewer',
        id: 'ovs-mock-6',
        author: 'F Viewer',
        messageHtml: 'thank you nha, chúc kênh sớm debut thành công nữa!',
        roles: ['member'],
        badges: ['Hội viên trong 12 tháng', 'Hội viên (1 năm)'],
        membershipTierName: 'Team Ví Dụ',
        memberMonths: 12,
        eventType: 'membership_milestone'
      },
      {
        avatarUrl: 'mock-avatar:G Viewer',
        id: 'ovs-mock-7',
        author: 'G Viewer',
        messageHtml: 'Đã tặng 10 gói hội viên của kênh Team Ví Dụ',
        roles: ['member'],
        badges: ['Hội viên (1 năm)'],
        memberMonths: 12,
        eventType: 'membership_gift_sent'
      },
      {
        avatarUrl: 'mock-avatar:H Viewer',
        id: 'ovs-mock-8',
        author: 'H Viewer',
        messageHtml: 'đã nhận được một gói hội viên do <b>G Viewer</b> tặng',
        roles: ['member'],
        badges: ['Member'],
        memberMonths: 0,
        eventType: 'membership_gift_received'
      }
    ];
  }

  const finish = () => {
    applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    applyFanServiceStyle(state.currentFanService);
    // Same reasoning as socket.js's config:updated handler: ticker's
    // top/bottom position is otherwise only synced lazily inside its own
    // rAF loop, which doesn't run yet on first page load / theme switch
    // (before any ticker message has arrived) — sync it explicitly here so
    // the very first paint already respects the configured position.
    syncTickerPositionAttr();
    const modeChanged = syncThemeModeClass();
    if (themeSwitch) {
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
