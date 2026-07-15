import { useEffect, useRef, useState } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';
import { Field, inputClass, EnableToggle } from './Customize/shared/fields.jsx';
import { MASK_TARGETS, VISIBILITY_ROLES, STACK_LAYERS } from '../../../shared/decoration-config.js';

const ANCHOR_OPTIONS = [
  { value: 'bubble', label: 'Khung chat (bubble)' },
  { value: 'message', label: 'Chỉ vùng chữ' },
  { value: 'author', label: 'Tên người gửi' },
  { value: 'row', label: 'Toàn dòng chat' },
  { value: 'body', label: 'Thân tin nhắn (tên + chữ)' },
  { value: 'avatar', label: 'Avatar' },
];

const PLACEMENT_OPTIONS = [
  { value: 'bottom-left', label: 'Góc dưới bên trái (Bottom Left)' },
  { value: 'bottom-right', label: 'Góc dưới bên phải (Bottom Right)' },
  { value: 'top-left', label: 'Góc trên bên trái (Top Left)' },
  { value: 'top-right', label: 'Góc trên bên phải (Top Right)' },
  { value: 'bottom-center', label: 'Cạnh dưới ở giữa (Bottom Center)' },
  { value: 'top-center', label: 'Cạnh trên ở giữa (Top Center)' },
  { value: 'center-left', label: 'Cạnh trái ở giữa (Center Left)' },
  { value: 'center-right', label: 'Cạnh phải ở giữa (Center Right)' },
  { value: 'center', label: 'Chính giữa (Center)' },
  { value: 'custom', label: 'Tùy chỉnh tự do (Custom X/Y)' },
];

// Vietnamese labels for shared/decoration-config.js#MASK_TARGETS. 'avatar',
// 'bubble', 'username', and 'chatContainer' are wired to real shape sources;
// the rest are reserved so the UI already reads naturally once those targets
// are implemented. The *set* of values always comes from MASK_TARGETS itself
// (imported above), so this can only add a missing label, never drift on values.
const MASK_TARGET_LABELS = {
  avatar: 'Avatar',
  bubble: 'Bubble (khung chat)',
  username: 'Username (bubble tên)',
  chatContainer: 'Chat Message (bubble nội dung)',
  bottomAccentBar: 'Thanh nhấn dưới (Bottom Accent Bar, sắp có)',
  glowLayer: 'Lớp phát sáng (Glow Layer, sắp có)',
  customShape: 'Hình tuỳ chỉnh (Custom Shape, sắp có)',
};
const MASK_TARGET_OPTIONS = MASK_TARGETS.map((value) => ({
  value,
  label: MASK_TARGET_LABELS[value] || value,
}));

const MASK_MODE_OPTIONS = [
  { value: 'clipInside', label: 'Clip Inside — chỉ giữ phần trong shape' },
  { value: 'clipOutside', label: 'Clip Outside — shape khoét một lỗ' },
  { value: 'none', label: 'None — hiển thị bình thường' },
];

const STACK_LAYER_OPTIONS = [
  { value: 'foreground', label: 'Tiền cảnh — trên chữ' },
  { value: 'background', label: 'Hậu cảnh — trong bubble, dưới chữ' },
];

const ANCHOR_LABEL = Object.fromEntries(ANCHOR_OPTIONS.map((o) => [o.value, o.label]));
const PLACEMENT_LABEL = Object.fromEntries(
  PLACEMENT_OPTIONS.map((o) => [o.value, o.label.replace(/\s*\(.*\)$/, '')]),
);

function createLayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `deco-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createDefaultLayer() {
  return {
    id: createLayerId(),
    enabled: true,
    imageUrl: '',
    anchor: 'bubble',
    placement: 'bottom-left',
    translateX: -6,
    translateY: 6,
    rotate: 0,
    zIndex: 5,
    width: 48,
    height: 48,
    opacity: 1,
    // Mask defaults — kept in sync with shared/decoration-config.js#DEFAULT_MASK.
    maskEnabled: false,
    maskTarget: 'avatar',
    maskMode: 'clipInside',
    maskPadding: 0,
    maskFeather: 0,
    maskInvert: false,
    // Visibility condition defaults.
    visibilityRoles: [],
    memberMonthsMin: 0,
    // Stack layer default — kept in sync with shared/decoration-config.js#DEFAULT_LAYER.
    stackLayer: 'foreground',
  };
}

/**
 * A range slider paired with a small editable number input, so precise
 * values can be typed directly instead of hunting for them on the slider.
 * Both controls stay in sync and share the same onChange.
 */
function RangeField({ label, value, min, max, step = 1, unit = '', onChange }) {
  const commit = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-inkMuted">{label}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => commit(e.target.value)}
            className="w-14 rounded-md bg-panelAlt border border-line px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-focusAccent"
          />
          {unit ? <span className="text-[10px] text-inkMuted">{unit}</span> : null}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => commit(e.target.value)}
        className="w-full accent-focusAccent"
      />
    </div>
  );
}

function Thumbnail({ imageUrl }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <div className="h-9 w-9 shrink-0 rounded-md border border-line bg-panel flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-inkMuted" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M21 15l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="h-9 w-9 shrink-0 rounded-md border border-line bg-panel flex items-center justify-center overflow-hidden">
      <img
        src={imageUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** Icon-only button used for header actions (move, duplicate, delete, chevron). */
function IconButton({ title, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 w-7 shrink-0 flex items-center justify-center rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? 'border-line text-live hover:bg-live/10 hover:border-live/60'
          : 'border-line text-inkMuted hover:text-ink hover:bg-panel'
      }`}
    >
      {children}
    </button>
  );
}

/** Two-step delete: first click arms it, second click (within a few seconds) confirms. */
function DeleteLayerButton({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (armed) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          clearTimeout(timerRef.current);
          onConfirm();
        }}
        onBlur={() => setArmed(false)}
        autoFocus
        className="text-[11px] font-semibold text-white bg-live px-2 py-1 rounded-md whitespace-nowrap"
      >
        Xác nhận xóa?
      </button>
    );
  }

  return (
    <IconButton
      title="Xóa lớp"
      danger
      onClick={(e) => {
        e.stopPropagation();
        setArmed(true);
        timerRef.current = setTimeout(() => setArmed(false), 3000);
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 pointer-events-none" fill="none">
        <path
          d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0h10l-.7 12.1A2 2 0 0114.3 21H9.7a2 2 0 01-2-1.9L7 7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconButton>
  );
}

// Human-readable labels for each visibility role token.
const VISIBILITY_ROLE_LABELS = {
  moderator: 'Mod',
  member: 'Member / Thành viên',
  chat: 'Chat thường (không role)',
};

/**
 * Visibility condition controls for a single decoration layer.
 *
 * Checkboxes → OR logic: lớp hiện khi người gửi khớp BẤT KỲ token nào được chọn.
 * Không chọn gì → hiện với tất cả.
 * Khi 'member' được chọn → hiện thêm slider số tháng tối thiểu.
 */
function VisibilitySection({ layer, set }) {
  const roles = Array.isArray(layer.visibilityRoles) ? layer.visibilityRoles : [];
  const memberMonthsMin = layer.memberMonthsMin ?? 0;
  const memberChecked = roles.includes('member');

  function toggleRole(role) {
    const next = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role];
    // Nếu bỏ chọn 'member' thì reset tháng về 0 cho gọn.
    const patch = { visibilityRoles: next };
    if (role === 'member' && roles.includes('member')) patch.memberMonthsMin = 0;
    set(patch);
  }

  return (
    <div className="rounded-lg border border-line bg-panel/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0 text-inkMuted">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-semibold text-inkMuted">Điều kiện hiển thị</span>
      </div>

      <div className="flex flex-col gap-2.5 px-3 pb-3">
        {/* Role checkboxes */}
        <div className="flex flex-col gap-1.5">
          {VISIBILITY_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
                className="accent-focusAccent w-3.5 h-3.5 shrink-0"
              />
              <span className="text-xs text-ink">{VISIBILITY_ROLE_LABELS[role] || role}</span>
            </label>
          ))}
        </div>

        {roles.length === 0 && (
          <p className="text-[11px] text-inkMuted italic">Hiện với tất cả (không lọc)</p>
        )}

        {/* Member months threshold — only shown when 'member' is checked */}
        {memberChecked && (
          <div className="flex flex-col gap-1 pt-1 border-t border-line/40">
            <RangeField
              label="Số tháng thành viên tối thiểu"
              unit="tháng"
              min={0}
              max={60}
              value={memberMonthsMin}
              onChange={(v) => set({ memberMonthsMin: v })}
            />
            <p className="text-[10px] text-inkMuted leading-relaxed">
              {memberMonthsMin === 0
                ? 'Hiện với tất cả thành viên (bất kể tháng)'
                : `Chỉ hiện với thành viên ≥ ${memberMonthsMin} tháng`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LayerCard({ layer, index, count, open, onToggleOpen, onChange, onRemove, onDuplicate, onMove }) {
  const set = (patch) => onChange(index, { ...layer, ...patch });
  const enabled = layer.enabled !== false;
  const isBackground = layer.stackLayer === 'background';
  const subtitle = `${isBackground ? '🖼 BG · ' : ''}${ANCHOR_LABEL[layer.anchor] || layer.anchor} · ${
    PLACEMENT_LABEL[layer.placement] || layer.placement
  }`;

  return (
    <div className="rounded-xl border border-line bg-panelAlt/40 overflow-hidden">
      {/* Header — always visible; this is what makes a list of many layers scannable.
          Only the thumbnail+title button toggles open/close. The action-button
          cluster is a plain sibling (no ancestor onClick), so there's never any
          stopPropagation/bubbling to fight with when aiming at a small icon. */}
      <div className={`flex items-center gap-2 px-3 py-2 ${!enabled ? 'opacity-50' : ''}`}>
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 min-w-0 flex-1 text-left select-none"
        >
          <Thumbnail imageUrl={layer.imageUrl} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink truncate">Lớp {index + 1}</div>
            <div className="text-[11px] text-inkMuted truncate">{subtitle}</div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <IconButton title="Di chuyển lên" onClick={() => onMove(index, -1)} disabled={index === 0}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 pointer-events-none" fill="none">
              <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
          <IconButton title="Di chuyển xuống" onClick={() => onMove(index, 1)} disabled={index === count - 1}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 pointer-events-none" fill="none">
              <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
          <IconButton title="Nhân bản lớp" onClick={() => onDuplicate(index)}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 pointer-events-none" fill="none">
              <rect x="8" y="8" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 15.5H5a1 1 0 01-1-1V5a1 1 0 011-1h9.5a1 1 0 011 1v.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </IconButton>
          <DeleteLayerButton onConfirm={() => onRemove(index)} />
          <IconButton title={open ? 'Thu gọn' : 'Mở rộng'} onClick={onToggleOpen}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={`h-4 w-4 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3 pt-1 border-t border-line/60">
          <div className="flex items-center justify-between gap-2 pt-2">
            <EnableToggle label="Bật lớp này" checked={enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          </div>

          <Field label="URL ảnh">
            <input
              type="url"
              className={inputClass}
              placeholder="https://i.ibb.co/..."
              value={layer.imageUrl || ''}
              onChange={(e) => set({ imageUrl: e.target.value.trim() })}
            />
          </Field>

          <Field label="Gắn vào">
            <select className={inputClass} value={layer.anchor || 'bubble'} onChange={(e) => set({ anchor: e.target.value })}>
              {ANCHOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lớp hiển thị">
            <div className="flex gap-1">
              {STACK_LAYER_OPTIONS.map((opt) => {
                const active = (layer.stackLayer || 'foreground') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set({ stackLayer: opt.value })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors text-left leading-snug ${
                      active
                        ? 'bg-focusAccent/20 border-focusAccent text-focusAccent'
                        : 'bg-panelAlt border-line text-inkMuted hover:text-ink hover:bg-panel'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {(layer.stackLayer || 'foreground') === 'background' && (
              <p className="mt-1.5 text-[11px] text-inkMuted leading-snug">
                Ảnh nằm <strong className="text-ink">trong bubble</strong>, phía sau chữ. Anchor nên chọn "Khung chat" hoặc "Toàn dòng chat". Ảnh tự clip theo border-radius của bubble.
              </p>
            )}
          </Field>

          <Field label="Vị trí trên khung">
            <select
              className={inputClass}
              value={layer.placement || 'bottom-left'}
              onChange={(e) => set({ placement: e.target.value })}
            >
              {PLACEMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Tinh chỉnh X" unit="px" min={-120} max={120} value={layer.translateX ?? 0} onChange={(v) => set({ translateX: v })} />
            <RangeField label="Tinh chỉnh Y" unit="px" min={-120} max={120} value={layer.translateY ?? 0} onChange={(v) => set({ translateY: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Góc xoay" unit="°" min={-180} max={180} value={layer.rotate ?? 0} onChange={(v) => set({ rotate: v })} />
            <RangeField label="z-index" min={-10} max={100} value={layer.zIndex ?? 2} onChange={(v) => set({ zIndex: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Rộng" unit="px" min={16} max={200} value={layer.width ?? 48} onChange={(v) => set({ width: v })} />
            <RangeField label="Cao" unit="px" min={16} max={200} value={layer.height ?? 48} onChange={(v) => set({ height: v })} />
          </div>

          <RangeField
            label="Độ mờ"
            unit="%"
            min={0}
            max={100}
            value={Math.round((layer.opacity ?? 1) * 100)}
            onChange={(v) => set({ opacity: v / 100 })}
          />

          <MaskSection layer={layer} set={set} />
          <VisibilitySection layer={layer} set={set} />
        </div>
      )}
    </div>
  );
}

/**
 * Mask controls for a single decoration layer. Collapsible on its own so a
 * disabled mask doesn't take up space by default — it starts open only when
 * the layer already has a mask enabled.
 */
function MaskSection({ layer, set }) {
  const maskEnabled = layer.maskEnabled === true;
  const [open, setOpen] = useState(maskEnabled);

  return (
    <div className="rounded-lg border border-line bg-panel/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold text-inkMuted"
        >
          Mask (khuôn cắt)
          <svg viewBox="0 0 20 20" fill="none" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <EnableToggle
          label=""
          checked={maskEnabled}
          onChange={(e) => {
            set({ maskEnabled: e.target.checked });
            if (e.target.checked) setOpen(true);
          }}
        />
      </div>

      {open && (
        <fieldset disabled={!maskEnabled} className="flex flex-col gap-3 px-3 pb-3 disabled:opacity-40">
          <Field label="Đối tượng áp Mask">
            <select className={inputClass} value={layer.maskTarget || 'avatar'} onChange={(e) => set({ maskTarget: e.target.value })}>
              {MASK_TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Chế độ Mask">
            <select className={inputClass} value={layer.maskMode || 'clipInside'} onChange={(e) => set({ maskMode: e.target.value })}>
              {MASK_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <RangeField label="Khoảng đệm" unit="px" min={-100} max={100} value={layer.maskPadding ?? 0} onChange={(v) => set({ maskPadding: v })} />
            <RangeField label="Làm mờ mép" unit="px" min={0} max={100} value={layer.maskFeather ?? 0} onChange={(v) => set({ maskFeather: v })} />
          </div>

          <EnableToggle label="Đảo ngược Mask" checked={layer.maskInvert === true} onChange={(e) => set({ maskInvert: e.target.checked })} />
        </fieldset>
      )}
    </div>
  );
}

export default function DecorationsPanel() {
  // `decorationLocal` is the single authoritative editing buffer, shared
  // with CustomPresetsPanel — no separate local copy here anymore.
  const { decorationLocal, pushDecorationUpdate } = useEditorState();
  const local = decorationLocal || { layers: [] };
  const layers = local.layers || [];

  // Which layer cards are expanded. Kept outside the layer data itself since
  // it's pure UI state, not something that should ever be persisted/pushed.
  const [openIds, setOpenIds] = useState(() => new Set());

  function pushUpdate(nextLayers) {
    pushDecorationUpdate(nextLayers);
  }

  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLayerChange(index, nextLayer) {
    const next = [...layers];
    next[index] = nextLayer;
    pushUpdate(next);
  }

  function handleAddLayer() {
    const layer = createDefaultLayer();
    pushUpdate([...layers, layer]);
    setOpenIds((prev) => new Set(prev).add(layer.id));
  }

  function handleRemoveLayer(index) {
    pushUpdate(layers.filter((_, i) => i !== index));
  }

  function handleDuplicateLayer(index) {
    const clone = { ...layers[index], id: createLayerId() };
    const next = [...layers];
    next.splice(index + 1, 0, clone);
    pushUpdate(next);
    setOpenIds((prev) => new Set(prev).add(clone.id));
  }

  function handleMoveLayer(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    pushUpdate(next);
  }

  function handleExpandAll() {
    setOpenIds(new Set(layers.map((l) => l.id)));
  }

  function handleCollapseAll() {
    setOpenIds(new Set());
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Trang trí ảnh</h2>
        <button
          type="button"
          onClick={handleAddLayer}
          className="text-xs font-semibold text-focusAccent hover:text-focusAccent/80"
        >
          + Thêm lớp
        </button>
      </div>

      <p className="text-xs text-inkMuted leading-relaxed">
        Sticker bám theo từng tin nhắn chat. Chọn &quot;Khung chat&quot; + vị trí góc (vd. cuối trái) rồi tinh chỉnh X/Y.
      </p>

      {layers.length === 0 ? (
        <p className="text-xs text-inkMuted italic py-2">Chưa có lớp trang trí. Nhấn &quot;+ Thêm lớp&quot; để bắt đầu.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 -mb-1">
            <span className="text-[11px] text-inkMuted">{layers.length} lớp</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleExpandAll} className="text-[11px] text-inkMuted hover:text-ink underline-offset-2 hover:underline">
                Mở tất cả
              </button>
              <button type="button" onClick={handleCollapseAll} className="text-[11px] text-inkMuted hover:text-ink underline-offset-2 hover:underline">
                Thu gọn tất cả
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {layers.map((layer, index) => (
              <LayerCard
                key={layer.id || index}
                layer={layer}
                index={index}
                count={layers.length}
                open={openIds.has(layer.id)}
                onToggleOpen={() => toggleOpen(layer.id)}
                onChange={handleLayerChange}
                onRemove={handleRemoveLayer}
                onDuplicate={handleDuplicateLayer}
                onMove={handleMoveLayer}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}