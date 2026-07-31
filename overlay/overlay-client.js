// Overlay entry point. Boots the overlay: checks required markup exists,
// loads the initial theme + history, and opens the live WebSocket.
//
// All actual logic lives in ./modules/*.js — this file only orchestrates
// the startup sequence, same shape as before but split by concern.

import { state, listEl, messageTemplateEl, initialHistory } from './modules/state.js';
import { loadTheme, applyThemePayload } from './modules/theme-loader.js';
import { connectSocket } from './modules/socket.js';
import { bubblePoolManager } from './modules/pool/PoolManager.js';

if (!listEl || !messageTemplateEl) {
  console.error('[ovs] overlay markup missing #ovs-chat-list or #ovs-message-template');
} else {
  loadTheme(state.currentTheme).then((ok) => {
    if (!ok) return;
    // Pool Warmup — pre-build the configured number of Bubble nodes
    // (state.currentConfig.poolWarmupSize) into the Pool BEFORE anything
    // renders, so even the very first message (history replay below, or
    // the first live one after connectSocket()) reuses an already-built
    // node instead of the Pool building one on demand. Must run after
    // loadTheme() resolves: building a node needs state.messageTemplate,
    // which is exactly what loadTheme() just set.
    bubblePoolManager.warmup();
    // Dynamic Pool — start background reclamation of long-idle surplus
    // nodes (expand() itself runs on demand from inside acquire(), no
    // separate wiring needed for growth). Safe to call once at startup;
    // startDynamicManagement() is idempotent.
    bubblePoolManager.startDynamicManagement();
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
