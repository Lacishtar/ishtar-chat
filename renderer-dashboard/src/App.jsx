import { useState } from 'react';
import api from './lib/ipc.js';
import { EditorStateProvider, useEditorState } from './state/EditorStateContext.jsx';
import ConnectPanel from './components/ConnectPanel.jsx';
import CustomizePanel from './components/CustomizePanel.jsx';
import LayoutPanel from './components/LayoutPanel.jsx';
import DecorationsPanel from './components/DecorationsPanel.jsx';
import RoleStylesPanel from './components/RoleStylesPanel.jsx';
import ThemeLibraryPanel from './components/ThemeLibraryPanel.jsx';
import CustomPresetsPanel from './components/CustomPresetsPanel.jsx';
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

// All customize/layout/slot-style/animation/decoration/role-style data now
// lives in EditorStateContext (see state/EditorStateContext.jsx) — the one
// authoritative buffer that the Inspector, LayoutPanel, DecorationsPanel,
// RoleStylesPanel, and CustomPresetsPanel all read from and write to
// directly. AppShell only owns things that aren't part of that editing
// buffer: connection status, the preview iframe, and which tab is active.
function AppShell() {
  const {
    loading,
    loadError,
    reload,
    status,
    overlayUrl,
    lastSessionUrl,
    setLastSessionUrl,
    previewKey,
    bumpPreviewKey,
    resetPreset,
  } = useEditorState();
  const [activeTab, setActiveTab] = useState('customize');

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
          onClick={reload}
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
        />
        <StatusBadge status={status.status} />
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 p-4">
        <div className="flex flex-col gap-4 min-h-0">
          <TabBar active={activeTab} onChange={setActiveTab} />

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {activeTab === 'customize' && <CustomizePanel />}
            {activeTab === 'layout' && <LayoutPanel />}
            {activeTab === 'decorations' && <DecorationsPanel />}
            {activeTab === 'roles' && <RoleStylesPanel />}
          </div>
        </div>

        <ChatPreview overlayUrl={overlayUrl} previewKey={previewKey} onRefresh={bumpPreviewKey} />

        {/* Right column: Theme Library above, Custom Presets below */}
        <div className="min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
          <ThemeLibraryPanel api={api} resetPreset={resetPreset} />
          <CustomPresetsPanel />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <EditorStateProvider api={api}>
      <AppShell />
    </EditorStateProvider>
  );
}
