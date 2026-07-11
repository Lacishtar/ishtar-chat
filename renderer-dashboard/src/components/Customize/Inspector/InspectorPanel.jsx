import useCustomizeState from './useCustomizeState.js';
import ObjectSelector from './ObjectSelector.jsx';
import SearchBar from './SearchBar.jsx';
import FavoritesBar from './FavoritesBar.jsx';
import GlobalInspector from '../ObjectInspectors/GlobalInspector.jsx';
import AvatarInspector from '../ObjectInspectors/AvatarInspector.jsx';
import AuthorInspector from '../ObjectInspectors/AuthorInspector.jsx';
import MessageInspector from '../ObjectInspectors/MessageInspector.jsx';
import BadgesInspector from '../ObjectInspectors/BadgesInspector.jsx';
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

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Tuỳ chỉnh</h2>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Reset toàn bộ tuỳ chỉnh về theme hiện tại?')) return;
            await resetPreset();
          }}
          className="shrink-0 px-2.5 py-1 rounded-md text-xs bg-panelAlt text-inkMuted hover:bg-line border border-line"
        >
          Reset theme
        </button>
      </div>

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
