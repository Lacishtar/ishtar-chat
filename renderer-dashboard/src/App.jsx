import { useEffect, useState } from 'react';
import api from './lib/ipc.js';
import ConnectPanel from './components/ConnectPanel.jsx';
import ThemeGallery from './components/ThemeGallery.jsx';
import CustomizePanel from './components/CustomizePanel.jsx';
import LayoutPanel from './components/LayoutPanel.jsx';
import ChatPreview from './components/ChatPreview.jsx';
import StatusBadge from './components/StatusBadge.jsx';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [config, setConfig] = useState(null);
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [slotStyleConfig, setSlotStyleConfig] = useState(null);
  const [overlayUrl, setOverlayUrl] = useState('');
  const [status, setStatus] = useState({ status: 'idle', error: null });

  useEffect(() => {
    let unsubStatus, unsubConfig, unsubLayout, unsubSlotStyle, unsubTheme;

    api.getInitialState().then((state) => {
      setThemes(state.themes);
      setSelectedTheme(state.selectedTheme);
      setConfig(state.customizeConfig);
      setLayoutConfig(state.layoutConfig);
      setSlotStyleConfig(state.slotStyleConfig);
      setOverlayUrl(state.overlayUrl);
      setStatus(state.status);
      setLoading(false);
    });

    unsubStatus = api.onStatusChanged((payload) => setStatus(payload));
    unsubConfig = api.onConfigUpdated((payload) => setConfig(payload));
    unsubLayout = api.onLayoutUpdated((payload) => setLayoutConfig(payload));
    unsubSlotStyle = api.onSlotStyleUpdated((payload) => setSlotStyleConfig(payload));
    unsubTheme = api.onThemeChanged((payload) => {
      setSelectedTheme(payload.themeId);
      setConfig(payload.config);
      setLayoutConfig(payload.layoutConfig);
      setSlotStyleConfig(payload.slotStyleConfig);
    });

    return () => {
      unsubStatus && unsubStatus();
      unsubConfig && unsubConfig();
      unsubLayout && unsubLayout();
      unsubSlotStyle && unsubSlotStyle();
      unsubTheme && unsubTheme();
    };
  }, []);

  async function handleSelectTheme(themeId) {
    if (themeId === selectedTheme) return;

    const dirtyCheck = await api.isThemeDirty?.();
    if (dirtyCheck?.dirty) {
      const ok = window.confirm('Đổi preset sẽ reset toàn bộ tuỳ chỉnh. Tiếp tục?');
      if (!ok) return;
    }

    const result = await api.selectTheme(themeId);
    if (result.ok) {
      setSelectedTheme(themeId);
      setConfig(result.config);
      setLayoutConfig(result.layoutConfig);
      setSlotStyleConfig(result.slotStyleConfig);
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-inkMuted text-sm">
        Đang khởi động…
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
          <ConnectPanel api={api} status={status} />
          <ThemeGallery themes={themes} selectedTheme={selectedTheme} onSelect={handleSelectTheme} />
          <CustomizePanel api={api} config={config} slotStyleConfig={slotStyleConfig} />
          <LayoutPanel api={api} layoutConfig={layoutConfig} />
        </div>

        <ChatPreview overlayUrl={overlayUrl} />
      </main>
    </div>
  );
}
