import { useState } from 'react';
import ColorPicker from './Customize/shared/ColorPicker.jsx';
// Reused as-is from the Customize Inspector so Roles gets the exact same
// collapsible-group chrome (border, disclosure caret, spacing) every other
// Customize panel already uses — no parallel "Roles-only" accordion style.
// We deliberately do NOT pull in useCustomizeState (the hook that normally
// drives AccordionSection in the Inspector): that hook also owns
// search/favorites machinery with no equivalent in Roles, so wiring it in
// would import unrelated behavior along with the shell. A tiny local
// open/close hook (useRoleAccordion below) drives the same component instead.
import AccordionSection from './Customize/Inspector/AccordionSection.jsx';
import { inputClass } from './Customize/shared/fields.jsx';
import { useEditorState } from '../state/EditorStateContext.jsx';

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { id: 'moderator', label: 'Mod', hint: 'Tin nhắn từ người điều hành kênh' },
  { id: 'member', label: 'Hội viên', hint: 'Thành viên có badge kênh' },
  { id: 'superchat', label: 'Super Chat', hint: 'Tin nhắn trả phí / Super Chat' },
];

// Shared across all three roles — Name Font Weight (Appearance) and the
// Bubble shape/Emphasis defaults added on top of the existing color/badge
// fields. null = inherit/no-override, same convention every other field
// here already uses.
const ROLE_EXTRA_DEFAULTS = {
  authorFontWeight: null,
  messageBorderWidth: null,
  textScale: null,
};

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
  ...ROLE_EXTRA_DEFAULTS,
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
  ...ROLE_EXTRA_DEFAULTS,
  // Member Tiers — same model as Super Chat's tier table (SUPERCHAT_TIER_TABLE
  // in shared/chat-message.js), keyed by minMonths instead of minUsd. See
  // shared/role-style-config.js#resolveMemberTier for the resolution logic.
  memberTiers: [],
  // Master on/off switch for Mốc tháng — keeps the tier list intact while
  // toggled off, mirroring Super Chat's own useTierColor toggle.
  memberTiersEnabled: true,
  // Kiểu hiển thị khi gia hạn — layout riêng cho thông báo
  // (membership_milestone), mặc định giống tin nhắn bình thường.
  milestoneLayout: 'bubble',
  // Dòng chữ "đã đồng hành N tháng" — luôn hiện cho sự kiện đăng ký mới /
  // gia hạn / nhận quà tặng hội viên, kể cả khi sự kiện đó không có nội
  // dung tin nhắn. {months} sẽ được thay bằng số tháng thực tế. Phải
  // khớp DEFAULT_MEMBER_MILESTONE_TEXT trong shared/role-style-config.js.
  milestoneText: 'đã hỗ trợ trong {months} tháng qua!!',
  milestoneTextEnabled: true,
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
  ...ROLE_EXTRA_DEFAULTS,
};

const ROLE_DEFAULTS_MAP = {
  moderator: MOD_DEFAULTS,
  member: MEMBER_DEFAULTS,
  superchat: SUPERCHAT_DEFAULTS,
};

// ─── Accordion state (mirrors useCustomizeState's isExpanded/toggleSection,
// scoped to Roles only) ──────────────────────────────────────────────────────
// Same storage-backed pattern the Customize Inspector uses for its own
// AccordionSection state, kept local instead of shared because the two
// panels have no other state in common (see import comment above).

const ROLES_EXPANDED_KEY = 'ovs.roles.expanded';

function loadRolesExpanded() {
  try {
    const raw = window.localStorage?.getItem(ROLES_EXPANDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRolesExpanded(value) {
  try {
    window.localStorage?.setItem(ROLES_EXPANDED_KEY, JSON.stringify(value));
  } catch {
    // Non-fatal — Roles tab still works, it just won't remember which
    // group was open/closed between sessions.
  }
}

function useRoleAccordion() {
  const [expanded, setExpanded] = useState(loadRolesExpanded);

  function isOpen(roleKey, sectionId, defaultOpen = true) {
    const key = `${roleKey}:${sectionId}`;
    return key in expanded ? expanded[key] : defaultOpen;
  }

  function toggle(roleKey, sectionId, defaultOpen = true) {
    setExpanded((prev) => {
      const key = `${roleKey}:${sectionId}`;
      const next = { ...prev, [key]: !(key in prev ? prev[key] : defaultOpen) };
      saveRolesExpanded(next);
      return next;
    });
  }

  return { isOpen, toggle };
}

/** AccordionSection lays its children out in a 2-column grid (right for the
    Customize Inspector's small paired controls). Roles' controls skew wide
    (gradient-capable color pickers, sliders, badge grids), so each group's
    body is handed a single col-span-2 child that switches back to a plain
    stacked column — reusing the accordion's chrome without forcing Roles'
    content into a layout it wasn't designed for. */
function AccordionBody({ children }) {
  return <div className="col-span-2 flex flex-col gap-3 min-w-0">{children}</div>;
}

// ─── Reusable UI helpers ─────────────────────────────────────────────────────

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

function SliderField({ label, min, max, value, onChange, unit = 'px', hint, step = 1, defaultValue }) {
  const isCustom = typeof value === 'number';
  return (
    <Field label={label} hint={hint}>
      <Toggle checked={isCustom} onChange={(v) => onChange(v ? (defaultValue ?? min) : null)}>
        Đặt giá trị riêng
      </Toggle>
      {isCustom && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
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

/** Generic segmented button control — same visual pattern Super Chat's
    "Độ đậm số tiền" / "Kiểu hiển thị" pickers already use (active = filled
    focusAccent pill), pulled out here so Name Font Weight and Glow don't
    each hand-roll their own copy of that button row. `value` matches an
    option's `value` exactly; passing `null`/`undefined` matches nothing
    (every caller here treats that as "off"/"unset" and supplies its own
    fallback option value, e.g. 'off' or a specific weight). */
function ButtonGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors border ${
            value === opt.value
              ? 'bg-focusAccent text-white border-focusAccent'
              : 'bg-panelAlt border-line text-inkMuted hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Name Font Weight — same three options/values as Super Chat's existing
// amountFontWeight (WEIGHT_OPTIONS below), reused here for authorFontWeight
// so every role's Name uses the same weight vocabulary the amount already does.
const NAME_WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Thường' },
  { value: 'bold', label: 'Đậm' },
  { value: 'extrabold', label: 'Rất đậm' },
];

/** Appearance additions shared by all three roles: Name → Font Weight.
    (Bubble → Border/Opacity controls removed; Background Color and
    Border Color are still the existing messageBg/messageBorderColor
    ColorFields around this component's call site — not duplicated here.) */
function ExtraAppearanceFields({ role, set }) {
  return (
    <>
      <Field label="Độ đậm tên (Font Weight)">
        <ButtonGroup
          options={NAME_WEIGHT_OPTIONS}
          value={role.authorFontWeight || 'normal'}
          onChange={(v) => set({ authorFontWeight: v === 'normal' ? null : v })}
        />
      </Field>

      <SliderField
        label="Phóng to chữ"
        min={0.8}
        max={2}
        step={0.05}
        unit="x"
        value={role.textScale}
        onChange={(v) => set({ textScale: v })}
        defaultValue={1.15}
        hint="Chỉ phóng to chữ (tên & nội dung), không đổi font."
      />
    </>
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
  ...ROLE_EXTRA_DEFAULTS,
  memberTiers: [],
  memberTiersEnabled: true,
  milestoneLayout: 'bubble',
  milestoneText: 'đã hỗ trợ trong {months} tháng qua!!',
  milestoneTextEnabled: true,
};

function mergeLocalRole(roleStyleConfig, roleKey) {
  return {
    ...EMPTY_ROLE,
    ...(roleStyleConfig?.roles?.[roleKey] || {}),
  };
}

// ─── MODERATOR EDITOR ────────────────────────────────────────────────────────

function ModeratorEditor({ role, onChange, accordion }) {
  const set = (patch) => onChange('moderator', { ...role, ...patch });
  const enabled = role.enabled !== false;
  const roleKey = 'moderator';
  const sec = (id) => ({
    open: accordion.isOpen(roleKey, id, true),
    onToggle: () => accordion.toggle(roleKey, id, true),
  });

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
          <AccordionSection id="section-moderator-appearance" title="Hình thức (Appearance)" {...sec('appearance')}>
            <AccordionBody>
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

              <ExtraAppearanceFields role={role} set={set} />

              <SectionDivider label="Badge & chữ" />
              <BadgeFields
                badgeBefore={role.badgeBefore}
                badgeAfter={role.badgeAfter}
                onChange={set}
              />
            </AccordionBody>
          </AccordionSection>

          <button
            type="button"
            onClick={() => set({ ...MOD_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left mt-1"
          >
            Đặt lại về mặc định
          </button>
        </>
      )}
    </div>
  );
}

// ─── MEMBER TIER EDITOR ("Mốc tháng") ──────────────────────────────────────
// Reuses the same building blocks (Field, ColorField, inputClass, Toggle)
// the Super Chat tab's controls are built from — Super Chat's own tier
// table (SUPERCHAT_TIER_TABLE) is a fixed constant with no editor UI of its
// own (only the read-only TierColorPreview above), so there's no existing
// editable tier-list component to import; this is that same editable-list
// pattern, applied to shared/role-style-config.js's memberTiers instead of
// duplicating a second, unrelated list-editing approach.

function generateMemberTierId() {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function MemberTierRow({ tier, onChange, onRemove }) {
  return (
    <div className="rounded-lg bg-panelAlt border border-line p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Field label="Số tháng tối thiểu" hint="Áp dụng cho hội viên gắn bó từ mốc này trở lên">
            <input
              type="number"
              min={0}
              step={1}
              value={tier.minMonths ?? 0}
              onChange={(e) => onChange({ minMonths: Math.max(0, Number(e.target.value) || 0) })}
              className={inputClass}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 mt-5 text-xs text-red-400 hover:text-red-300 underline"
        >
          Xoá
        </button>
      </div>

      <ColorField
        label="Màu tier"
        value={tier.color}
        onChange={(v) => onChange({ color: v })}
        allowGradient={false}
        hint="Áp dụng cho màu tên và viền bubble khi hội viên đạt mốc này."
      />

      <Field label="Badge" hint="Để trống = không hiện">
        <input
          type="text"
          value={tier.badge ?? ''}
          placeholder="★, 💎, VIP…"
          onChange={(e) => onChange({ badge: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>
    </div>
  );
}

function MemberTierEditor({ tiers, onChange, disabled }) {
  const list = Array.isArray(tiers) ? tiers : [];
  // Highest mốc first — same display order Super Chat's TierColorPreview
  // uses (highest tier at top), and the order shared/role-style-config.js's
  // normalizeMemberTiers()/resolveMemberTier() sort into anyway.
  const sorted = [...list].sort((a, b) => (b.minMonths || 0) - (a.minMonths || 0));

  const updateTier = (id, patch) => {
    onChange(list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTier = (id) => {
    onChange(list.filter((t) => t.id !== id));
  };
  const addTier = () => {
    onChange([
      ...list,
      { id: generateMemberTierId(), minMonths: 1, color: '#93c5fd', badge: '★' },
    ]);
  };

  return (
    <div className={`flex flex-col gap-2 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      {sorted.length === 0 ? (
        <div className="rounded-lg bg-panelAlt border border-line px-3 py-2">
          <span className="text-[10px] text-inkMuted/80 leading-snug">
            Chưa có mốc tháng nào — mọi hội viên dùng chung màu/badge ở phần Màu sắc/Badge bên trên.
          </span>
        </div>
      ) : (
        sorted.map((tier) => (
          <MemberTierRow
            key={tier.id}
            tier={tier}
            onChange={(patch) => updateTier(tier.id, patch)}
            onRemove={() => removeTier(tier.id)}
          />
        ))
      )}
      <button
        type="button"
        onClick={addTier}
        className="w-full rounded-lg border border-dashed border-focusAccent/50 py-2 text-xs text-focusAccent hover:bg-focusAccent/10 transition-colors"
      >
        + Thêm mốc tháng
      </button>
    </div>
  );
}

// NOTE: Membership Event Emphasis (per-event color/badge/glow for Hội viên
// mới / Gia hạn / Tặng quà / Nhận quà) has been removed entirely — event
// detection wasn't reliable and the feature had no dashboard UI, so those
// messages now just inherit the Hội viên role's own Appearance + Mốc tháng
// styling above. shared/role-style-config.js no longer has a memberEvents
// concept at all (removed, not just hidden) — configs saved before this
// change that still carry a memberEvents block simply have it ignored.

// ─── MEMBER EDITOR ───────────────────────────────────────────────────────────

// Same two options as Super Chat's LAYOUT_OPTIONS (below) — kept as its
// own constant (not shared) because the copy is milestone-specific, but
// the value set is identical: 'bubble' (default) or 'youtube'.
const MILESTONE_LAYOUT_OPTIONS = [
  {
    value: 'bubble',
    label: 'Bubble thường',
    desc: 'Giống tin nhắn hội viên bình thường, không có gì đặc biệt',
  },
  {
    value: 'highlight',
    label: '✨ Bubble nổi bật',
    desc: 'Vẫn là bubble bình thường nhưng viền phát sáng, có bóng đổ rực và hơi phóng to + nhấp nháy nhẹ — nổi bật giữa dòng chat mà không đổi hẳn sang layout khác',
  },
  {
    value: 'youtube',
    label: 'Kiểu YouTube',
    desc: 'Card 2 tầng nổi bật: avatar + tên + số tháng trên nền màu Mốc tháng, tin nhắn bên dưới',
  },
];

function MemberEditor({ role, onChange, accordion }) {
  const set = (patch) => onChange('member', { ...role, ...patch });
  const enabled = role.enabled !== false;
  const roleKey = 'member';
  const sec = (id) => ({
    open: accordion.isOpen(roleKey, id, true),
    onToggle: () => accordion.toggle(roleKey, id, true),
  });

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
          <AccordionSection id="section-member-appearance" title="Hình thức (Appearance)" {...sec('appearance')}>
            <AccordionBody>
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

              <ExtraAppearanceFields role={role} set={set} />

              <SectionDivider label="Badge & chữ" />
              <BadgeFields
                badgeBefore={role.badgeBefore}
                badgeAfter={role.badgeAfter}
                onChange={set}
              />
            </AccordionBody>
          </AccordionSection>

          <AccordionSection id="section-member-tiers" title="🏆 Mốc tháng" {...sec('tiers')}>
            <AccordionBody>
              {/* ── Mốc tháng (Member Tiers) ──
                  Cùng kiến trúc với Super Chat Tier: mỗi mốc gồm Minimum
                  Months, Color, Badge — mốc cao nhất mà hội viên đạt được
                  sẽ được áp dụng, giống cách Super Chat chọn tier theo số
                  tiền.

                  Sự kiện Hội viên (thông báo riêng cho Hội viên mới / Gia
                  hạn / Tặng quà / Nhận quà) đã được bỏ khỏi giao diện: việc
                  bắt sự kiện trước đây không ổn định, nên hội viên chat và
                  các thông báo membership giờ dùng chung style của vai trò
                  Hội viên ở trên (Hình thức + Mốc tháng) thay vì một bộ
                  cấu hình riêng — NGOẠI TRỪ Banner gia hạn bên dưới, dùng
                  riêng cho membership_milestone. */}
              <Toggle
                checked={role.memberTiersEnabled !== false}
                onChange={(v) => set({ memberTiersEnabled: v })}
              >
                Bật Mốc tháng
              </Toggle>
              <span className="text-[10px] text-inkMuted/70 leading-snug">
                Đổi màu & badge riêng theo số tháng hội viên đã gắn bó — mốc cao nhất mà họ đạt được sẽ được dùng, giống cách Super Chat đổi màu theo tier số tiền. Tắt tạm thời sẽ giữ nguyên danh sách mốc đã tạo, hội viên sẽ dùng chung màu/badge ở phần Hình thức bên trên.
              </span>
              <MemberTierEditor
                tiers={role.memberTiers}
                onChange={(memberTiers) => set({ memberTiers })}
                disabled={role.memberTiersEnabled === false}
              />

              <SectionDivider label="Thông báo gia hạn" />
              <Field label="Kiểu hiển thị khi gia hạn">
                <div className="flex flex-col gap-2">
                  {MILESTONE_LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set({ milestoneLayout: opt.value })}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors border ${
                        (role.milestoneLayout || 'bubble') === opt.value
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
              <span className="text-[10px] text-inkMuted/70 leading-snug">
                Khi hội viên gia hạn (thông báo "đã gắn bó N tháng"), tin nhắn sẽ dùng kiểu hiển thị này — với màu lấy theo Mốc tháng ở trên (mốc mà họ vừa đạt được).
              </span>

              <SectionDivider label="Dòng chữ số tháng" />
              <Toggle
                checked={role.milestoneTextEnabled !== false}
                onChange={(v) => set({ milestoneTextEnabled: v })}
              >
                Luôn hiện dòng chữ số tháng
              </Toggle>
              <span className="text-[10px] text-inkMuted/70 leading-snug">
                Khi hội viên đăng ký mới / gia hạn / nhận quà tặng, dòng chữ này luôn hiện — kể cả khi sự kiện đó không có nội dung tin nhắn gì. Dùng <code>{'{months}'}</code> để chèn số tháng.
              </span>
              <Field label="Nội dung">
                <input
                  type="text"
                  value={role.milestoneText ?? ''}
                  placeholder="đã hỗ trợ trong {months} tháng qua!!"
                  onChange={(e) => set({ milestoneText: e.target.value || null })}
                  className={inputClass}
                  maxLength={80}
                  disabled={role.milestoneTextEnabled === false}
                />
              </Field>
            </AccordionBody>
          </AccordionSection>

          <button
            type="button"
            onClick={() => set({ ...MEMBER_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left mt-1"
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
    value: 'highlight',
    label: '✨ Bubble nổi bật',
    desc: 'Vẫn là bubble bình thường nhưng viền phát sáng, có bóng đổ rực và hơi phóng to + nhấp nháy nhẹ — nổi bật giữa dòng chat mà không đổi hẳn sang layout khác',
  },
  {
    value: 'youtube',
    label: 'Kiểu YouTube',
    desc: 'Card 2 tầng giống hệt Super Chat gốc: avatar + tên + số tiền trên nền màu tier, tin nhắn bên dưới',
  },
];

function SuperchatEditor({ role, onChange, accordion }) {
  const set = (patch) => onChange('superchat', { ...role, ...patch });
  const enabled = role.enabled !== false;
  const useTierColor = role.useTierColor !== false;
  const roleKey = 'superchat';
  const sec = (id) => ({
    open: accordion.isOpen(roleKey, id, true),
    onToggle: () => accordion.toggle(roleKey, id, true),
  });

  return (
    <div className="flex flex-col gap-3">
      <Toggle checked={enabled} onChange={(v) => set({ enabled: v })}>
        Bật kiểu riêng cho Super Chat
      </Toggle>

      {enabled && (
        <>
          <AccordionSection id="section-superchat-appearance" title="Hình thức (Appearance)" {...sec('appearance')}>
            <AccordionBody>
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

          <ExtraAppearanceFields role={role} set={set} />

              <SectionDivider label="Badge & chữ" />
              <BadgeFields
                badgeBefore={role.badgeBefore}
                badgeAfter={role.badgeAfter}
                onChange={set}
              />
            </AccordionBody>
          </AccordionSection>

          <AccordionSection id="section-superchat-emphasis" title="Nhấn mạnh (Emphasis)" {...sec('emphasis')}>
            <AccordionBody>
          {/* ── SECTION: Số tiền ── */}
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

          {/* ── SECTION 3: Layout ── */}
          <SectionDivider label="🎭 Kiểu hiển thị" />

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
            </AccordionBody>
          </AccordionSection>

          <button
            type="button"
            onClick={() => set({ ...SUPERCHAT_DEFAULTS, enabled: true })}
            className="text-xs text-inkMuted/60 hover:text-inkMuted underline text-left mt-1"
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
  const accordion = useRoleAccordion();

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-sm font-semibold">Mod / Hội viên / Super Chat</h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Tùy chỉnh màu sắc, badge, layout riêng cho từng loại tin nhắn đặc biệt.
        </p>
      </div>

      {/* ── Role List ──
          Chọn Vai trò trước — mỗi nút có chấm màu phản ánh màu tên hiện tại
          của vai trò đó (mờ đi nếu vai trò đang tắt), để nhận diện nhanh
          không cần mở từng tab. */}
      <div className="flex gap-1 p-1 rounded-lg bg-panelAlt border border-line">
        {ROLE_TABS.map((t) => {
          const r = mergeLocalRole(local, t.id);
          const dotColor = r.authorColor || ROLE_DEFAULTS_MAP[t.id]?.authorColor || '#9aa0a6';
          const roleEnabled = r.enabled !== false;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              title={t.hint}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-focusAccent text-white shadow-sm'
                  : 'text-inkMuted hover:text-ink hover:bg-line/40'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: dotColor, opacity: roleEnabled ? 1 : 0.35 }}
              />
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-inkMuted/90 -mt-1">{activeTab.hint}</p>

      {/* ── Appearance + Emphasis ── each editor renders exactly these two
          accordion groups so switching roles never reshuffles the layout. */}
      {tab === 'moderator' && (
        <ModeratorEditor role={activeRole} onChange={pushRoleUpdate} accordion={accordion} />
      )}
      {tab === 'member' && (
        <MemberEditor role={activeRole} onChange={pushRoleUpdate} accordion={accordion} />
      )}
      {tab === 'superchat' && (
        <SuperchatEditor role={activeRole} onChange={pushRoleUpdate} accordion={accordion} />
      )}

      {/* ── Live Preview ──
          The overlay preview is already the app's own always-visible middle
          column (see App.jsx → ChatPreview) fed by the same roleLocal state
          this panel writes to via pushRoleUpdate — every change above is
          already live there with no Apply step and no overlay reload. A
          second preview widget in this panel would just be a duplicate of
          that iframe, so this is a pointer to it rather than a new one. */}
      <div className="rounded-lg bg-panelAlt border border-line px-3 py-2 flex items-center gap-2">
        <span className="text-sm">👁</span>
        <span className="text-[11px] text-inkMuted/80 leading-snug">
          Thay đổi ở trên cập nhật ngay trong khung <strong className="text-inkMuted">Xem trước trực tiếp</strong> (giữa màn hình) — không cần Apply, không cần reload overlay.
        </span>
      </div>
    </section>
  );
}
