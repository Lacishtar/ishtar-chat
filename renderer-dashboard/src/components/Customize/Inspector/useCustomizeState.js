import { useEffect, useMemo, useState } from 'react';
import { useEditorState } from '../../../state/EditorStateContext.jsx';

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

// Everything the Inspector needs, split into two clearly separate buckets:
export default function useCustomizeState() {
  const {
    local,
    slotLocal,
    animLocal,
    layoutLocal,
    pushConfigUpdate,
    pushSlotUpdate,
    pushAnimationUpdate,
    resetPreset,
  } = useEditorState();

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

  const isRowBubbleWrap = layoutLocal?.screen?.bubbleWrapRow === true;

  return {
    local,
    slotLocal,
    animLocal,
    layoutLocal,
    isRowBubbleWrap,
    pushUpdate: pushConfigUpdate,
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
