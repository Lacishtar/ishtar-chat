import { useEffect, useRef, useState } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';

// ── Icons (inline SVG so we have no extra deps) ──────────────────────────────

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 8H1.5A1.5 1.5 0 0 1 0 6.5v-5A1.5 1.5 0 0 1 1.5 0h5A1.5 1.5 0 0 1 8 1.5V2"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 3h10M4 3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 5.5v3M7 5.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 3l.5 7.5h6L9.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Port row ──────────────────────────────────────────────────────────────────

function PortRow({ port, isFirst, onSelect, onDelete, onRename }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(port.name);
  const inputRef = useRef(null);

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(port.overlayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDelete(e) {
    e.stopPropagation();
    onDelete(port.id);
  }

  function startEdit(e) {
    e.stopPropagation();
    setDraftName(port.name);
    setEditing(true);
    // Focus the input on next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitEdit() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== port.name) {
      onRename(port.id, trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div
      role="option"
      aria-selected={port.isSelected}
      onClick={() => !port.isSelected && onSelect(port.id)}
      className={`
        group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer
        transition-colors select-none
        ${port.isSelected
          ? 'bg-focusAccent/15 border border-focusAccent/40'
          : 'hover:bg-panelAlt border border-transparent'}
      `}
    >
      {/* Active dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
          port.isSelected ? 'bg-focusAccent' : 'bg-transparent'
        }`}
      />

      {/* Name / inline edit */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-panelAlt border border-focusAccent/50 rounded px-1.5 py-0.5 text-xs text-ink focus:outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-medium truncate ${
                port.isSelected ? 'text-ink' : 'text-inkMuted'
              }`}
            >
              {port.name}
            </span>
            <span className="text-[10px] text-inkMuted/60 font-mono shrink-0">
              :{port.httpPort}
            </span>
          </div>
        )}

        {/* URL row */}
        {!editing && (
          <p className="text-[10px] text-inkMuted/50 font-mono truncate mt-0.5">
            {port.overlayUrl}
          </p>
        )}
      </div>

      {/* Action buttons — visible on hover or when selected */}
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Rename */}
          <button
            type="button"
            title="Đổi tên"
            onClick={startEdit}
            className="p-1 rounded text-inkMuted hover:text-ink hover:bg-panelAlt transition-colors"
          >
            <IconEdit />
          </button>

          {/* Copy URL */}
          <button
            type="button"
            title={copied ? 'Đã copy!' : 'Copy URL overlay'}
            onClick={handleCopy}
            className={`p-1 rounded transition-colors ${
              copied ? 'text-emerald-400' : 'text-inkMuted hover:text-ink hover:bg-panelAlt'
            }`}
          >
            <IconCopy />
          </button>

          {/* Delete (disabled for first port) */}
          <button
            type="button"
            title={isFirst ? 'Không thể xóa port đầu tiên' : 'Xóa port'}
            disabled={isFirst}
            onClick={handleDelete}
            className="p-1 rounded text-inkMuted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <IconTrash />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create new port form ──────────────────────────────────────────────────────

function CreatePortRow({ portCount, onCreatePort }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  function handleOpen() {
    setName(`Port ${portCount + 1}`);
    setCreating(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  async function handleCreate() {
    const trimmed = name.trim() || `Port ${portCount + 1}`;
    setCreating(false);
    await onCreatePort(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') setCreating(false);
  }

  if (creating) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setCreating(false)}
          placeholder="Tên port…"
          className="flex-1 bg-panelAlt border border-focusAccent/50 rounded px-2 py-1 text-xs text-ink focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
          className="shrink-0 rounded bg-focusAccent text-white text-xs px-2 py-1 font-medium hover:bg-focusAccent/90 transition-colors"
        >
          Tạo
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-inkMuted hover:text-ink
                 hover:bg-panelAlt rounded-lg transition-colors"
    >
      <IconPlus />
      <span>Thêm port mới</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortSelectorDropdown() {
  const { ports, selectedPortId, selectPort, createPort, removePort, renamePort } = useEditorState();

  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = ports.find((p) => p.id === selectedPortId);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // If no ports yet (initial load), show nothing
  if (!ports.length) return null;

  const firstPortId = ports[0]?.id;

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        id="port-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium
          transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focusAccent
          ${open
            ? 'bg-focusAccent/10 border-focusAccent/50 text-ink'
            : 'bg-panelAlt border-line text-inkMuted hover:border-focusAccent/40 hover:text-ink'}
        `}
      >
        {/* Active dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-focusAccent shrink-0" />

        <span className="max-w-[120px] truncate">{selected?.name || 'Port'}</span>
        <span className="text-inkMuted/60 font-mono text-[10px] shrink-0">
          :{selected?.httpPort}
        </span>
        <IconChevron open={open} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Chọn port overlay"
          className={`
            absolute top-full mt-1.5 right-0 z-50 min-w-[280px]
            bg-panel border border-line rounded-xl shadow-panel
            p-1.5 flex flex-col gap-0.5
            animate-[fadeSlideIn_0.12s_ease-out]
          `}
          style={{ transformOrigin: 'top right' }}
        >
          <p className="text-[10px] uppercase tracking-wide text-inkMuted/60 px-3 pt-1 pb-0.5">
            Ports đang chạy
          </p>

          {ports.map((port, idx) => (
            <PortRow
              key={port.id}
              port={{ ...port, isSelected: port.id === selectedPortId }}
              isFirst={idx === 0}
              onSelect={(id) => { selectPort(id); setOpen(false); }}
              onDelete={async (id) => { await removePort(id); }}
              onRename={async (id, name) => { await renamePort(id, name); }}
            />
          ))}

          <div className="mt-1 pt-1 border-t border-line">
            <CreatePortRow
              portCount={ports.length}
              onCreatePort={async (name) => {
                await createPort(name);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
