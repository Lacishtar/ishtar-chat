import { useEffect, useRef, useState } from 'react';
import ColorPicker from './Customize/shared/ColorPicker.jsx';

const ROLE_TABS = [
  { id: 'moderator', label: 'Mod', hint: 'Tin nhắn từ người điều hành' },
  { id: 'member', label: 'Hội viên', hint: 'Thành viên kênh (member badge)' },
  { id: 'superchat', label: 'Super Chat', hint: 'Tin nhắn trả phí / Super Chat' },
];

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children, hint }) {
  // Same fix as shared/fields.jsx: plain wrapper, not <label>. This Field
  // wraps multi-control children (ColorPicker's tab buttons + inputs), and
  // an unassociated <label> auto-forwards a phantom click to whichever
  // labelable descendant is currently first in DOM order — which changes
  // mid-click when ColorPicker switches between solid/gradient modes.
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-inkMuted/80 leading-snug">{hint}</span> : null}
    </div>
  );
}

function ColorField({ label, value, onChange, hint, allowGradient = true }) {
  return (
    <Field
      label={label}
      hint={value ? hint : [hint, 'Chưa đặt — đang dùng màu mặc định.'].filter(Boolean).join(' ')}
    >
      <ColorPicker
        value={value ?? 'rgba(22, 25, 31, 0)'}
        onChange={onChange}
        allowGradient={allowGradient}
      />
    </Field>
  );
}

function RoleEditor({ roleKey, role, onChange }) {
  const set = (patch) => onChange(roleKey, { ...role, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={role.enabled !== false}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="accent-focusAccent"
        />
        Bật kiểu riêng cho vai trò này
      </label>

      <ColorField
        label="Màu tên"
        value={role.authorColor}
        placeholder="#fca5a5"
        onChange={(v) => set({ authorColor: v })}
        allowGradient={false}
      />
      <ColorField
        label="Nền bubble tên"
        value={role.authorBg}
        onChange={(v) => set({ authorBg: v })}
      />
      <ColorField
        label="Nền bubble chat"
        value={role.messageBg}
        onChange={(v) => set({ messageBg: v })}
      />
      <ColorField
        label="Màu tai thỏ"
        value={role.earColor}
        onChange={(v) => set({ earColor: v })}
        hint="Đặt riêng cho tai — nếu để Mặc định, tai sẽ theo Nền bubble chat (hoặc màu bubble gốc nếu Nền bubble chat cũng để Mặc định)."
      />

      <ColorField
        label="Màu chữ chat"
        value={role.messageTextColor}
        onChange={(v) => set({ messageTextColor: v })}
        allowGradient={false}
      />

      <Field label="Badge trước tên" hint="Để trống = không hiện badge trước tên">
        <input
          type="text"
          value={role.badgeBefore ?? ''}
          placeholder="MOD, ★, ✦..."
          onChange={(e) => set({ badgeBefore: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>

      <Field label="Badge sau tên" hint="Để trống = không hiện badge sau tên">
        <input
          type="text"
          value={role.badgeAfter ?? ''}
          placeholder="MOD, ★, ✦..."
          onChange={(e) => set({ badgeAfter: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>

      {roleKey === 'superchat' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={role.showAmount !== false}
            onChange={(e) => set({ showAmount: e.target.checked })}
            className="accent-focusAccent"
          />
          Hiện số tiền Super Chat cạnh tên
        </label>
      ) : null}
    </div>
  );
}

// NOTE: the *real* defaults (colors, gradients, badges) live in exactly one
// place — shared/role-style-config.js (DEFAULT_ROLE_STYLE_CONFIG), which the
// main process normalizes and pushes down via `roleStyleConfig` on mount.
// This used to be duplicated here as a second, hand-maintained copy — which
// had drifted out of sync (e.g. moderator/superchat `messageBg` were solid
// colors here but gradients on the backend). That mismatch was harmless
// once real data arrived, but meant the panel briefly rendered wrong values
// (and made bugs like "gradient doesn't stick" harder to reason about).
// This is now just a blank shape for the split-second before the backend's
// config lands — never a stand-in with fake preset values.
const EMPTY_ROLE = {
  enabled: true,
  authorColor: null,
  authorBg: null,
  messageBg: null,
  earColor: null,
  messageTextColor: null,
  badgeBefore: null,
  badgeAfter: null,
  showAmount: null,
};

function mergeLocalRole(roleStyleConfig, roleKey) {
  return {
    ...EMPTY_ROLE,
    ...(roleStyleConfig?.roles?.[roleKey] || {}),
  };
}

export default function RoleStylesPanel({ api, roleStyleConfig }) {
  const [tab, setTab] = useState('moderator');
  const [local, setLocal] = useState(roleStyleConfig || { roles: {} });
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocal(roleStyleConfig || { roles: {} });
  }, [roleStyleConfig]);

  function pushRoleUpdate(roleKey, nextRole) {
    const roles = {
      ...(local.roles || {}),
      [roleKey]: nextRole,
    };
    const next = { roles };
    setLocal(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.updateRoleStyleConfig({ roles: { [roleKey]: nextRole } });
    }, 120);
  }

  const activeTab = ROLE_TABS.find((t) => t.id === tab) || ROLE_TABS[0];
  const activeRole = mergeLocalRole(local, tab);

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-sm font-semibold">Mod / Hội viên / Super Chat</h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Tùy chỉnh màu sắc, badge và bubble riêng cho từng loại tin nhắn.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-panelAlt border border-line">
        {ROLE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-focusAccent text-white shadow-sm'
                : 'text-inkMuted hover:text-ink hover:bg-line/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-inkMuted/90 -mt-1">{activeTab.hint}</p>

      <RoleEditor roleKey={tab} role={activeRole} onChange={pushRoleUpdate} />
    </section>
  );
}
