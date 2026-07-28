import { useState } from 'react';
import ColorPicker from './Customize/shared/ColorPicker.jsx';
import { useEditorState } from '../state/EditorStateContext.jsx';

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { id: 'moderator', label: 'Mod', hint: 'Tin nhắn từ người điều hành kênh' },
  { id: 'member', label: 'Hội viên', hint: 'Thành viên có badge kênh' },
  { id: 'superchat', label: 'Super Chat', hint: 'Tin nhắn trả phí / Super Chat' },
];

const MOD_DEFAULTS = {
  enabled: true,
  authorColor: '#fca5a5',
  messageBg: 'linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(22, 25, 31, 0.72))',
  messageBorderColor: 'rgba(248, 113, 113, 0.45)',
  badgeBefore: 'MOD',
  badgeAfter: null,
  earColor: null,
  authorBg: null,
  messageTextColor: null,
  fontSize: null,
};

const MEMBER_DEFAULTS = {
  enabled: true,
  authorColor: '#93c5fd',
  messageBorderColor: 'rgba(96, 165, 250, 0.45)',
  badgeBefore: '★',
  badgeAfter: null,
  earColor: null,
  authorBg: null,
  messageBg: null,
  messageTextColor: null,
  fontSize: null,
};

const SUPERCHAT_DEFAULTS = {
  enabled: true,
  useTierColor: true,
  superchatLayout: 'bubble',
  showAmount: true,
  amountFontSize: null,
  amountFontWeight: 'bold',
  amountPosition: 'inline',
  badgeBefore: '✦',
  badgeAfter: null,
  fontSize: null,
  authorColor: '#fde047',
  messageBg: 'linear-gradient(135deg, rgba(255, 202, 40, 0.28), rgba(22, 25, 31, 0.72))',
  messageBorderColor: 'rgba(255, 202, 40, 0.45)',
};

const ROLE_DEFAULTS_MAP = {
  moderator: MOD_DEFAULTS,
  member: MEMBER_DEFAULTS,
  superchat: SUPERCHAT_DEFAULTS,
};

// ─── Reusable UI helpers ─────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-inkMuted/70">
        {label}
      </span>
      <div className="flex-1 h-px bg-line/60" />
    </div>
  );
}

/** Plain div wrapper — not <label> to avoid phantom-click issues with multi-control children. */
function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-inkMuted/70 leading-snug">{hint}</span> : null}
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

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-focusAccent w-4 h-4 rounded"
      />
      {children}
    </label>
  );
}

function SliderField({ label, min, max, value, onChange, unit = 'px', hint }) {
  const isCustom = typeof value === 'number';
  return (
    <Field label={label} hint={hint}>
      <Toggle checked={isCustom} onChange={(v) => onChange(v ? min : null)}>
        Đặt giá trị riêng
      </Toggle>
      {isCustom && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-focusAccent"
          />
          <span className="text-xs text-inkMuted w-12 text-right shrink-0">
            {value}{unit}
          </span>
        </div>
      )}
    </Field>
  );
}

function BadgeFields({ badgeBefore, badgeAfter, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Badge trước tên" hint="Để trống = không hiện">
        <input
          type="text"
          value={badgeBefore ?? ''}
          placeholder="MOD, ★, ✦…"
          onChange={(e) => onChange({ badgeBefore: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>
      <Field label="Badge sau tên" hint="Để trống = không hiện">
        <input
          type="text"
          value={badgeAfter ?? ''}
          placeholder="★, ♥…"
          onChange={(e) => onChange({ badgeAfter: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>
    </div>
  );
}

// ─── Tier color preview ───────────────────────────────────────────────────────

const TIER_TABLE = [
  { tier: 7, label: '≥ $100', color: '#e53935', label2: 'Đỏ' },
  { tier: 6, label: '≥ $50',  color: '#e91e63', label2: 'Hồng' },
  { tier: 5, label: '≥ $20',  color: '#f57c00', label2: 'Cam' },
  { tier: 4, label: '≥ $10',  color: '#ffca28', label2: 'Vàng' },
  { tier: 3, label: '≥ $5',   color: '#0f9d58', label2: 'Xanh lá' },
  { tier: 2, label: '≥ $2',   color: '#00e5ff', label2: 'Xanh lam' },
  { tier: 1, label: '< $2',   color: '#1e88e5', label2: 'Xanh dương' },
];

function TierColorPreview() {
  return (
    <div className="flex flex-col gap-1.5">
      {TIER_TABLE.map((t) => (
        <div key={t.tier} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: t.color, boxShadow: `0 0 6px ${t.color}88` }}
          />
          <span className="text-[11px] text-inkMuted flex-1">{t.label2}</span>
          <span className="text-[10px] text-inkMuted/60">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── EMPTY role shape (before backend data arrives) ───────────────────────────

const EMPTY_ROLE = {
  enabled: false,
  authorColor: null,
  authorBg: null,
  messageBg: null,
  earColor: null,
  messageTextColor: null,
  badgeBefore: null,
  badgeAfter: null,
  showAmount: null,
  fontSize: null,
};

function mergeLocalRole(roleStyleConfig, roleKey) {
  return {
    ...EMPTY_ROLE,
    ...(roleStyleConfig?.roles?.[roleKey] || {}),
  };
}

// ─── MODERATOR EDITOR ────────────────────────────────────────────────────────

function ModeratorEditor({ role, onChange }) {
  const set = (patch) => onChange('moderator', { ...role, ...patch });
  const enabled = role.enabled !== false;

  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={enabled} onChange={(v) => set({ enabled: v })}>
        Bật kiểu riêng cho Moderator
      </Toggle>

      {!enabled && (
        <button
          type="button"
          onClick={() => set(MOD_DEFAULTS)}
          className="w-full rounded-lg border border-dashed border-focusAccent/50 py-2 text-xs text-focusAccent hover:bg-focusAccent/10 transition-colors"
        >
          ✦ Bật và áp dụng màu mặc định
        </button>
      )}

      {enabled && (
        <>
          <SectionDivider label="Màu sắc" />
          <ColorField
            label="Màu tên"
            value={role.authorColor}
            onChange={(v) => set({ authorColor: v })}
            allowGradient={false}
          />
          <ColorField
            label="Nền bubble tên"
            value={role.authorBg}
            onChange={(v) => set({ authorBg: v })}
            hint="Hiển thị pill nền đằng sau tên."
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
            allowGradient={false}
          />
          <ColorField
            label="Màu tai thỏ"
            value={role.earColor}
            onChange={(v) => set({ earColor: v })}
            hint="Nếu để mặc định, tai thỏ sẽ theo màu bubble."
          />

          <SectionDivider label="Badge & chữ" />
          <BadgeFields
            badgeBefore={role.badgeBefore}
            badgeAfter={role.badgeAfter}
            onChange={set}
          />
          <SliderField
            label="Cỡ chữ chat riêng"
            min={10}
            max={32}
            value={role.fontSize}
            onChange={(v) => set({ fontSize: v })}
            hint="Tên và badge sẽ tự co giãn theo tỉ lệ."
          />

          <SectionDivider label="" />
          <button
            type="button"
            onClick={() => set({ ...MOD_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left"
          >
            Đặt lại về mặc định
          </button>
        </>
      )}
    </div>
  );
}

// ─── MEMBER EDITOR ───────────────────────────────────────────────────────────

function MemberEditor({ role, onChange }) {
  const set = (patch) => onChange('member', { ...role, ...patch });
  const enabled = role.enabled !== false;

  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={enabled} onChange={(v) => set({ enabled: v })}>
        Bật kiểu riêng cho Hội viên
      </Toggle>

      {!enabled && (
        <button
          type="button"
          onClick={() => set(MEMBER_DEFAULTS)}
          className="w-full rounded-lg border border-dashed border-focusAccent/50 py-2 text-xs text-focusAccent hover:bg-focusAccent/10 transition-colors"
        >
          ✦ Bật và áp dụng màu mặc định
        </button>
      )}

      {enabled && (
        <>
          <SectionDivider label="Màu sắc" />
          <ColorField
            label="Màu tên"
            value={role.authorColor}
            onChange={(v) => set({ authorColor: v })}
            allowGradient={false}
          />
          <ColorField
            label="Nền bubble tên"
            value={role.authorBg}
            onChange={(v) => set({ authorBg: v })}
            hint="Hiển thị pill nền đằng sau tên."
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
            allowGradient={false}
          />
          <ColorField
            label="Màu tai thỏ"
            value={role.earColor}
            onChange={(v) => set({ earColor: v })}
            hint="Nếu để mặc định, tai thỏ sẽ theo màu bubble."
          />

          <SectionDivider label="Badge & chữ" />
          <BadgeFields
            badgeBefore={role.badgeBefore}
            badgeAfter={role.badgeAfter}
            onChange={set}
          />
          <SliderField
            label="Cỡ chữ chat riêng"
            min={10}
            max={32}
            value={role.fontSize}
            onChange={(v) => set({ fontSize: v })}
            hint="Tên và badge sẽ tự co giãn theo tỉ lệ."
          />

          <SectionDivider label="" />
          <button
            type="button"
            onClick={() => set({ ...MEMBER_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left"
          >
            Đặt lại về mặc định
          </button>
        </>
      )}
    </div>
  );
}

// ─── SUPERCHAT EDITOR ────────────────────────────────────────────────────────

const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Mỏng (400)' },
  { value: 'bold',   label: 'Đậm (700)' },
  { value: 'extrabold', label: 'Rất đậm (900)' },
];

const LAYOUT_OPTIONS = [
  {
    value: 'bubble',
    label: 'Bubble thường',
    desc: 'Giống tin nhắn bình thường, chỉ màu khác theo tier',
  },
  {
    value: 'banner',
    label: 'Banner nổi bật',
    desc: 'Số tiền nổi bật ở trên, tin nhắn bên dưới, viền accent',
  },
  {
    value: 'youtube',
    label: 'Kiểu YouTube',
    desc: 'Card 2 tầng giống hệt Super Chat gốc: avatar + tên + số tiền trên nền màu tier, tin nhắn bên dưới',
  },
];

function SuperchatEditor({ role, onChange }) {
  const set = (patch) => onChange('superchat', { ...role, ...patch });
  const enabled = role.enabled !== false;
  const useTierColor = role.useTierColor !== false;

  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={enabled} onChange={(v) => set({ enabled: v })}>
        Bật kiểu riêng cho Super Chat
      </Toggle>

      {enabled && (
        <>
          {/* ── SECTION 1: Màu theo tier ── */}
          <SectionDivider label="🎨 Màu sắc" />

          <Toggle checked={useTierColor} onChange={(v) => set({ useTierColor: v })}>
            Tự động dùng màu theo tier tiền YouTube
          </Toggle>

          {useTierColor ? (
            <div className="rounded-lg bg-panelAlt border border-line p-3 flex flex-col gap-2">
              <span className="text-[10px] text-inkMuted/80 leading-snug">
                Màu bubble, border và tên sẽ tự động đổi theo tier số tiền YouTube.
              </span>
              <TierColorPreview />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <span className="text-[10px] text-amber-400 leading-snug">
                  ⚠ Đã tắt màu tier — màu bên dưới sẽ áp dụng cho tất cả Super Chat, bất kể số tiền.
                </span>
              </div>
              <ColorField
                label="Màu tên & số tiền"
                value={role.authorColor}
                onChange={(v) => set({ authorColor: v })}
                allowGradient={false}
              />
              <ColorField
                label="Nền bubble chat"
                value={role.messageBg}
                onChange={(v) => set({ messageBg: v })}
              />
              <ColorField
                label="Màu viền bubble"
                value={role.messageBorderColor}
                onChange={(v) => set({ messageBorderColor: v })}
                allowGradient={false}
              />
            </div>
          )}

          <ColorField
            label="Nền bubble tên"
            value={role.authorBg}
            onChange={(v) => set({ authorBg: v })}
            hint="Hiển thị pill nền đằng sau tên (độc lập với màu tier)."
          />
          <ColorField
            label="Màu chữ nội dung"
            value={role.messageTextColor}
            onChange={(v) => set({ messageTextColor: v })}
            allowGradient={false}
            hint="Màu chữ của nội dung tin nhắn (không ảnh hưởng tên/số tiền)."
          />
          <ColorField
            label="Màu tai thỏ"
            value={role.earColor}
            onChange={(v) => set({ earColor: v })}
            hint="Nếu để mặc định, tai thỏ sẽ theo màu bubble."
          />

          {/* ── SECTION 2: Số tiền ── */}
          <SectionDivider label="💰 Số tiền" />

          <Toggle checked={role.showAmount !== false} onChange={(v) => set({ showAmount: v })}>
            Hiện số tiền trên overlay
          </Toggle>

          {role.showAmount !== false && (
            <>
              {role.superchatLayout === 'youtube' ? (
                <div className="rounded-lg bg-panelAlt border border-line px-3 py-2">
                  <span className="text-[10px] text-inkMuted/80 leading-snug">
                    Kiểu YouTube luôn ghim số tiền ở góc phải header, không dùng tùy chọn vị trí bên dưới.
                  </span>
                </div>
              ) : (
                <Field label="Vị trí số tiền">
                  <div className="flex gap-2">
                    {[
                      { value: 'inline', label: '← Cạnh tên' },
                      { value: 'block',  label: '↓ Dòng riêng' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set({ amountPosition: opt.value })}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors border ${
                          (role.amountPosition || 'inline') === opt.value
                            ? 'bg-focusAccent text-white border-focusAccent'
                            : 'bg-panelAlt border-line text-inkMuted hover:text-ink hover:border-line/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <SliderField
                label="Cỡ chữ số tiền"
                min={10}
                max={36}
                value={role.amountFontSize}
                onChange={(v) => set({ amountFontSize: v })}
                hint="Mặc định tự co giãn theo cỡ chữ chung."
              />

              <Field label="Độ đậm số tiền">
                <div className="flex gap-1.5">
                  {WEIGHT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set({ amountFontWeight: opt.value })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors border ${
                        (role.amountFontWeight || 'bold') === opt.value
                          ? 'bg-focusAccent text-white border-focusAccent'
                          : 'bg-panelAlt border-line text-inkMuted hover:text-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {/* ── SECTION 3: Layout & Badge ── */}
          <SectionDivider label="🎭 Layout & Badge" />

          <Field label="Kiểu hiển thị Super Chat">
            <div className="flex flex-col gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set({ superchatLayout: opt.value })}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors border ${
                    (role.superchatLayout || 'bubble') === opt.value
                      ? 'bg-focusAccent/15 border-focusAccent/60 text-ink'
                      : 'bg-panelAlt border-line text-inkMuted hover:text-ink hover:bg-line/30'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          <BadgeFields
            badgeBefore={role.badgeBefore}
            badgeAfter={role.badgeAfter}
            onChange={set}
          />

          <SliderField
            label="Cỡ chữ tên riêng"
            min={10}
            max={32}
            value={role.fontSize}
            onChange={(v) => set({ fontSize: v })}
            hint="Áp dụng cho tên tác giả. Badge co giãn tỉ lệ theo."
          />

          <SectionDivider label="" />
          <button
            type="button"
            onClick={() => set({ ...SUPERCHAT_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left"
          >
            Đặt lại về mặc định
          </button>
        </>
      )}
    </div>
  );
}

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────

export default function RoleStylesPanel() {
  const [tab, setTab] = useState('moderator');
  const { roleLocal, pushRoleUpdate } = useEditorState();
  const local = roleLocal || { roles: {} };

  const activeTab = ROLE_TABS.find((t) => t.id === tab) || ROLE_TABS[0];
  const activeRole = mergeLocalRole(local, tab);

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-sm font-semibold">Mod / Hội viên / Super Chat</h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Tùy chỉnh màu sắc, badge, layout riêng cho từng loại tin nhắn đặc biệt.
        </p>
      </div>

      {/* Tab bar */}
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

      {tab === 'moderator' && (
        <ModeratorEditor role={activeRole} onChange={pushRoleUpdate} />
      )}
      {tab === 'member' && (
        <MemberEditor role={activeRole} onChange={pushRoleUpdate} />
      )}
      {tab === 'superchat' && (
        <SuperchatEditor role={activeRole} onChange={pushRoleUpdate} />
      )}
    </section>
  );
}
