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
// AccordionBody/SectionDivider used to be defined in this file and were
// imported directly from here by FanServicePanel.jsx. Moved to
// Customize/shared/ so shared chrome doesn't live inside one panel's file —
// re-exported below unchanged so nothing else needed to change.
import { AccordionBody, SectionDivider } from './Customize/shared/accordionParts.jsx';
import { useEditorState } from '../state/EditorStateContext.jsx';

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { id: 'moderator', label: 'Mod', hint: 'Tin nhắn từ người điều hành kênh' },
  { id: 'member', label: 'Hội viên', hint: 'Thành viên có badge kênh' },
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
  earColor: null,
  authorBg: null,
  messageBg: null,
  messageTextColor: null,
  fontSize: null,
  ...ROLE_EXTRA_DEFAULTS,
  // Member Tiers — same model as Super Chat's tier table (SUPERCHAT_TIER_TABLE
  // in shared/chat-message.js), keyed by minMonths instead of minUsd. See
  // shared/role-style-config.js#resolveMemberTier for the resolution logic.
  // This is also the ONLY badge mechanism for members — there is no
  // separate role-level badgeBefore/badgeAfter here the way Moderator still
  // has (see MOD_DEFAULTS below): a member's badge always comes from
  // whichever tier their month count qualifies for, via each tier's own
  // badgeBefore/badgeAfter.
  memberTiers: [],
  // Master on/off switch for Mốc tháng — keeps the tier list intact while
  // toggled off, mirroring Fan Service's own useTierColor toggle for Super
  // Chat (shared/fan-service-config.js).
  memberTiersEnabled: true,
  // "Dùng badge thật" — off by default, hiển thị song song với Mốc tháng
  // khi bật (xem shared/role-style-config.js).
  useRealBadge: false,
  // Tên gói hội viên — hiện đúng nguyên văn nội dung YouTube trả về ở
  // '#header-subtext' (tên tier như "Dead Beat +", hoặc lời chào thành
  // viên mới như "Chào mừng bạn đến với ...!!" khi sự kiện không có
  // header/tin nhắn nào khác). Đây KHÔNG phải template do người dùng gõ —
  // chỉ có nút bật/tắt, không có ô "Nội dung" để chỉnh sửa.
  packageNameEnabled: true,
};

// Super Chat used to have a third entry (SUPERCHAT_DEFAULTS) here — removed
// during the Super Chat -> Fan Service refactor
// (docs/refactor-superchat-to-fanservice.md). Its editor now lives in
// FanServicePanel.jsx (the superchat group's tier-color/badge/amount
// sections), not here — Role is Identity-only now.
const ROLE_DEFAULTS_MAP = {
  moderator: MOD_DEFAULTS,
  member: MEMBER_DEFAULTS,
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

// ─── Reusable UI helpers ─────────────────────────────────────────────────────

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

// Name Font Weight — same three options/values as Fan Service's Super Chat
// "Độ đậm số tiền" picker (WEIGHT_OPTIONS in FanServicePanel.jsx), reused
// here for authorFontWeight so every role's Name uses the same weight
// vocabulary the amount already does.
const NAME_WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Thường' },
  { value: 'bold', label: 'Đậm' },
  { value: 'extrabold', label: 'Rất đậm' },
];

/** Appearance additions shared by both roles: Name → Font Weight.
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
  fontSize: null,
  ...ROLE_EXTRA_DEFAULTS,
  memberTiers: [],
  memberTiersEnabled: true,
  useRealBadge: false,
  packageNameEnabled: true,
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
// this file already has for Moderator/Member. Super Chat's own tier table
// (SUPERCHAT_TIER_TABLE) is a fixed constant with no editor UI of its own
// (only the read-only TierColorPreview, which now lives in
// FanServicePanel.jsx along with the rest of Super Chat's editor — see
// docs/refactor-superchat-to-fanservice.md), so there was no existing
// editable tier-list component to import; this is a from-scratch editable-
// list pattern, applied to shared/role-style-config.js's memberTiers.

function generateMemberTierId() {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Badge fields for a single Mốc tháng tier — unlike the role-level
// BadgeFields above (short emoji/text only, maxLength 8), a tier badge can
// also be an image URL (see shared/role-style-config.js#quoteCssContent,
// which auto-detects an http(s) value and renders it as an image instead
// of text), so the input needs enough room for a real URL and copy that
// says so.
function TierBadgeFields({ badgeBefore, badgeAfter, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Badge trước tên" hint="Chữ/emoji hoặc URL ảnh (https://…). Để trống = không hiện">
        <input
          type="text"
          value={badgeBefore ?? ''}
          placeholder="★, VIP, https://…"
          onChange={(e) => onChange({ badgeBefore: e.target.value || null })}
          className={inputClass}
          maxLength={500}
        />
      </Field>
      <Field label="Badge sau tên" hint="Chữ/emoji hoặc URL ảnh (https://…). Để trống = không hiện">
        <input
          type="text"
          value={badgeAfter ?? ''}
          placeholder="♥, https://…"
          onChange={(e) => onChange({ badgeAfter: e.target.value || null })}
          className={inputClass}
          maxLength={500}
        />
      </Field>
    </div>
  );
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

      <TierBadgeFields
        badgeBefore={tier.badgeBefore}
        badgeAfter={tier.badgeAfter}
        onChange={onChange}
      />
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
      { id: generateMemberTierId(), minMonths: 1, color: '#93c5fd', badgeBefore: '★', badgeAfter: null },
    ]);
  };

  return (
    <div className={`flex flex-col gap-2 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      {sorted.length === 0 ? (
        <div className="rounded-lg bg-panelAlt border border-line px-3 py-2">
          <span className="text-[10px] text-inkMuted/80 leading-snug">
            Chưa có mốc tháng nào — mọi hội viên dùng chung màu ở phần Màu sắc bên trên và không có badge.
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
            </AccordionBody>
          </AccordionSection>

          <AccordionSection id="section-member-tiers" title="🏆 Mốc tháng" {...sec('tiers')}>
            <AccordionBody>
              {/* ── Mốc tháng (Member Tiers) ──
                  Cùng kiến trúc với Super Chat Tier: mỗi mốc gồm Minimum
                  Months, Color, Badge — mốc cao nhất mà hội viên đạt được
                  sẽ được áp dụng, giống cách Super Chat chọn tier theo số
                  tiền. Cũng là nguồn màu cho tin nhắn gia hạn/tặng Hội
                  viên (xem message-renderer.js/role-styles.css).

                  "Kiểu hiển thị khi gia hạn / tặng Hội viên" (layout
                  bubble/highlight/card riêng cho membership_milestone +
                  membership_gift_sent + membership_new) đã được gỡ bỏ hoàn
                  toàn — field role.milestoneLayout không còn tồn tại,
                  overlay luôn hiển thị các sự kiện này như một tin nhắn
                  Hội viên bình thường. */}
              <Toggle
                checked={role.memberTiersEnabled !== false}
                onChange={(v) => set({ memberTiersEnabled: v })}
              >
                Bật Mốc tháng
              </Toggle>
              <span className="text-[10px] text-inkMuted/70 leading-snug">
                Đổi màu & badge riêng theo số tháng hội viên đã gắn bó — mốc cao nhất mà họ đạt được sẽ được dùng, giống cách Super Chat đổi màu theo tier số tiền. Tắt tạm thời sẽ giữ nguyên danh sách mốc đã tạo, nhưng hội viên sẽ tạm thời không có badge (chỉ dùng chung màu ở phần Hình thức bên trên) cho đến khi bật lại.
              </span>
              <MemberTierEditor
                tiers={role.memberTiers}
                onChange={(memberTiers) => set({ memberTiers })}
                disabled={role.memberTiersEnabled === false}
              />

              <SectionDivider label="Badge thật YouTube" />
              <Toggle
                checked={role.useRealBadge === true}
                onChange={(v) => set({ useRealBadge: v })}
              >
                Dùng badge thật
              </Toggle>
              <span className="text-[10px] text-inkMuted/70 leading-snug">
                Hiện thêm huy hiệu (icon) hội viên gốc mà YouTube đã cấp cho họ, capture trực tiếp từ khung chat — hiển thị SONG SONG cùng lúc với badge Mốc tháng tự thiết kế ở trên, không thay thế. Nếu YouTube chưa cấp badge cho hội viên đó (mới tham gia, dưới 1 tháng...) thì sẽ không có gì hiện thêm.
              </span>

              <SectionDivider label="Tên gói hội viên" />
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
        <h2 className="font-display text-sm font-semibold">Mod / Hội viên</h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Tùy chỉnh màu sắc, badge, layout riêng cho từng loại tin nhắn đặc biệt. Super Chat giờ nằm ở tab
          Fan Service.
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

// ─── Shared exports ──────────────────────────────────────────────────────────
// Reused as-is by MembershipMilestonePanel.jsx (the standalone "Gia hạn /
// Tặng" tab — see App.jsx) so that tab is built entirely out of the exact
// same building blocks Roles already uses (accordion chrome, Field/
// ColorField/Toggle/SectionDivider, the Mốc tháng tier editor, the
// 'member' role defaults) instead of a second, parallel implementation
// of any of it.
export {
  mergeLocalRole,
  useRoleAccordion,
  Field,
  ColorField,
  Toggle,
  SectionDivider,
  AccordionBody,
  MemberTierEditor,
  MEMBER_DEFAULTS,
};
