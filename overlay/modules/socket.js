import { state, syncThemeModeClass } from './state.js';
import { applyCssVariables, applyFanServiceStyle } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { refreshAllSlotBunnyEars } from './bubble.js';
import { refreshAllMemberTiers } from './bubble-updater.js';
import { applyThemePayload } from './theme-loader.js';
import { enqueueMessage, flushQueue } from './message-queue.js';
import { renderHistory, clearAllMessages, removeMessageById } from './message-renderer.js';
import { syncTickerPositionAttr } from './special-modes.js';

export function connectSocket() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/overlay/socket`);

  ws.addEventListener('message', (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      return;
    }

    if (payload.type === 'chat:new') {
      enqueueMessage(payload.data);
    } else if (payload.type === 'chat:cleared') {
      flushQueue();
      clearAllMessages();
    } else if (payload.type === 'chat:deleted') {
      removeMessageById(payload.data && payload.data.id);
    } else if (payload.type === 'theme:changed') {
      applyThemePayload(payload.data || {});
    } else if (payload.type === 'config:updated') {
      state.currentConfig = payload.data;
      const modeChanged = syncThemeModeClass();
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      // Ticker's top/bottom position is otherwise only synced lazily inside
      // its own rAF loop (stepTicker), which only runs while a message is
      // actively scrolling/queued. If the ticker is idle (no active message)
      // when "Vị trí thanh Ticker" changes, that loop isn't running, so the
      // bar silently stayed at the old edge until the next chat message
      // happened to arrive. Sync it here too so the change is instant.
      syncTickerPositionAttr();
      refreshAllDecorations();
      refreshAllSlotBunnyEars();
      if (modeChanged) renderHistory(state.messageHistory);
    } else if (payload.type === 'layout:updated') {
      state.currentLayout = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      refreshAllDecorations();
    } else if (payload.type === 'slot-style:updated') {
      state.currentSlotStyle = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      refreshAllSlotBunnyEars();
      // Avatar size/border-radius live here — any avatar-targeted
      // decoration mask must be rebuilt against the new shape.
      refreshAllDecorations();
    } else if (payload.type === 'animation:updated') {
      state.currentAnimation = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
    } else if (payload.type === 'decoration:updated') {
      state.currentDecoration = payload.data || { layers: [] };
      refreshAllDecorations();
    } else if (payload.type === 'role-style:updated') {
      state.currentRoleStyle = payload.data || { roles: {} };
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      // Refresh ear colors vì màu phụ thuộc vào role config
      refreshAllSlotBunnyEars();
      // Re-resolve Mốc tháng (member tier) for every row already on screen —
      refreshAllMemberTiers();
    } else if (payload.type === 'fan-service:updated') {
      state.currentFanService = payload.data || { superchat: {}, membership: {} };
      applyFanServiceStyle(state.currentFanService);
      // Bunny ears có thể bị group Fan Service ghi đè bật/tắt riêng — cần
      // refresh ngay để những row đang hiển thị phản ánh đúng thay đổi.
      refreshAllSlotBunnyEars();
    }
  });

  ws.addEventListener('close', () => {
    // OBS keeps the Browser Source open for the whole stream, so a brief
    // server restart shouldn't require the user to re-add the source.
    setTimeout(connectSocket, 2000);
  });
}
