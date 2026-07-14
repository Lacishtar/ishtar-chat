// In production this always talks to the real window.api exposed by
// preload/dashboard-preload.js. The mock below only activates when the app
// is opened in a plain browser tab (e.g. `npm run dev:dashboard` without
// Electron), so the UI can be iterated on quickly without spinning up the
// whole capturer/server stack.
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

function mockPresetId() {
  return `mock-cp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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
      moderator: { enabled: false, authorColor: '#fca5a5', badge: 'MOD', fontSize: null },
      member: { enabled: false, authorColor: '#93c5fd', badge: '★', fontSize: null },
      superchat: { enabled: false, authorColor: '#fde047', badge: '✦', showAmount: true, fontSize: null },
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

  // In-memory custom presets store for the mock
  let mockCustomPresets = [];

  const statusListeners = new Set();
  const configListeners = new Set();
  const layoutListeners = new Set();
  const slotStyleListeners = new Set();
  const animationListeners = new Set();
  const decorationListeners = new Set();
  const roleStyleListeners = new Set();
  const themeChangedListeners = new Set();

  function customPresetMetaList() {
    return mockCustomPresets.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }));
  }

  return {
    getInitialState: async () => ({
      status,
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
      { id: 'minimal-white', name: 'Minimal White',  description: 'Clean white bubble with dark text — minimal and highly readable.', preview: { bubbleBg: 'rgba(255, 255, 255, 0.92)', authorColor: '#2563EB', textColor: '#1E293B' } },
      { id: 'minimal-dark',  name: 'Minimal Dark',   description: 'Clean dark bubble with light text — minimal, modern, and readable.', preview: { bubbleBg: 'rgba(15, 17, 23, 0.72)', authorColor: '#818CF8', textColor: '#EAECEF' } },
      { id: 'discord',       name: 'Discord',        description: 'Discord dark with Blurple accents.', preview: { bubbleBg: 'rgba(49, 51, 56, 0.9)', authorColor: '#5865F2', textColor: '#DBDEE1' } },
      { id: 'cyber-neon',    name: 'Cyber Neon',     description: 'Electric-cyan cyberpunk.', preview: { bubbleBg: 'rgba(6, 10, 20, 0.85)', authorColor: '#00F0FF', textColor: '#B9FBFF' } },
      { id: 'pastel-pink',   name: 'Pastel Pink',    description: 'Soft pink bubbles.', preview: { bubbleBg: 'rgba(255, 228, 240, 0.9)', authorColor: '#E85D9E', textColor: '#6B3A52' } },
      { id: 'glassmorphism', name: 'Glassmorphism',  description: 'Frosted-glass panel.', preview: { bubbleBg: 'rgba(255, 255, 255, 0.14)', authorColor: '#7DD3FC', textColor: '#F1F5F9' } },
      { id: 'cute-bubble',   name: 'Cute Bubble',    description: 'Round, colourful speech bubbles with a playful bounce entrance.', preview: { bubbleBg: 'rgba(110, 60, 220, 0.72)', authorColor: '#FF6FA5', textColor: '#FFFFFF' } },
      { id: 'anime',         name: 'Anime',          description: 'Muted dark panel with red accents.', preview: { bubbleBg: 'rgba(22, 25, 31, 0.65)', authorColor: '#FF5252', textColor: '#E0E0E0' } },
      { id: 'vtuber-cute',   name: 'VTuber Cute',    description: 'Colourful idol-style bubbles with bright gradients and bunny-ear accents.', preview: { bubbleBg: 'rgba(80, 30, 120, 0.78)', authorColor: '#FF94CC', textColor: '#FFF0F8' } },
      { id: 'night-sky',     name: 'Night Sky',      description: 'Deep navy with aurora glow.', preview: { bubbleBg: 'rgba(8, 12, 28, 0.85)', authorColor: '#A78BFA', textColor: '#E0E7FF' } },
      { id: 'cute',          name: 'Cute',           description: 'Warm pink bubbles with round edges and bunny ears — a cosy, kawaii look.', preview: { bubbleBg: 'rgba(255, 235, 246, 0.92)', authorColor: '#FF5FA8', textColor: '#3A2233' } },
      { id: 'dreamcore',     name: 'Dreamcore',      description: 'Deep purple semi-transparent bubble with a dashed lilac border and bunny ears.', preview: { bubbleBg: 'rgba(88, 61, 138, 0.55)', authorColor: '#C7A7FF', textColor: '#F1E9FF' } },
      { id: 'retro',         name: 'Retro',          description: 'Warm parchment bubbles with a monospace font and hard ink border — vintage terminal vibes.', preview: { bubbleBg: 'rgba(245, 224, 178, 0.95)', authorColor: '#B8410C', textColor: '#2B1B0E' } },
      { id: 'neon',          name: 'Neon',           description: 'Dark terminal bubble with teal-green neon border and double drop-shadow glow.', preview: { bubbleBg: 'rgba(14, 16, 19, 0.85)', authorColor: '#35E6B0', textColor: '#EAECEF' } },
      { id: 'maid',          name: 'Maid',           description: 'Maid café style — crisp white bubble, black lace trim, and a cherry-red bow accent.', preview: { bubbleBg: 'rgba(255, 250, 250, 0.92)', authorColor: '#C81E3A', textColor: '#3A2E2E' } },
      { id: 'ca-phe',        name: 'Cà Phê',         description: 'Warm coffee-shop tones — cream bubble, espresso-brown border, cinnamon accents.', preview: { bubbleBg: 'rgba(245, 232, 216, 0.88)', authorColor: '#8B4513', textColor: '#4B3324' } },
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

    // ── Custom Presets (mock — in-memory only) ─────────────────────────────

    listCustomPresets: async () => customPresetMetaList(),

    saveCustomPreset: async (name, snapshot) => {
      const now = new Date().toISOString();
      const existing = mockCustomPresets.find((p) => p.name === name);
      if (existing) {
        Object.assign(existing, snapshot, { updatedAt: now });
      } else {
        mockCustomPresets.push({ id: mockPresetId(), name, createdAt: now, updatedAt: now, ...snapshot });
      }
      return { ok: true, list: customPresetMetaList() };
    },

    deleteCustomPreset: async (id) => {
      const idx = mockCustomPresets.findIndex((p) => p.id === id);
      if (idx === -1) return { ok: false, error: 'preset_not_found' };
      mockCustomPresets.splice(idx, 1);
      return { ok: true };
    },

    renameCustomPreset: async (id, newName) => {
      const preset = mockCustomPresets.find((p) => p.id === id);
      if (!preset) return { ok: false, error: 'preset_not_found' };
      preset.name = newName;
      preset.updatedAt = new Date().toISOString();
      return { ok: true };
    },

    applyCustomPreset: async (id) => {
      const preset = mockCustomPresets.find((p) => p.id === id);
      if (!preset) return { ok: false, error: 'preset_not_found' };
      config = preset.customizeConfig || config;
      layoutConfig = preset.layoutConfig || layoutConfig;
      slotStyleConfig = preset.slotStyleConfig || slotStyleConfig;
      animationConfig = preset.animationConfig || animationConfig;
      decorationConfig = preset.decorationConfig || decorationConfig;
      roleStyleConfig = preset.roleStyleConfig || roleStyleConfig;
      const payload = { themeId: 'classic', config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig };
      themeChangedListeners.forEach((cb) => cb(payload));
      return { ok: true, customizeConfig: config, layoutConfig, slotStyleConfig, animationConfig, decorationConfig, roleStyleConfig };
    },

    // Export/import are no-ops in the mock (no file system access in a browser tab)
    exportCustomPresets: async () => {
      console.warn('[ipc mock] exportCustomPresets: no-op outside Electron');
      return { ok: false, canceled: true };
    },
    importCustomPresets: async () => {
      console.warn('[ipc mock] importCustomPresets: no-op outside Electron');
      return { ok: false, canceled: true };
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