import { useEffect, useMemo, useRef, useState } from 'react';
import { mergeSlot } from '../shared/configHelpers.js';

const FAVORITES_KEY = 'ovs.inspector.favorites';
const EXPANDED_KEY = 'ovs.inspector.expanded';

function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    window.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (e.g. sandboxed webview) — Inspector still works,
    // it just won't remember favorites/expanded sections between sessions.
  }
}

/**
 * Everything the Inspector needs, split into two clearly separate buckets:
 *
 *  - overlay data: `local` / `slotLocal` mirror `config` / `slotStyleConfig`
 *    and are pushed to the main process (via `api`) debounced, exactly like
 *    the previous CustomizePanel did. This is the data that gets saved to
 *    disk and must stay backward compatible.
 *
 *  - Inspector UI state: `selectedObject`, `expanded`, `searchKeyword`,
 *    `favorites`. This never touches overlay data and is persisted (if
 *    possible) only to make the *tool* nicer to use across sessions.
 */
export default function useCustomizeState({ api, config, slotStyleConfig, animationConfig }) {
  const [local, setLocal] = useState(config);
  const [slotLocal, setSlotLocal] = useState(slotStyleConfig || { slots: {} });
  const [animLocal, setAnimLocal] = useState(animationConfig || { style: 'slide', targets: {} });
  const debounceRef = useRef(null);
  const slotDebounceRef = useRef(null);

  useEffect(() => setLocal(config), [config]);
  useEffect(() => setSlotLocal(slotStyleConfig || { slots: {} }), [slotStyleConfig]);
  useEffect(() => {
    if (animationConfig) setAnimLocal(animationConfig);
  }, [animationConfig]);

  function pushUpdate(partial) {
    setLocal((prev) => ({ ...prev, ...partial }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => api.updateConfig(partial), 100);
  }

  function pushSlotUpdate(slot, patch) {
    setSlotLocal((prev) => mergeSlot(prev, slot, patch));
    clearTimeout(slotDebounceRef.current);
    slotDebounceRef.current = setTimeout(() => {
      api.updateSlotStyle({ slots: { [slot]: patch } });
    }, 100);
  }

  // Style changes (e.g. picking "Nảy" from the dropdown) are applied
  // immediately, no debounce — this is a discrete choice, not a drag/slider,
  // and the overlay preview should react to it right away.
  async function pushAnimationUpdate(partial) {
    const result = await api.updateAnimation(partial);
    if (result?.animationConfig) setAnimLocal(result.animationConfig);
  }

  async function resetPreset() {
    const result = await api.resetPreset?.();
    if (result?.ok) {
      setLocal(result.config);
      setSlotLocal(result.slotStyleConfig || { slots: {} });
    }
    return result;
  }

  // --- Inspector-only UI state (kept out of overlay data on purpose) ---
  const [selectedObject, setSelectedObject] = useState('global');
  const [expanded, setExpanded] = useState(() => loadJSON(EXPANDED_KEY, {}));
  const [searchKeyword, setSearchKeyword] = useState('');
  const [favorites, setFavorites] = useState(() => loadJSON(FAVORITES_KEY, []));
  const [highlightSection, setHighlightSection] = useState(null);

  useEffect(() => saveJSON(EXPANDED_KEY, expanded), [expanded]);
  useEffect(() => saveJSON(FAVORITES_KEY, favorites), [favorites]);

  function isExpanded(objectId, sectionId, defaultOpen = false) {
    const key = `${objectId}:${sectionId}`;
    return key in expanded ? expanded[key] : defaultOpen;
  }

  function toggleSection(objectId, sectionId, defaultOpen = false) {
    const key = `${objectId}:${sectionId}`;
    setExpanded((prev) => ({ ...prev, [key]: !(key in prev ? prev[key] : defaultOpen) }));
  }

  function toggleFavorite(favoriteKey) {
    setFavorites((prev) =>
      prev.includes(favoriteKey) ? prev.filter((k) => k !== favoriteKey) : [...prev, favoriteKey],
    );
  }

  function jumpTo({ objectId, sectionId }) {
    setSelectedObject(objectId);
    setSearchKeyword('');
    setExpanded((prev) => ({ ...prev, [`${objectId}:${sectionId}`]: true }));
    setHighlightSection(sectionId);
    // Let the section mount/expand before scrolling & clearing the highlight.
    requestAnimationFrame(() => {
      document.getElementById(`section-${objectId}-${sectionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
    setTimeout(() => setHighlightSection(null), 1600);
  }

  const isFavorite = useMemo(() => (key) => favorites.includes(key), [favorites]);

  if (!local) return null;

  return {
    local,
    slotLocal,
    animLocal,
    pushUpdate,
    pushSlotUpdate,
    pushAnimationUpdate,
    resetPreset,
    selectedObject,
    setSelectedObject,
    searchKeyword,
    setSearchKeyword,
    favorites,
    isFavorite,
    toggleFavorite,
    isExpanded,
    toggleSection,
    highlightSection,
    jumpTo,
  };
}
