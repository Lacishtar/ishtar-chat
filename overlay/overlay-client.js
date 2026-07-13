// Overlay entry point. Boots the overlay: checks required markup exists,
// loads the initial theme + history, and opens the live WebSocket.
//
// All actual logic lives in ./modules/*.js — this file only orchestrates
// the startup sequence, same shape as before but split by concern.

import { state, listEl, themeStyleEl, initialHistory } from './modules/state.js';
import { loadTheme, applyThemePayload } from './modules/theme-loader.js';
import { connectSocket } from './modules/socket.js';

if (!listEl || !themeStyleEl) {
  console.error('[ovs] overlay markup missing #ovs-chat-list or #ovs-theme-style');
} else {
  loadTheme(state.currentTheme).then((ok) => {
    if (!ok) return;
    applyThemePayload(
      {
        themeId: state.currentTheme,
        config: state.currentConfig,
        layoutConfig: state.currentLayout,
        slotStyleConfig: state.currentSlotStyle,
        animationConfig: state.currentAnimation,
        decorationConfig: state.currentDecoration,
        roleStyleConfig: state.currentRoleStyle,
        history: initialHistory,
      },
      { forceHistory: true }
    );
    connectSocket();
  });
}
