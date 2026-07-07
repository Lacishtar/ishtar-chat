// In production this always talks to the real window.api exposed by
// preload/dashboard-preload.js. The mock below only activates when the app
// is opened in a plain browser tab (e.g. `npm run dev:dashboard` without
// Electron), so the UI can be iterated on quickly without spinning up the
// whole scraper/server stack.
const hasElectronApi = typeof window !== 'undefined' && !!window.api;

function createMock() {
  console.warn('[ipc] window.api not found — using mock data (running outside Electron).');

  let config = {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 16,
    textColor: '#EAECEF',
    authorColor: '#6E56F0',
    bubbleBg: 'rgba(22, 25, 31, 0.72)',
    bubbleRadius: 14,
    bubbleOpacity: 1,
    avatarSize: 32,
    showAvatar: true,
    showBadges: true,
    animationMs: 220,
    position: 'bottom-up',
    maxMessages: 40,
  };
  let layoutConfig = {
    messageRow: { direction: 'horizontal', gap: 10, align: 'start', padding: 8, margin: 0 },
    metaRow: { direction: 'horizontal', gap: 6, align: 'center', padding: 0, margin: 2 },
    bodyColumn: { direction: 'vertical', gap: 2, align: 'stretch', padding: 0, margin: 0 },
    slots: {
      avatar: { order: 0, padding: 0, margin: 0 },
      author: { order: 0, padding: 0, margin: 0 },
      badges: { order: 1, padding: 0, margin: 0 },
      message: { order: 1, padding: 0, margin: 0 },
    },
  };
  let slotStyleConfig = { slots: {} };
  let decorationConfig = { layers: [] };
  let roleStyleConfig = {
    roles: {
      moderator: { enabled: true, authorColor: '#fca5a5', badge: 'MOD' },
      member: { enabled: true, authorColor: '#93c5fd', badge: '★' },
      superchat: { enabled: true, authorColor: '#fde047', badge: '✦', showAmount: true },
    },
  };
  let animationConfig = {
    enabled: true,
    targets: {
      avatar: { durationMs: 220, delayMs: 0, translateY: 8 },
      author: { durationMs: 220, delayMs: 40, translateX: -6 },
      badges: { durationMs: 220, delayMs: 60, translateX: -4 },
      message: { durationMs: 220, delayMs: 80, translateY: 6 },
    },
  };
  let status = { status: 'idle', error: null, videoId: null };
  const statusListeners = new Set();
  const configListeners = new Set();
  const layoutListeners = new Set();
  const slotStyleListeners = new Set();
  const decorationListeners = new Set();
  const roleStyleListeners = new Set();

  return {
    getInitialState: async () => ({
      status,
      themes: [
        {
          id: 'classic',
          name: 'Classic',
          hasThumbnail: false,
          preview: { bubbleBg: 'rgba(22, 25, 31, 0.72)', authorColor: '#6E56F0', textColor: '#EAECEF' },
        },
      ],
      selectedTheme: 'classic',
      customizeConfig: config,
      layoutConfig,
      slotStyleConfig,
      decorationConfig,
      roleStyleConfig,
      animationConfig,
      lastSessionUrl: '',
      overlayUrl: 'http://localhost:3000/overlay?session=mock',
      port: 3000,
    }),
    connect: async (url) => {
      status = { status: 'connecting', error: null, videoId: null };
      statusListeners.forEach((cb) => cb(status));
      setTimeout(() => {
        status = { status: 'connected', error: null, videoId: 'mock' };
        statusListeners.forEach((cb) => cb(status));
      }, 800);
      return { ok: true };
    },
    disconnect: async () => {
      status = { status: 'idle', error: null, videoId: null };
      statusListeners.forEach((cb) => cb(status));
      return { ok: true };
    },
    selectTheme: async (themeId) => ({
      ok: true,
      config,
      layoutConfig,
      slotStyleConfig,
      decorationConfig,
      roleStyleConfig,
      animationConfig,
    }),
    isThemeDirty: async () => ({ dirty: false, dirtyFields: [] }),
    resetPreset: async () => ({
      ok: true,
      config,
      layoutConfig,
      slotStyleConfig,
      decorationConfig,
      roleStyleConfig,
      animationConfig,
    }),
    updateConfig: async (partial) => {
      config = { ...config, ...partial };
      configListeners.forEach((cb) => cb(config));
      return { ok: true, config };
    },
    updateLayout: async (partial) => {
      layoutConfig = {
        ...layoutConfig,
        ...partial,
        messageRow: { ...layoutConfig.messageRow, ...(partial.messageRow || {}) },
        metaRow: { ...layoutConfig.metaRow, ...(partial.metaRow || {}) },
        bodyColumn: { ...layoutConfig.bodyColumn, ...(partial.bodyColumn || {}) },
        screen: { ...layoutConfig.screen, ...(partial.screen || {}) },
        slots: {
          ...layoutConfig.slots,
          ...(partial.slots
            ? Object.fromEntries(
                Object.entries(partial.slots).map(([k, v]) => [k, { ...layoutConfig.slots[k], ...v }])
              )
            : {}),
        },
      };
      layoutListeners.forEach((cb) => cb(layoutConfig));
      return { ok: true, layoutConfig };
    },
    updateSlotStyle: async (partial) => {
      slotStyleConfig = {
        slots: {
          ...slotStyleConfig.slots,
          ...(partial.slots
            ? Object.fromEntries(
                Object.entries(partial.slots).map(([k, v]) => [
                  k,
                  { ...(slotStyleConfig.slots?.[k] || {}), ...v },
                ])
              )
            : {}),
        },
      };
      slotStyleListeners.forEach((cb) => cb(slotStyleConfig));
      return { ok: true, slotStyleConfig };
    },
    updateAnimation: async (partial) => {
      animationConfig = {
        ...animationConfig,
        ...partial,
        targets: {
          ...animationConfig.targets,
          ...(partial.targets
            ? Object.fromEntries(
                Object.entries(partial.targets).map(([k, v]) => [
                  k,
                  { ...(animationConfig.targets?.[k] || {}), ...v },
                ])
              )
            : {}),
        },
      };
      animationListeners.forEach((cb) => cb(animationConfig));
      return { ok: true, animationConfig };
    },
    updateDecorationConfig: async (partial) => {
      if (Array.isArray(partial.layers)) {
        decorationConfig = { layers: partial.layers };
      }
      decorationListeners.forEach((cb) => cb(decorationConfig));
      return { ok: true, decorationConfig };
    },
    updateRoleStyleConfig: async (partial) => {
      const roles = { ...(roleStyleConfig.roles || {}) };
      if (partial.roles) {
        Object.entries(partial.roles).forEach(([key, value]) => {
          roles[key] = { ...(roles[key] || {}), ...value };
        });
      }
      roleStyleConfig = { roles };
      roleStyleListeners.forEach((cb) => cb(roleStyleConfig));
      return { ok: true, roleStyleConfig };
    },
    onStatusChanged: (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    onConfigUpdated: (cb) => {
      configListeners.add(cb);
      return () => configListeners.delete(cb);
    },
    onLayoutUpdated: (cb) => {
      layoutListeners.add(cb);
      return () => layoutListeners.delete(cb);
    },
    onSlotStyleUpdated: (cb) => {
      slotStyleListeners.add(cb);
      return () => slotStyleListeners.delete(cb);
    },
    onAnimationUpdated: (cb) => {
      animationListeners.add(cb);
      return () => animationListeners.delete(cb);
    },
    onDecorationUpdated: (cb) => {
      decorationListeners.add(cb);
      return () => decorationListeners.delete(cb);
    },
    onRoleStyleUpdated: (cb) => {
      roleStyleListeners.add(cb);
      return () => roleStyleListeners.delete(cb);
    },
    onThemeChanged: () => () => {},
  };
}

const api = hasElectronApi ? window.api : createMock();

export default api;
