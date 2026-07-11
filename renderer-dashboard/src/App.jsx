import { useCallback, useEffect, useState } from 'react';
import api from './lib/ipc.js';
import ConnectPanel from './components/ConnectPanel.jsx';
import CustomizePanel from './components/CustomizePanel.jsx';
import LayoutPanel from './components/LayoutPanel.jsx';
import DecorationsPanel from './components/DecorationsPanel.jsx';
import RoleStylesPanel from './components/RoleStylesPanel.jsx';
import ThemeLibraryPanel from './components/ThemeLibraryPanel.jsx';
import ChatPreview from './components/ChatPreview.jsx';
import StatusBadge from './components/StatusBadge.jsx';

// Tabs for the four "settings" panels — ConnectPanel stays outside this list
// and is always rendered above, since connection status matters regardless
// of which settings tab the user is working in.
const TABS = [
  { id: 'customize', label: 'Tuỳ chỉnh' },
  { id: 'layout', label: 'Bố cục' },
  { id: 'decorations', label: 'Trang trí' },
  { id: 'roles', label: 'Vai trò' },
];

function TabBar({ active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Nhóm tuỳ chỉnh"
      className="flex gap-1 rounded-xl bg-panel border border-line shadow-panel p-1 shrink-0"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focusAccent ${
              isActive
                ? 'bg-focusAccent text-white'
                : 'text-inkMuted hover:bg-panelAlt hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function applyInitialState(state, setters) {
  setters.setConfig(state.customizeConfig);
  setters.setLayoutConfig(state.layoutConfig);
  setters.setSlotStyleConfig(state.slotStyleConfig);
  setters.setDecorationConfig(state.decorationConfig);
  setters.setRoleStyleConfig(state.roleStyleConfig);
  setters.setAnimationConfig(state.animationConfig);
  setters.setOverlayUrl(state.overlayUrl);
  setters.setLastSessionUrl(state.lastSessionUrl || '');
  setters.setStatus(state.status);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [config, setConfig] = useState(null);
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [slotStyleConfig, setSlotStyleConfig] = useState(null);
  const [decorationConfig, setDecorationConfig] = useState(null);
  const [roleStyleConfig, setRoleStyleConfig] = useState(null);
  const [animationConfig, setAnimationConfig] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState('');
  const [lastSessionUrl, setLastSessionUrl] = useState('');
  const [status, setStatus] = useState({ status: 'idle', error: null });
  const [previewKey, setPreviewKey] = useState(0);
  const [activeTab, setActiveTab] = useState('customize');

  const loadInitialState = useCallback(() => {
    setLoading(true);
    setLoadError(null);

    return api
      .getInitialState()
      .then((state) => {
        applyInitialState(state, {
          setConfig,
          setLayoutConfig,
          setSlotStyleConfig,
          setDecorationConfig,
          setRoleStyleConfig,
          setAnimationConfig,
          setOverlayUrl,
          setLastSessionUrl,
          setStatus,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('[App] getInitialState failed:', err);
        setLoadError('Không tải được trạng thái ứng dụng. Kiểm tra Electron đang chạy đúng cách.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let unsubStatus, unsubConfig, unsubLayout, unsubSlotStyle, unsubDecoration, unsubRoleStyle, unsubAnimation, unsubTheme;

    loadInitialState();

    unsubStatus = api.onStatusChanged((payload) => setStatus(payload));
    unsubConfig = api.onConfigUpdated((payload) => setConfig(payload));
    unsubLayout = api.onLayoutUpdated((payload) => setLayoutConfig(payload));
    unsubSlotStyle = api.onSlotStyleUpdated((payload) => setSlotStyleConfig(payload));
    unsubDecoration = api.onDecorationUpdated?.((payload) => setDecorationConfig(payload));
    unsubRoleStyle = api.onRoleStyleUpdated?.((payload) => setRoleStyleConfig(payload));
    unsubAnimation = api.onAnimationUpdated?.((payload) => setAnimationConfig(payload));
    unsubTheme = api.onThemeChanged((payload) => {
      setConfig(payload.config);
      setLayoutConfig(payload.layoutConfig);
      setSlotStyleConfig(payload.slotStyleConfig);
      setDecorationConfig(payload.decorationConfig);
      setRoleStyleConfig(payload.roleStyleConfig);
      setAnimationConfig(payload.animationConfig);
      setPreviewKey((k) => k + 1);
    });

    return () => {
      unsubStatus && unsubStatus();
      unsubConfig && unsubConfig();
      unsubLayout && unsubLayout();
      unsubSlotStyle && unsubSlotStyle();
      unsubDecoration && unsubDecoration();
      unsubRoleStyle && unsubRoleStyle();
      unsubAnimation && unsubAnimation();
      unsubTheme && unsubTheme();
    };
  }, [loadInitialState]);

  // Passed to ThemeLibraryPanel's "Reset toàn bộ theme" action. We don't need
  // to manually setState here — theme:reset-preset broadcasts theme:changed,
  // which the onThemeChanged listener above already handles for every panel.
  const resetThemeLibraryPreset = useCallback(() => api.resetPreset?.(), []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-inkMuted text-sm">
        Đang khởi động…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-live max-w-md leading-relaxed">{loadError}</p>
        <button
          type="button"
          onClick={loadInitialState}
          className="rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white text-sm font-semibold px-5 py-2"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-line shrink-0 flex-wrap">
        <ConnectPanel
          api={api}
          status={status}
          lastSessionUrl={lastSessionUrl}
          onConnected={(url) => setLastSessionUrl(url)}
          compact
        />
        <StatusBadge status={status.status} />
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[300px_1fr_300px] gap-4 p-4">
        <div className="flex flex-col gap-4 min-h-0">
          <TabBar active={activeTab} onChange={setActiveTab} />

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {activeTab === 'customize' && (
              <CustomizePanel api={api} config={config} slotStyleConfig={slotStyleConfig} animationConfig={animationConfig} />
            )}
            {activeTab === 'layout' && <LayoutPanel api={api} layoutConfig={layoutConfig} />}
            {activeTab === 'decorations' && (
              <DecorationsPanel api={api} decorationConfig={decorationConfig} />
            )}
            {activeTab === 'roles' && <RoleStylesPanel api={api} roleStyleConfig={roleStyleConfig} />}
          </div>
        </div>

        <ChatPreview
          overlayUrl={overlayUrl}
          previewKey={previewKey}
          onRefresh={() => setPreviewKey((k) => k + 1)}
        />

        <div className="min-h-0 overflow-y-auto pr-1">
          <ThemeLibraryPanel api={api} resetPreset={resetThemeLibraryPreset} />
        </div>
      </main>
    </div>
  );
}
