import { useEffect, useRef, useState } from 'react';

const ROLE_TABS = [
  { id: 'moderator', label: 'Mod', hint: 'Tin nhắn từ người điều hành' },
  { id: 'member', label: 'Hội viên', hint: 'Thành viên kênh (member badge)' },
  { id: 'superchat', label: 'Super Chat', hint: 'Tin nhắn trả phí / Super Chat' },
];

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-inkMuted/80 leading-snug">{hint}</span> : null}
    </label>
  );
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\)/i;

// Một số giá trị mặc định (vd. nền moderator/superchat) là CSS gradient/rgba,
// không phải hex thuần. <input type="color"> chỉ hiểu hex, nên trước đây nó
// luôn rơi về màu tối mặc định (#16191f) dù giá trị thật vẫn được áp dụng
// đúng lên overlay — nhìn như "lỗi hiển thị" dù vẫn hoạt động.
// Hàm này rút ra một màu hex gần đúng để ô color-picker hiển thị đúng tinh thần màu.
function toPreviewHex(value) {
  if (!value) return '#16191f';
  if (HEX_RE.test(value)) return value;
  const match = RGBA_RE.exec(value);
  if (match) {
    const [, r, g, b] = match;
    return `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
  }
  return '#16191f';
}

function ColorField({ label, value, onChange }) {
  const isPlainHex = !!value && HEX_RE.test(value);
  const previewHex = toPreviewHex(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-full rounded-lg border border-line bg-panelAlt cursor-pointer"
          value={previewHex}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-xs text-inkMuted whitespace-nowrap">
          {!value ? 'Mặc định' : isPlainHex ? value : 'Gradient (xem trước gần đúng)'}
        </span>
      </div>
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
        label="Màu chữ chat"
        value={role.messageTextColor}
        onChange={(v) => set({ messageTextColor: v })}
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

const DEFAULT_ROLES = {
  moderator: {
    enabled: true,
    authorColor: '#fca5a5',
    authorBg: null,
    messageBg: '#f87171',
    messageTextColor: '#ffffff',
    badgeBefore: 'MOD',
    badgeAfter: null,
    showAmount: null,
  },
  member: {
    enabled: true,
    authorColor: '#93c5fd',
    authorBg: null,
    messageBg: '#60a5fa',
    messageTextColor: '#ffffff',
    badgeBefore: '★',
    badgeAfter: null,
    showAmount: null,
  },
  superchat: {
    enabled: true,
    authorColor: '#fde047',
    authorBg: null,
    messageBg: '#facc15',
    messageTextColor: '#1f2937',
    badgeBefore: '✦',
    badgeAfter: null,
    showAmount: true,
  },
};

function mergeLocalRole(roleStyleConfig, roleKey) {
  return {
    ...DEFAULT_ROLES[roleKey],
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
