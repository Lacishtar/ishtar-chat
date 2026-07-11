import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mergeSlot } from '../components/Customize/shared/configHelpers.js';

const EditorStateContext = createContext(null);

// Debounce windows match what each panel used previously — they only gate
// *when the IPC call fires*. The buffers below are never debounced: every
// pushX() call updates its buffer synchronously, in the same tick as the
// user's keystroke/drag/click.
const CONFIG_DEBOUNCE_MS = 100;
const SLOT_DEBOUNCE_MS = 100;
const LAYOUT_DEBOUNCE_MS = 100;
const DECORATION_DEBOUNCE_MS = 100;
const ROLE_DEBOUNCE_MS = 120;

function applyInitialState(state, setters) {
  setters.setLocal(state.customizeConfig);
  setters.setLayoutLocal(state.layoutConfig);
  setters.setSlotLocal(state.slotStyleConfig);
  setters.setDecorationLocal(state.decorationConfig);
  setters.setRoleLocal(state.roleStyleConfig);
  setters.setAnimLocal(state.animationConfig);
  setters.setOverlayUrl(state.overlayUrl);
  setters.setLastSessionUrl(state.lastSessionUrl || '');
  setters.setStatus(state.status);
}

/**
 * EditorStateProvider — the ONE source of truth for every piece of overlay
 * data that the dashboard edits: customize config, slot styles, animation,
 * layout, decorations, and role styles.
 *
 * Previously each panel (Inspector, LayoutPanel, DecorationsPanel,
 * RoleStylesPanel) kept its own `local` state, debounced-pushed it to the
 * main process, and App.jsx kept a *second* copy that only updated once the
 * IPC round-trip completed and broadcast back. Saving a Custom Preset read
 * from App's copy, which meant a save immediately after an edit serialized
 * the previous value instead of what was on screen.
 *
 * Now there is exactly one buffer per category, owned here. Editing UI
 * writes to it immediately (no waiting on IPC); IPC pushes are debounced
 * purely to avoid flooding the backend, and the same buffer is what gets
 * serialized when saving a preset.
 */
export function EditorStateProvider({ api, children }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── The single authoritative editing buffers ──────────────────────────────
  const [local, setLocal] = useState(null); // customizeConfig
  const [layoutLocal, setLayoutLocal] = useState(null);
  const [slotLocal, setSlotLocal] = useState(null);
  const [animLocal, setAnimLocal] = useState(null);
  const [decorationLocal, setDecorationLocal] = useState(null);
  const [roleLocal, setRoleLocal] = useState(null);

  // ── Non-editable app state (connection, preview) ──────────────────────────
  const [overlayUrl, setOverlayUrl] = useState('');
  const [lastSessionUrl, setLastSessionUrl] = useState('');
  const [status, setStatus] = useState({ status: 'idle', error: null });
  const [previewKey, setPreviewKey] = useState(0);

  const configDebounce = useRef(null);
  const slotDebounce = useRef(null);
  const layoutDebounce = useRef(null);
  const decorationDebounce = useRef(null);
  const roleDebounce = useRef(null);

  const loadInitialState = useCallback(() => {
    setLoading(true);
    setLoadError(null);

    return api
      .getInitialState()
      .then((state) => {
        applyInitialState(state, {
          setLocal,
          setLayoutLocal,
          setSlotLocal,
          setDecorationLocal,
          setRoleLocal,
          setAnimLocal,
          setOverlayUrl,
          setLastSessionUrl,
          setStatus,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('[EditorState] getInitialState failed:', err);
        setLoadError('Không tải được trạng thái ứng dụng. Kiểm tra Electron đang chạy đúng cách.');
        setLoading(false);
      });
  }, [api]);

  useEffect(() => {
    loadInitialState();

    const unsubs = [
      api.onStatusChanged((payload) => setStatus(payload)),
      // These broadcasts are the backend echoing back the authoritative
      // merged value (our own debounced push resolving, another window's
      // edit, or a theme/category reset) — they replace the buffer outright.
      api.onConfigUpdated((payload) => setLocal(payload)),
      api.onLayoutUpdated((payload) => setLayoutLocal(payload)),
      api.onSlotStyleUpdated((payload) => setSlotLocal(payload)),
      api.onDecorationUpdated?.((payload) => setDecorationLocal(payload)),
      api.onRoleStyleUpdated?.((payload) => setRoleLocal(payload)),
      api.onAnimationUpdated?.((payload) => setAnimLocal(payload)),
      api.onThemeChanged((payload) => {
        // Loading a theme (or a Custom Preset, which reuses this same
        // broadcast) replaces every buffer with the freshly loaded values —
        // this becomes the new live editing state, not just a sync target.
        setLocal(payload.config);
        setLayoutLocal(payload.layoutConfig);
        setSlotLocal(payload.slotStyleConfig);
        setDecorationLocal(payload.decorationConfig);
        setRoleLocal(payload.roleStyleConfig);
        setAnimLocal(payload.animationConfig);
        setPreviewKey((k) => k + 1);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub && unsub());
  }, [loadInitialState, api]);

  // ── Push helpers ───────────────────────────────────────────────────────────
  // Each one updates its buffer synchronously and debounces only the IPC call.

  const pushConfigUpdate = useCallback(
    (partial) => {
      setLocal((prev) => ({ ...prev, ...partial }));
      clearTimeout(configDebounce.current);
      configDebounce.current = setTimeout(() => api.updateConfig(partial), CONFIG_DEBOUNCE_MS);
    },
    [api],
  );

  const pushSlotUpdate = useCallback(
    (slot, patch) => {
      setSlotLocal((prev) => mergeSlot(prev || { slots: {} }, slot, patch));
      clearTimeout(slotDebounce.current);
      slotDebounce.current = setTimeout(() => {
        api.updateSlotStyle({ slots: { [slot]: patch } });
      }, SLOT_DEBOUNCE_MS);
    },
    [api],
  );

  // A discrete pick (e.g. choosing an animation style), applied immediately —
  // the backend computes the expanded `targets`, so we adopt its response
  // rather than debouncing.
  const pushAnimationUpdate = useCallback(
    async (partial) => {
      const result = await api.updateAnimation(partial);
      if (result?.animationConfig) setAnimLocal(result.animationConfig);
      return result;
    },
    [api],
  );

  // Layout panel deals in a "simple" contracted shape but the buffer (and
  // what main/backend/presets expect) is always the full expanded shape —
  // callers pass the already-expanded full config.
  const pushLayoutUpdate = useCallback(
    (nextLayoutConfig) => {
      setLayoutLocal(nextLayoutConfig);
      clearTimeout(layoutDebounce.current);
      layoutDebounce.current = setTimeout(() => {
        api.updateLayout(nextLayoutConfig);
      }, LAYOUT_DEBOUNCE_MS);
    },
    [api],
  );

  const pushDecorationUpdate = useCallback(
    (nextLayers) => {
      setDecorationLocal({ layers: nextLayers });
      clearTimeout(decorationDebounce.current);
      decorationDebounce.current = setTimeout(() => {
        api.updateDecorationConfig({ layers: nextLayers });
      }, DECORATION_DEBOUNCE_MS);
    },
    [api],
  );

  const pushRoleUpdate = useCallback(
    (roleKey, nextRole) => {
      setRoleLocal((prev) => ({ roles: { ...(prev?.roles || {}), [roleKey]: nextRole } }));
      clearTimeout(roleDebounce.current);
      roleDebounce.current = setTimeout(() => {
        api.updateRoleStyleConfig({ roles: { [roleKey]: nextRole } });
      }, ROLE_DEBOUNCE_MS);
    },
    [api],
  );

  const resetPreset = useCallback(async () => {
    const result = await api.resetPreset?.();
    if (result?.ok) {
      setLocal(result.config);
      setLayoutLocal(result.layoutConfig);
      setSlotLocal(result.slotStyleConfig);
      setDecorationLocal(result.decorationConfig);
      setRoleLocal(result.roleStyleConfig);
      setAnimLocal(result.animationConfig);
      setPreviewKey((k) => k + 1);
    }
    return result;
  }, [api]);

  /**
   * Serializes the CURRENT editing buffers — the exact same state the
   * Inspector/LayoutPanel/DecorationsPanel/RoleStylesPanel are rendering
   * right now, not a copy that depends on an IPC round-trip having landed.
   * This is what CustomPresetsPanel calls when saving/overwriting a preset.
   */
  const buildPresetSnapshot = useCallback(
    () => ({
      customizeConfig: local,
      layoutConfig: layoutLocal,
      slotStyleConfig: slotLocal,
      animationConfig: animLocal,
      decorationConfig: decorationLocal,
      roleStyleConfig: roleLocal,
    }),
    [local, layoutLocal, slotLocal, animLocal, decorationLocal, roleLocal],
  );

  const value = {
    api,
    loading,
    loadError,
    reload: loadInitialState,

    status,
    overlayUrl,
    lastSessionUrl,
    setLastSessionUrl,
    previewKey,
    bumpPreviewKey: () => setPreviewKey((k) => k + 1),

    local,
    slotLocal,
    animLocal,
    layoutLocal,
    decorationLocal,
    roleLocal,

    pushConfigUpdate,
    pushSlotUpdate,
    pushAnimationUpdate,
    pushLayoutUpdate,
    pushDecorationUpdate,
    pushRoleUpdate,
    resetPreset,
    buildPresetSnapshot,
  };

  return <EditorStateContext.Provider value={value}>{children}</EditorStateContext.Provider>;
}

export function useEditorState() {
  const ctx = useContext(EditorStateContext);
  if (!ctx) {
    throw new Error('useEditorState must be used within an EditorStateProvider');
  }
  return ctx;
}
