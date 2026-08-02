import { state, listEl, messageTemplateEl, syncThemeModeClass } from './state.js';
import { applyCssVariables, applyFanServiceStyle } from './css-variables.js';
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
  if (data.fanServiceConfig) state.currentFanService = data.fanServiceConfig;

  const isPreview = new URLSearchParams(window.location.search).has('preview');
  let incomingHistory = Array.isArray(data.history) ? data.history : null;
  const hasRealHistory = incomingHistory !== null && incomingHistory.length > 0;
  const usingMockFallback = isPreview && !hasRealHistory;
  if (usingMockFallback) {
    // Preview-only sample history — static, no timers/sockets involved.
    // Trimmed to the minimum row count that still exercises every role x
    // tier x event-type combination the Roles panel can style: a plain
    // viewer (baseline, no role), a moderator, one member tier (also
    // covers the Mốc tháng badge), one Super Chat tier, and the 4 YouTube
    // membership event types. A dual-role (mod+member) row and extra
    // tier/amount examples used to sit here too, but they didn't add
    // preview coverage a single example of each role doesn't already give
    // — CSS-wise a mod+member row renders identically to a plain
    // moderator row (member styles are scoped `:not(.ovs-moderator)`, so
    // moderator always wins when both classes are present), and every
    // Super Chat/Member tier is just the same rule set with a different
    // color plugged in.
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
      // Membership announcements — YouTube's own 4 event types. These still
      // render with the ovs-event-<eventType> class (see message-renderer.js)
      // for other overlay purposes (e.g. animation state), on top of the
      // plain Member styling (Appearance + Mốc tháng) every other member
      // row uses.
      //
      // The four rows below were rebuilt from real captured markup
      // (membership-debug.log dumps of yt-live-chat-membership-item-renderer /
      // ytd-sponsorships-live-chat-gift-*-announcement-renderer) instead of
      // app-authored placeholder copy, since each event type's real field
      // layout doesn't match generic filler text:
      //   - membership_new: #message is always empty on a fresh join — the
      //     only real copy is YouTube's own welcome line, which lives in
      //     '#header-subtext' and surfaces here as membershipTierName (see
      //     message-body.js's package-name span), NOT messageHtml. The tier
      //     badge at this point usually just reads "Hội viên mới" (no month
      //     count yet), so memberMonths is 0.
      //   - membership_milestone: badges carries BOTH the exact milestone
      //     count from '#header-primary-text' (e.g. "Hội viên trong 12
      //     tháng" — first in the array, so deriveMemberMonths() reads it
      //     over the coarser badge) AND the viewer's persistent tier badge
      //     (e.g. "Hội viên (1 năm)"), which can legitimately show a smaller
      //     number since tier badges only bump at fixed milestones. A real
      //     optional thank-you note in #message is the common case, not the
      //     empty string the old fixture used. membershipTierName here is
      //     just the channel/team name — no "chào mừng" wording, that
      //     phrasing is unique to the new-member case above.
      //   - membership_gift_sent: messageHtml is YouTube's own auto-generated
      //     "Đã tặng N gói hội viên của kênh {channel}" line, read straight
      //     from the gift renderer's '#primary-text' — not app-authored
      //     text. badges is just the gifter's own persistent tier badge.
      //   - membership_gift_received: messageHtml is YouTube's own
      //     "đã nhận được một gói hội viên do @X tặng" line from '#message'.
      //     A freshly-redeemed recipient typically has no tier badge yet in
      //     the captured markup, so badges/memberMonths fall back to the
      //     same generic ['Member'] / 0 capture-preload.js stamps on any
      //     unbadged membership row.
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
