import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState } from '../state/EditorStateContext.jsx';

/**
 * CustomPresetsPanel — lets users snapshot every current customization setting
 * into a named preset, then apply, rename, overwrite, or delete those presets.
 *
 * Lives directly below ThemeLibraryPanel in the right column of App.jsx.
 *
 * Architecture notes:
 *   - Custom presets are stored server-side in `userData/custom-presets.json`
 *     via the `custom-preset:*` IPC channel family (main/store/custom-presets-store.js).
 *   - This panel owns its preset list state locally; it gets the initial list
 *     on mount and refreshes it from each mutating API response (save, import).
 *     Delete and rename patch local state directly without a server round-trip.
 *   - Applying a preset calls `custom-preset:apply`, which updates configStore
 *     and broadcasts `theme:changed` — the same bus EditorStateContext already
 *     listens to via `onThemeChanged`, so every sibling panel re-syncs
 *     automatically.
 *   - Export / Import delegate file-dialog I/O to the main process; the UI only
 *     receives a result object and shows a status message.
 *   - Saving/overwriting reads `buildPresetSnapshot()` from EditorStateContext,
 *     which serializes the live editing buffers (the same state the
 *     Inspector/LayoutPanel/DecorationsPanel/RoleStylesPanel are rendering
 *     right now) — never a copy that's waiting on a debounced IPC round-trip.
 */

// ── PresetCard ──────────────────────────────────────────────────────────────

const MENU_WIDTH = 144; // matches w-36
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * The "⋯" dropdown, portaled to document.body.
 *
 * The preset list scrolls (`overflow-y-auto max-h-48`), and an `absolute`
 * menu nested inside that container gets clipped for any row near the
 * bottom of the visible area — Overwrite/Delete become partially or fully
 * unreachable. Rendering the menu into the body and positioning it with
 * `fixed` coordinates escapes that clipping entirely; it also lets the menu
 * flip upward automatically when there isn't room below.
 */
function PresetCardMenu({ anchorRef, onClose, children }) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = menuHeight > 0 && spaceBelow < menuHeight + MENU_GAP + VIEWPORT_MARGIN;

      setCoords({
        left: Math.min(
          Math.max(rect.right - MENU_WIDTH, VIEWPORT_MARGIN),
          window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
        ),
        top: openUpward ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP,
      });
    }

    updatePosition();
    // Capture phase so this also fires for scrolling inside the preset
    // list itself, not just window-level scrolling.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !anchorRef.current?.contains(e.target)
      ) {
        onClose();
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        width: MENU_WIDTH,
        visibility: coords ? 'visible' : 'hidden',
      }}
      className="z-50 rounded-xl border border-line bg-panel shadow-panel overflow-hidden"
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * One row in the preset list.  Clicking the name applies the preset; the "⋯"
 * button opens a small dropdown with Rename / Overwrite / Delete options.
 * Rename enters an inline-edit mode that replaces the name text with an input.
 */
function PresetCard({ preset, isApplying, onApply, onRename, onOverwrite, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(preset.name);
  const menuButtonRef = useRef(null);
  const renameInputRef = useRef(null);

  // Focus the rename input as soon as it appears.
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== preset.name) {
      onRename(preset.id, trimmed);
    }
    setRenaming(false);
  }

  function startRename() {
    setMenuOpen(false);
    setRenameValue(preset.name);
    setRenaming(true);
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border bg-panel px-2 py-1.5 transition-colors ${
        isApplying
          ? 'opacity-60 border-focusAccent'
          : 'border-line hover:border-focusAccent/40'
      }`}
    >
      {/* Name — click to apply, or inline rename input */}
      {renaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setRenameValue(preset.name);
              setRenaming(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-xs text-ink focus:outline-none border-b border-focusAccent py-0.5"
        />
      ) : (
        <button
          type="button"
          onClick={() => onApply(preset.id)}
          disabled={isApplying}
          title={`Áp dụng: ${preset.name}`}
          className="flex-1 min-w-0 text-left text-xs text-ink truncate hover:text-focusAccent transition-colors disabled:cursor-not-allowed"
        >
          {isApplying ? 'Đang áp dụng…' : preset.name}
        </button>
      )}

      {/* ⋯ dropdown — portaled, see PresetCardMenu above */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title="Tuỳ chọn"
        aria-expanded={menuOpen}
        className={`shrink-0 flex items-center justify-center w-5 h-5 rounded text-inkMuted hover:text-ink hover:bg-panelAlt transition-colors text-sm leading-none ${
          menuOpen ? 'bg-panelAlt text-ink' : ''
        }`}
      >
        ⋯
      </button>

      {menuOpen && (
        <PresetCardMenu anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)}>
          <button
            type="button"
            onClick={startRename}
            className="w-full text-left px-3 py-2 text-xs text-inkMuted hover:text-ink hover:bg-panelAlt"
          >
            ✏ Đổi tên
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOverwrite(preset.id, preset.name);
            }}
            className="w-full text-left px-3 py-2 text-xs text-inkMuted hover:text-ink hover:bg-panelAlt"
          >
            💾 Lưu đè
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete(preset.id, preset.name);
            }}
            className="w-full text-left px-3 py-2 text-xs text-live hover:bg-panelAlt border-t border-line"
          >
            🗑 Xoá
          </button>
        </PresetCardMenu>
      )}
    </div>
  );
}

// ── CustomPresetsPanel ──────────────────────────────────────────────────────

export default function CustomPresetsPanel() {
  const { api, buildPresetSnapshot } = useEditorState();
  const [presets, setPresets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const [status, setStatus] = useState(null); // null | { type: 'ok'|'error', msg: string }
  const statusTimer = useRef(null);
  const saveInputRef = useRef(null);

  // ── Load preset metadata list on mount ─────────────────────────────────────
  useEffect(() => {
    api.listCustomPresets?.().then((list) => {
      if (Array.isArray(list)) setPresets(list);
    });
  }, [api]);

  // ── Focus save input when the save form opens ──────────────────────────────
  useEffect(() => {
    if (saving && saveInputRef.current) saveInputRef.current.focus();
  }, [saving]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function flashStatus(type, msg) {
    setStatus({ type, msg });
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 2500);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    const result = await api.saveCustomPreset?.(name, buildPresetSnapshot());
    if (result?.ok) {
      setPresets(result.list);
      setSaveName('');
      setSaving(false);
      flashStatus('ok', `Đã lưu "${name}"`);
    } else {
      flashStatus('error', 'Lưu thất bại');
    }
  }

  async function handleApply(id) {
    if (applyingId) return;
    setApplyingId(id);
    try {
      const result = await api.applyCustomPreset?.(id);
      if (result?.ok) {
        // EditorStateContext's onThemeChanged listener re-syncs every
        // editing buffer (and every panel reading from it) automatically —
        // no manual state update needed here.
        flashStatus('ok', 'Đã áp dụng');
      } else {
        flashStatus('error', 'Áp dụng thất bại');
      }
    } catch {
      flashStatus('error', 'Áp dụng thất bại');
    } finally {
      setApplyingId(null);
    }
  }

  async function handleRename(id, newName) {
    const result = await api.renameCustomPreset?.(id, newName);
    if (result?.ok) {
      setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
      flashStatus('ok', 'Đã đổi tên');
    } else {
      flashStatus('error', 'Đổi tên thất bại');
    }
  }

  async function handleOverwrite(id, name) {
    const result = await api.saveCustomPreset?.(name, buildPresetSnapshot());
    if (result?.ok) {
      setPresets(result.list);
      flashStatus('ok', `Đã lưu đè "${name}"`);
    } else {
      flashStatus('error', 'Lưu thất bại');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Xoá preset "${name}"?`)) return;
    const result = await api.deleteCustomPreset?.(id);
    if (result?.ok) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
      flashStatus('ok', `Đã xoá "${name}"`);
    } else {
      flashStatus('error', 'Xoá thất bại');
    }
  }

  async function handleExport() {
    const result = await api.exportCustomPresets?.();
    if (result?.ok) {
      flashStatus('ok', 'Đã xuất file');
    } else if (!result?.canceled) {
      flashStatus('error', result?.error || 'Xuất thất bại');
    }
  }

  async function handleImport() {
    const result = await api.importCustomPresets?.();
    if (result?.ok) {
      setPresets(result.list);
      const parts = [];
      if (result.added > 0) parts.push(`+${result.added} mới`);
      if (result.overwritten > 0) parts.push(`${result.overwritten} ghi đè`);
      flashStatus('ok', `Đã nhập: ${parts.join(', ')}`);
    } else if (!result?.canceled) {
      const errorMsg = Array.isArray(result?.errors)
        ? result.errors.join('; ')
        : result?.error || 'Nhập thất bại';
      flashStatus('error', errorMsg);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-focusAccent/30 bg-panelAlt/60 p-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-inkMuted font-semibold">
          Custom Presets
        </span>

        <div className="flex items-center gap-2 min-w-0">
          {/* Status flash — same style as ThemeLibraryPanel */}
          {status?.type === 'ok' && (
            <span className="text-[10px] text-connected uppercase tracking-wide truncate">
              ✓ {status.msg}
            </span>
          )}
          {status?.type === 'error' && (
            <span className="text-[10px] text-live uppercase tracking-wide truncate">
              ✗ {status.msg}
            </span>
          )}

          <button
            type="button"
            onClick={() => setSaving((v) => !v)}
            title="Lưu tuỳ chỉnh hiện tại thành preset mới"
            className={`shrink-0 rounded-lg border text-[10px] font-semibold px-2 py-1 transition-colors ${
              saving
                ? 'border-focusAccent bg-focusAccent text-white'
                : 'border-focusAccent/50 bg-focusAccent/10 hover:bg-focusAccent/20 text-focusAccent'
            }`}
          >
            + Lưu
          </button>
        </div>
      </div>

      {/* ── Save form (inline) ── */}
      {saving && (
        <div className="flex gap-1.5">
          <input
            ref={saveInputRef}
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setSaving(false);
                setSaveName('');
              }
            }}
            placeholder="Tên preset…"
            className="flex-1 min-w-0 rounded-lg bg-panel border border-line px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-focusAccent"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="rounded-lg bg-focusAccent hover:bg-focusAccent/90 disabled:opacity-40 text-white text-xs px-2.5 py-1.5 font-medium transition-colors"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => {
              setSaving(false);
              setSaveName('');
            }}
            title="Huỷ"
            className="rounded-lg border border-line bg-panel hover:bg-panelAlt text-inkMuted hover:text-ink text-xs px-2 py-1.5 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Preset list ── */}
      {presets.length === 0 ? (
        <p className="text-[11px] text-inkMuted italic py-1 text-center">
          Chưa có preset nào. Nhấn &quot;+ Lưu&quot; để tạo.
        </p>
      ) : (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              isApplying={applyingId === p.id}
              onApply={handleApply}
              onRename={handleRename}
              onOverwrite={handleOverwrite}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Export / Import ── */}
      <div className="flex gap-1.5 pt-0.5 border-t border-line">
        <button
          type="button"
          onClick={handleExport}
          disabled={presets.length === 0}
          title="Xuất tất cả custom presets ra file JSON"
          className="flex-1 rounded-lg border border-line bg-panel hover:bg-panelAlt disabled:opacity-40 text-inkMuted hover:text-ink text-[10px] py-1.5 transition-colors"
        >
          Xuất JSON
        </button>
        <button
          type="button"
          onClick={handleImport}
          title="Nhập custom presets từ file JSON"
          className="flex-1 rounded-lg border border-line bg-panel hover:bg-panelAlt text-inkMuted hover:text-ink text-[10px] py-1.5 transition-colors"
        >
          Nhập JSON
        </button>
      </div>
    </div>
  );
}
