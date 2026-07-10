import useCustomizeState from './useCustomizeState.js';
import ObjectSelector from './ObjectSelector.jsx';
import SearchBar from './SearchBar.jsx';
import FavoritesBar from './FavoritesBar.jsx';
import GlobalInspector from '../ObjectInspectors/GlobalInspector.jsx';
import AvatarInspector from '../ObjectInspectors/AvatarInspector.jsx';
import AuthorInspector from '../ObjectInspectors/AuthorInspector.jsx';
import MessageInspector from '../ObjectInspectors/MessageInspector.jsx';
import BadgesInspector from '../ObjectInspectors/BadgesInspector.jsx';
import ThemePresetSection from '../Presets/ThemePresetSection.jsx';
import { OBJECTS } from '../shared/constants.js';

const INSPECTORS = {
  global: GlobalInspector,
  avatar: AvatarInspector,
  author: AuthorInspector,
  message: MessageInspector,
  badges: BadgesInspector,
};

export default function InspectorPanel({ api, config, slotStyleConfig, animationConfig }) {
  const state = useCustomizeState({ api, config, slotStyleConfig, animationConfig });
  if (!state) return null;

  const { local, slotLocal, pushUpdate, pushSlotUpdate, resetPreset, selectedObject, setSelectedObject } = state;

  const ActiveInspector = INSPECTORS[selectedObject] || GlobalInspector;
  const objectLabel = OBJECTS.find((o) => o.id === selectedObject)?.label;

  // When a preset is applied the main process broadcasts `theme:changed` which
  // App.jsx handles — that already updates config / slotStyleConfig / etc.
  // props flowing back into here. We additionally sync the local state directly
  // so in-panel controls reflect the new values without waiting for the
  // parent re-render cycle.
  function handlePresetApplied(result) {
    if (result?.customizeConfig) {
      state.setLocal?.(result.customizeConfig);
    }
    if (result?.slotStyleConfig) {
      state.setSlotLocal?.(result.slotStyleConfig);
    }
    if (result?.animationConfig) {
      state.setAnimLocal?.(result.animationConfig);
    }
  }

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Tuỳ chỉnh</h2>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Reset toàn bộ tuỳ chỉnh về preset hiện tại?')) return;
            await resetPreset();
          }}
          className="shrink-0 px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
        >
          Reset preset
        </button>
      </div>

      <ThemePresetSection
        api={api}
        resetPreset={resetPreset}
        onApplied={handlePresetApplied}
      />

      <SearchBar keyword={state.searchKeyword} onKeywordChange={state.setSearchKeyword} onJumpTo={state.jumpTo} />

      <FavoritesBar favorites={state.favorites} onJumpTo={state.jumpTo} />

      <div>
        <span className="text-[10px] uppercase tracking-wide text-inkMuted block mb-1.5">Chọn đối tượng</span>
        <ObjectSelector selected={selectedObject} onSelect={setSelectedObject} />
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-[11px] text-inkMuted mb-2">
          Đang chỉnh: <span className="text-ink font-medium">{objectLabel}</span>
        </p>
        <ActiveInspector local={local} slotLocal={slotLocal} pushUpdate={pushUpdate} pushSlotUpdate={pushSlotUpdate} state={state} />
      </div>
    </section>
  );
}
