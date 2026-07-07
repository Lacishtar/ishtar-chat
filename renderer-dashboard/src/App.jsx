import { useCallback, useEffect, useState } from 'react';
import api from './lib/ipc.js';
import ConnectPanel from './components/ConnectPanel.jsx';
import ThemeGallery from './components/ThemeGallery.jsx';
import CustomizePanel from './components/CustomizePanel.jsx';
import LayoutPanel from './components/LayoutPanel.jsx';
import ChatPreview from './components/ChatPreview.jsx';
import StatusBadge from './components/StatusBadge.jsx';

function applyInitialState(state, setters) {
  setters.setThemes(state.themes);
  setters.setSelectedTheme(state.selectedTheme);
  setters.setConfig(state.customizeConfig);
  setters.setLayoutConfig(state.layoutConfig);
  setters.setSlotStyleConfig(state.slotStyleConfig);
  setters.setOverlayUrl(state.overlayUrl);
  setters.setLastSessionUrl(state.lastSessionUrl || '');
  setters.setStatus(state.status);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [config, setConfig] = useState(null);
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [slotStyleConfig, setSlotStyleConfig] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState('');
  const [lastSessionUrl, setLastSessionUrl] = useState('');
  const [status, setStatus] = useState({ status: 'idle', error: null });
  const [previewKey, setPreviewKey] = useState(0);

  const loadInitialState = useCallback(() => {
    setLoading(true);
    setLoadError(null);

    return api
      .getInitialState()
      .then((state) => {
        applyInitialState(state, {
          setThemes,
          setSelectedTheme,
          setConfig,
          setLayoutConfig,
          setSlotStyleConfig,
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
    let unsubStatus, unsubConfig, unsubLayout, unsubSlotStyle, unsubTheme;

    loadInitialState();

    unsubStatus = api.onStatusChanged((payload) => setStatus(payload));
    unsubConfig = api.onConfigUpdated((payload) => setConfig(payload));
    unsubLayout = api.onLayoutUpdated((payload) => setLayoutConfig(payload));
    unsubSlotStyle = api.onSlotStyleUpdated((payload) => setSlotStyleConfig(payload));
    unsubTheme = api.onThemeChanged((payload) => {
      setSelectedTheme(payload.themeId);
      setConfig(payload.config);
      setLayoutConfig(payload.layoutConfig);
      setSlotStyleConfig(payload.slotStyleConfig);
      setPreviewKey((k) => k + 1);
    });

    return () => {
      unsubStatus && unsubStatus();
      unsubConfig && unsubConfig();
      unsubLayout && unsubLayout();
      unsubSlotStyle && unsubSlotStyle();
      unsubTheme && unsubTheme();
    };
  }, [loadInitialState]);

  async function handleSelectTheme(themeId) {
    if (themeId === selectedTheme) return;

    const dirtyCheck = await api.isThemeDirty?.();
    if (dirtyCheck?.dirty) {
      const fields = dirtyCheck.dirtyFields?.length
        ? dirtyCheck.dirtyFields.join(', ')
        : 'tuỳ chỉnh';
      const ok = window.confirm(
        `Đổi preset sẽ reset toàn bộ tuỳ chỉnh hiện tại (${fields}). Tiếp tục?`
      );
      if (!ok) return;
    }

    const result = await api.selectTheme(themeId);
    if (result.ok) {
      setSelectedTheme(themeId);
      setConfig(result.config);
      setLayoutConfig(result.layoutConfig);
      setSlotStyleConfig(result.slotStyleConfig);
      setPreviewKey((k) => k + 1);
    }
  }

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
      <header className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <span className="ovs-signal-dot bg-focusAccent" />
          <h1 className="font-display text-base font-semibold tracking-tight">
            YouTube Overlay Studio
          </h1>
        </div>
        <StatusBadge status={status.status} />
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[340px_1fr] gap-4 p-4">
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <ConnectPanel
            api={api}
            status={status}
            lastSessionUrl={lastSessionUrl}
            onConnected={(url) => setLastSessionUrl(url)}
          />
          <ThemeGallery themes={themes} selectedTheme={selectedTheme} onSelect={handleSelectTheme} />
          <CustomizePanel api={api} config={config} slotStyleConfig={slotStyleConfig} />
          <LayoutPanel api={api} layoutConfig={layoutConfig} />
        </div>

        <ChatPreview
          overlayUrl={overlayUrl}
          selectedTheme={selectedTheme}
          previewKey={previewKey}
          onRefresh={() => setPreviewKey((k) => k + 1)}
        />
      </main>
    </div>
  );
}
