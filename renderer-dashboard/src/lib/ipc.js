// In production this always talks to the real window.api exposed by
// preload/dashboard-preload.js. The mock below only activates when the app
// is opened in a plain browser tab (e.g. `npm run dev:dashboard` without
// Electron), so the UI can be iterated on quickly without spinning up the
// whole scraper/server stack.
const hasElectronApi = typeof window !== 'undefined' && !!window.api;

// Mirrors shared/animation-config.js#ANIMATION_STYLE_PRESETS + expandAnimationStyle —
// kept small/duplicated here since the mock runs in a plain browser tab and
// doesn't bundle the CJS shared/ modules used by the real Electron backend.
const MOCK_BASE_TARGET_DIRECTIONS = {
  avatar: { delayMs: 0, translateX: 0, translateY: 8 },
  author: { delayMs: 40, translateX: -6, translateY: 0 },
  badges: { delayMs: 60, translateX: -4, translateY: 0 },
  message: { delayMs: 80, translateX: 0, translateY: 6 },
};
const MOCK_ANIMATION_STYLE_PRESETS = {
  slide: { easing: 'ease-out', translateScale: 1, scale: 1, blur: 0 },
  bounce: { easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', translateScale: 2, scale: 0.85, blur: 0 },
  zoom: { easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)', translateScale: 0, scale: 0.4, blur: 0 },
  slideStrong: { easing: 'cubic-bezier(0.16, 1, 0.3, 1)', translateScale: 6, scale: 1, blur: 0 },
  blurZoom: { easing: 'ease-out', translateScale: 0, scale: 1.08, blur: 10 },
};
function mockExpandAnimationStyle(style) {
  const preset = MOCK_ANIMATION_STYLE_PRESETS[style] || MOCK_ANIMATION_STYLE_PRESETS.slide;
  const targets = {};
  Object.entries(MOCK_BASE_TARGET_DIRECTIONS).forEach(([slot, dir]) => {
    targets[slot] = {
      durationMs: null,
      delayMs: dir.delayMs,
      easing: preset.easing,
      translateX: dir.translateX * preset.translateScale,
      translateY: dir.translateY * preset.translateScale,
      scale: preset.scale,
      blur: preset.blur,
    };
  });
  return targets;
}

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
    style: 'slide',
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
  const animationListeners = new Set();
  const decorationListeners = new Set();
  const roleStyleListeners = new Set();
  const themeChangedListeners = new Set();

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
    getThemeList: async () => [
      { id: 'default',       name: 'Default',       description: 'Standard dark-panel look.', preview: { bubbleBg: 'rgba(22, 25, 31, 0.72)', authorColor: '#6E56F0', textColor: '#EAECEF' } },
      { id: 'minimal-white', name: 'Minimal White',  description: 'Clean white, no bubble.', preview: { bubbleBg: 'rgba(255, 255, 255, 0.9)', authorColor: '#111827', textColor: '#374151' } },
      { id: 'minimal-dark',  name: 'Minimal Dark',   description: 'Transparent bubble, dark text.', preview: { bubbleBg: 'rgba(0, 0, 0, 0.35)', authorColor: '#F9FAFB', textColor: '#D1D5DB' } },
      { id: 'discord',       name: 'Discord',        description: 'Discord dark with Blurple accents.', preview: { bubbleBg: 'rgba(49, 51, 56, 0.9)', authorColor: '#5865F2', textColor: '#DBDEE1' } },
      { id: 'cyber-neon',    name: 'Cyber Neon',     description: 'Electric-cyan cyberpunk.', preview: { bubbleBg: 'rgba(6, 10, 20, 0.85)', authorColor: '#00F0FF', textColor: '#B9FBFF' } },
      { id: 'pastel-pink',   name: 'Pastel Pink',    description: 'Soft pink bubbles.', preview: { bubbleBg: 'rgba(255, 228, 240, 0.9)', authorColor: '#E85D9E', textColor: '#6B3A52' } },
      { id: 'glassmorphism', name: 'Glassmorphism',  description: 'Frosted-glass panel.', preview: { bubbleBg: 'rgba(255, 255, 255, 0.14)', authorColor: '#7DD3FC', textColor: '#F1F5F9' } },
      { id: 'cute-bubble',   name: 'Cute Bubble',    description: 'Round colourful bubbles.', preview: { bubbleBg: 'rgba(255, 214, 165, 0.9)', authorColor: '#F97316', textColor: '#7C2D12' } },
      { id: 'kawaii', name: 'Kawaii', description: 'Sakura-pink kawaii style.', preview: { bubbleBg: 'rgba(255, 240, 245, 0.92)', authorColor: '#FB7185', textColor: '#9D174D' } },
      { id: 'vtuber-cute',   name: 'VTuber Cute',    description: 'Idol-style with bunny ears.', preview: { bubbleBg: 'rgba(255, 245, 250, 0.9)', authorColor: '#C026D3', textColor: '#701A75' } },
      { id: 'blue-archive',  name: 'Blue Archive',   description: 'Navy-and-sky Blue Archive.', preview: { bubbleBg: 'rgba(15, 23, 42, 0.85)', authorColor: '#38BDF8', textColor: '#E0F2FE' } },
      { id: 'hololive-blue', name: 'Hololive Blue',  description: 'Sky-blue Hololive style.', preview: { bubbleBg: 'rgba(224, 242, 254, 0.9)', authorColor: '#0284C7', textColor: '#0C4A6E' } },
      { id: 'night-sky',     name: 'Night Sky',      description: 'Deep navy with aurora glow.', preview: { bubbleBg: 'rgba(8, 12, 28, 0.85)', authorColor: '#A78BFA', textColor: '#E0E7FF' } },
    ],
    applyTheme: async (themeId) => {
      // In the mock we just echo the current config back — real apply
      // happens in the Electron main process via ThemeManager.ApplyTheme.
      const payload = { themeId: 'classic', config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig };
      themeChangedListeners.forEach((cb) => cb(payload));
      return { ok: true, customizeConfig: config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig };
    },
    resetCategory: async (category) => {
      // Mock: no-op — category reset only applies in the real Electron process.
      return { ok: true, category };
    },
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
      const stylePicked = partial.style && partial.style !== animationConfig.style && !partial.targets;
      const effectivePartial = stylePicked
        ? { ...partial, targets: mockExpandAnimationStyle(partial.style) }
        : partial;
      animationConfig = {
        ...animationConfig,
        ...effectivePartial,
        targets: {
          ...animationConfig.targets,
          ...(effectivePartial.targets
            ? Object.fromEntries(
                Object.entries(effectivePartial.targets).map(([k, v]) => [
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
    onThemeChanged: (cb) => {
      themeChangedListeners.add(cb);
      return () => themeChangedListeners.delete(cb);
    },
  };
}

const api = hasElectronApi ? window.api : createMock();

export default api;

