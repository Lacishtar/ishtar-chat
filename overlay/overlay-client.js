
import { state, listEl, messageTemplateEl, initialHistory } from './modules/state.js';
import { loadTheme, applyThemePayload } from './modules/theme-loader.js';
import { connectSocket } from './modules/socket.js';
import { bubblePoolManager } from './modules/pool/PoolManager.js';

if (!listEl || !messageTemplateEl) {
  console.error('[ovs] overlay markup missing #ovs-chat-list or #ovs-message-template');
} else {
  loadTheme(state.currentTheme).then((ok) => {
    if (!ok) return;
    bubblePoolManager.warmup();
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
        fanServiceConfig: state.currentFanService,
        history: initialHistory,
      },
      { forceHistory: true }
    );
    connectSocket();
  });
}
