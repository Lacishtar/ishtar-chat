import { state, isFlythroughTheme } from './state.js';
import { applyCssVariables } from './css-variables.js';
import { refreshAllDecorations } from './decoration.js';
import { refreshAllSlotBunnyEars } from './bubble.js';
import { applyThemePayload } from './theme-loader.js';
import { enqueueMessage } from './message-queue.js';

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
    } else if (payload.type === 'theme:changed') {
      applyThemePayload(payload.data || {});
    } else if (payload.type === 'config:updated') {
      state.currentConfig = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      if (!isFlythroughTheme()) {
        refreshAllDecorations();
        refreshAllSlotBunnyEars();
      }
    } else if (payload.type === 'layout:updated') {
      state.currentLayout = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      if (!isFlythroughTheme()) refreshAllDecorations();
    } else if (payload.type === 'slot-style:updated') {
      state.currentSlotStyle = payload.data;
      applyCssVariables(state.currentConfig, state.currentLayout, state.currentSlotStyle, state.currentAnimation, state.currentRoleStyle);
      if (!isFlythroughTheme()) {
        refreshAllSlotBunnyEars();
        // Avatar size/border-radius live here — any avatar-targeted
        // decoration mask must be rebuilt against the new shape.
        refreshAllDecorations();
      }
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
      if (!isFlythroughTheme()) refreshAllSlotBunnyEars();
    }
  });

  ws.addEventListener('close', () => {
    // OBS keeps the Browser Source open for the whole stream, so a brief
    // server restart shouldn't require the user to re-add the source.
    setTimeout(connectSocket, 2000);
  });
}
