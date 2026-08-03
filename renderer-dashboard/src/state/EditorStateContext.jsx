import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mergeSlot } from '../components/Customize/shared/configHelpers.js';

const EditorStateContext = createContext(null);

const CONFIG_DEBOUNCE_MS = 100;
const SLOT_DEBOUNCE_MS = 100;
const LAYOUT_DEBOUNCE_MS = 100;
const DECORATION_DEBOUNCE_MS = 100;
const ROLE_DEBOUNCE_MS = 120;
const FAN_SERVICE_DEBOUNCE_MS = 120;

function applyInitialState(state, setters) {
  setters.setLocal(state.customizeConfig);
  setters.setLayoutLocal(state.layoutConfig);
  setters.setSlotLocal(state.slotStyleConfig);
  setters.setDecorationLocal(state.decorationConfig);
  setters.setRoleLocal(state.roleStyleConfig);
  setters.setFanServiceLocal(state.fanServiceConfig);
  setters.setAnimLocal(state.animationConfig);
  setters.setOverlayUrl(state.overlayUrl);
  setters.setLastSessionUrl(state.lastSessionUrl || '');
  setters.setStatus(state.status);
}

// EditorStateProvider — the ONE source of truth for every piece of overlay
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
  const [fanServiceLocal, setFanServiceLocal] = useState(null);

  // ── Non-editable app state (connection, preview) ──────────────────────────
  const [overlayUrl, setOverlayUrl] = useState('');
  const [lastSessionUrl, setLastSessionUrl] = useState('');
  const [status, setStatus] = useState({ status: 'idle', error: null });
  const [previewKey, setPreviewKey] = useState(0);

  // ── Multi-port state ──────────────────────────────────────────────────────
  const [ports, setPorts] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState(null);

  const configDebounce = useRef(null);
  const slotDebounce = useRef(null);
  const layoutDebounce = useRef(null);
  const decorationDebounce = useRef(null);
  const roleDebounce = useRef(null);
  const fanServiceDebounce = useRef(null);

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
          setFanServiceLocal,
          setAnimLocal,
          setOverlayUrl,
          setLastSessionUrl,
          setStatus,
        });
        // Port list from initial state
        if (state.ports) setPorts(state.ports);
        if (state.selectedPortId) setSelectedPortId(state.selectedPortId);
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
      api.onStatusChanged((payload) => {
        setStatus(payload);
        if (payload.status === 'connected') {
          setPreviewKey((k) => k + 1);
        }
      }),
      api.onConfigUpdated((payload) => setLocal(payload)),
      api.onLayoutUpdated((payload) => setLayoutLocal(payload)),
      api.onSlotStyleUpdated((payload) => setSlotLocal(payload)),
      api.onDecorationUpdated?.((payload) => setDecorationLocal(payload)),
      api.onRoleStyleUpdated?.((payload) => setRoleLocal(payload)),
      api.onFanServiceUpdated?.((payload) => setFanServiceLocal(payload)),
      api.onAnimationUpdated?.((payload) => setAnimLocal(payload)),
      api.onThemeChanged((payload) => {
        setLocal(payload.config);
        setLayoutLocal(payload.layoutConfig);
        setSlotLocal(payload.slotStyleConfig);
        setDecorationLocal(payload.decorationConfig);
        setRoleLocal(payload.roleStyleConfig);
        setAnimLocal(payload.animationConfig);
        if (payload.fanServiceConfig) setFanServiceLocal(payload.fanServiceConfig);
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

  const pushAnimationUpdate = useCallback(
    async (partial) => {
      const result = await api.updateAnimation(partial);
      if (result?.animationConfig) setAnimLocal(result.animationConfig);
      return result;
    },
    [api],
  );

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

  // Fan Service edits a single group ('superchat' | 'membership') at a time
  // — same shallow-merge-per-group shape as the backend's mergeFanServiceConfig.
  const pushFanServiceUpdate = useCallback(
    (group, patch) => {
      setFanServiceLocal((prev) => ({
        ...prev,
        [group]: { ...(prev?.[group] || {}), ...patch },
      }));
      clearTimeout(fanServiceDebounce.current);
      fanServiceDebounce.current = setTimeout(() => {
        api.updateFanServiceConfig({ [group]: patch });
      }, FAN_SERVICE_DEBOUNCE_MS);
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
      if (result.fanServiceConfig) setFanServiceLocal(result.fanServiceConfig);
      setPreviewKey((k) => k + 1);
    }
    return result;
  }, [api]);

  // Serializes the CURRENT editing buffers — the exact same state the
  const buildPresetSnapshot = useCallback(
    () => ({
      customizeConfig: local,
      layoutConfig: layoutLocal,
      slotStyleConfig: slotLocal,
      animationConfig: animLocal,
      decorationConfig: decorationLocal,
      roleStyleConfig: roleLocal,
      fanServiceConfig: fanServiceLocal,
    }),
    [local, layoutLocal, slotLocal, animLocal, decorationLocal, roleLocal, fanServiceLocal],
  );

  // ── Port actions ───────────────────────────────────────────────────────────

  /**
   * Switch the dashboard to editing a different port.
   * The main process returns the full state of that port; we apply it to all
   * editing buffers so the panels immediately reflect the new port's settings.
   */
  const selectPort = useCallback(
    async (id) => {
      const result = await api.portSelect(id);
      if (!result?.ok) return;

      setLocal(result.customizeConfig);
      setLayoutLocal(result.layoutConfig);
      setSlotLocal(result.slotStyleConfig);
      setDecorationLocal(result.decorationConfig);
      setRoleLocal(result.roleStyleConfig);
      setAnimLocal(result.animationConfig);
      if (result.fanServiceConfig) setFanServiceLocal(result.fanServiceConfig);
      setOverlayUrl(result.overlayUrl);
      setSelectedPortId(result.selectedPortId);
      if (result.ports) setPorts(result.ports);
      setPreviewKey((k) => k + 1);
    },
    [api],
  );

  /** Create a new port (cloned from the currently selected one). */
  const createPort = useCallback(
    async (name) => {
      const result = await api.portCreate(name);
      if (!result?.ok) return result;

      // Auto-switch to the new port
      setOverlayUrl(result.overlayUrl);
      setSelectedPortId(result.selectedPortId);
      if (result.ports) setPorts(result.ports);
      setPreviewKey((k) => k + 1);
      return result;
    },
    [api],
  );

  /** Remove a port by id. */
  const removePort = useCallback(
    async (id) => {
      const result = await api.portRemove(id);
      if (!result?.ok) return result;

      if (result.ports) setPorts(result.ports);

      // If the deleted port was selected, switch to whatever the backend chose
      if (result.newSelectedId && result.newSelectedId !== selectedPortId) {
        await selectPort(result.newSelectedId);
      }
      return result;
    },
    [api, selectedPortId, selectPort],
  );

  /** Rename a port. */
  const renamePort = useCallback(
    async (id, name) => {
      const result = await api.portRename(id, name);
      if (result?.ports) setPorts(result.ports);
      return result;
    },
    [api],
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
    fanServiceLocal,

    pushConfigUpdate,
    pushSlotUpdate,
    pushAnimationUpdate,
    pushLayoutUpdate,
    pushDecorationUpdate,
    pushRoleUpdate,
    pushFanServiceUpdate,
    resetPreset,
    buildPresetSnapshot,

    // Multi-port
    ports,
    selectedPortId,
    selectPort,
    createPort,
    removePort,
    renamePort,
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
