// membership events (Hội viên mới / Gia hạn / Tặng hội viên). Two
// turning a group off falls straight back to the normal Bố cục / Vai trò
// Layout note: "💰 Số tiền" is split across two accordion groups — position
// (Vị trí số tiền / Căn lề số tiền) and display style (Kiểu hiển thị số
// tiền) live in "Bố cục" next to the other layout/position fields, while
// size/weight (Cỡ chữ số tiền / Độ đậm số tiền) stay in "Cỡ chữ & màu sắc"
// actually matches. "Cỡ dòng số tháng" (membership) stays in typography
// 🖼️ Hoạ tiết riêng for the same reason.
// "🎨 Màu theo tier" also carries manualBgColor/manualBorderColor now — when
// "🖌️ Bubble riêng" (border/radius/opacity/shadow/glow) used to only render
// with "🖌️ Bubble riêng" now shown for both groups, that made this one of
import { useState } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';
import ColorPicker from './Customize/shared/ColorPicker.jsx';
import BubbleTextureSection from './Customize/Bubble/BubbleTextureSection.jsx';
import ShadowSection from './Customize/Appearance/ShadowSection.jsx';
import GlowSection from './Customize/Appearance/GlowSection.jsx';
import AccordionSection from './Customize/Inspector/AccordionSection.jsx';
import { AccordionBody, SectionDivider } from './Customize/shared/accordionParts.jsx';

// section here never touches the Vai trò tab's own saved state.
const FAN_SERVICE_EXPANDED_KEY = 'ovs.fanService.expanded';

function loadFanServiceExpanded() {
  try {
    const raw = window.localStorage?.getItem(FAN_SERVICE_EXPANDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFanServiceExpanded(value) {
  try {
    window.localStorage?.setItem(FAN_SERVICE_EXPANDED_KEY, JSON.stringify(value));
  } catch {
    // Non-fatal — the tab still works, it just won't remember which group
    // was open/closed between sessions.
  }
}

function useFanServiceAccordion() {
  const [expanded, setExpanded] = useState(loadFanServiceExpanded);

  function isOpen(groupKey, sectionId, defaultOpen = true) {
    const key = `${groupKey}:${sectionId}`;
    return key in expanded ? expanded[key] : defaultOpen;
  }

  function toggle(groupKey, sectionId, defaultOpen = true) {
    setExpanded((prev) => {
      const key = `${groupKey}:${sectionId}`;
      const next = { ...prev, [key]: !(key in prev ? prev[key] : defaultOpen) };
      saveFanServiceExpanded(next);
      return next;
    });
  }

  return { isOpen, toggle };
}

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </div>
  );
}

function SegmentedField({ label, value, options, onChange, columns = 3 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.hint || opt.label}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-focusAccent border-focusAccent text-white'
                  : 'bg-panelAlt border-line text-inkMuted hover:bg-line hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const GROUP_META = {
  superchat: {
    title: 'Super Chat',
    desc: 'Áp dụng cho mọi tin nhắn Super Chat.',
  },
  membership: {
    title: 'Hội viên',
    desc: 'Dùng chung cho cả 3 sự kiện: Hội viên mới, Gia hạn hội viên, Tặng hội viên.',
  },
};

// "Tự động dùng màu theo tier tiền YouTube" (below) does when it's on.
const TIER_TABLE = [
  { tier: 7, label: '≥ $100', color: '#e53935', label2: 'Đỏ' },
  { tier: 6, label: '≥ $50', color: '#e91e63', label2: 'Hồng' },
  { tier: 5, label: '≥ $20', color: '#f57c00', label2: 'Cam' },
  { tier: 4, label: '≥ $10', color: '#ffca28', label2: 'Vàng' },
  { tier: 3, label: '≥ $5', color: '#0f9d58', label2: 'Xanh lá' },
  { tier: 2, label: '≥ $2', color: '#00e5ff', label2: 'Xanh lam' },
  { tier: 1, label: '< $2', color: '#1e88e5', label2: 'Xanh dương' },
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

const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Mỏng (400)' },
  { value: 'bold', label: 'Đậm (700)' },
  { value: 'extrabold', label: 'Rất đậm (900)' },
];

function BadgeFields({ badgeBefore, badgeAfter, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Badge trước tên">
        <input
          type="text"
          value={badgeBefore ?? ''}
          placeholder="MOD, ★, ✦…"
          onChange={(e) => onChange({ badgeBefore: e.target.value || null })}
          className={inputClass}
          maxLength={8}
        />
      </Field>
      <Field label="Badge sau tên">
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

const AVATAR_POSITION_OPTIONS = [
  { value: 'left', label: 'Trái' },
  { value: 'right', label: 'Phải' },
  { value: 'top', label: 'Trên' },
];

const AUTHOR_ALIGN_OPTIONS = [
  { value: 'left', label: 'Trái' },
  { value: 'center', label: 'Giữa' },
  { value: 'right', label: 'Phải' },
];

const MESSAGE_POSITION_OPTIONS = [
  { value: 'below', label: 'Xuống dòng' },
  { value: 'beside', label: 'Cùng hàng' },
];

// Every size knob is a scale (multiplier of the feature's own original px
function ScaleField({ label, value, onChange, min = 0.5, max = 2, step = 0.05 }) {
  const v = typeof value === 'number' ? value : 1;
  return (
    <Field label={`${label} — ${v.toFixed(2)}x`}>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

const PADDING_BASE_PX = { top: 8, right: 12, bottom: 8, left: 12 };

// Same scale idea as ScaleField, but shows the resulting px (computed from
function PaddingSideField({ label, side, value, onChange, min = 0, max = 4, step = 0.05 }) {
  const v = typeof value === 'number' ? value : 1;
  const resultPx = Math.round(PADDING_BASE_PX[side] * v);
  return (
    <Field label={`${label} — ${resultPx}px`}>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

// One group's full editor (layout + typography). No general badge/amount
// header comment. The membership group additionally gets a dedicated "Số
// tháng hội viên" line: visibility toggle, alignment, size, color — see
// "🖌️ Bubble riêng" (border/radius/opacity/shadow/glow) is NOT in that
// so opening e.g. "Bố cục" on Super Chat doesn't also open it on Hội
// viên — each group remembers its own sections independently. */
function GroupEditor({ groupKey, group, onChange, memberRoleStyle, accordion }) {
  const g = group || {};
  const patch = (p) => onChange(p);
  const sec = (id, defaultOpen = true) => ({
    open: accordion.isOpen(groupKey, id, defaultOpen),
    onToggle: () => accordion.toggle(groupKey, id, defaultOpen),
  });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panelAlt px-3 py-2">
        <span className="text-sm font-medium">Bật tuỳ chỉnh riêng cho {GROUP_META[groupKey].title}</span>
        <input
          type="checkbox"
          checked={Boolean(g.enabled)}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="h-4 w-4 accent-focusAccent"
        />
      </label>

      {!g.enabled && (
        <p className="text-xs text-inkMuted leading-relaxed">
          Đang tắt — {GROUP_META[groupKey].title} dùng chung style với Bố cục / Vai trò như bình thường. Bật lên để
          chỉnh riêng.
        </p>
      )}

      <fieldset disabled={!g.enabled} className={g.enabled ? '' : 'opacity-40 pointer-events-none'}>
        <div className="flex flex-col gap-3">
          <AccordionSection id={`section-fs-${groupKey}-visibility`} title="Hiển thị" {...sec('visibility', true)}>
            <AccordionBody>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'showAvatar',  label: 'Avatar' },
                  { key: 'showAuthor',  label: 'Tên' },
                  { key: 'showMessage', label: 'Nội dung' },
                  ...(groupKey === 'membership' ? [{ key: 'showMemberMonths', label: 'Số tháng hội viên' }] : []),
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-line bg-panelAlt px-3 py-2 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={g[key] !== false}
                      onChange={(e) => patch({ [key]: e.target.checked })}
                      className="h-3.5 w-3.5 accent-focusAccent flex-shrink-0"
                    />
                    <span className="text-xs text-ink">{label}</span>
                  </label>
                ))}
              </div>
            </AccordionBody>
          </AccordionSection>

          <AccordionSection id={`section-fs-${groupKey}-layout`} title="Bố cục" {...sec('layout', true)}>
            <AccordionBody>
              <SegmentedField
                label="Vị trí avatar"
                value={g.avatarPosition ?? 'left'}
                onChange={(v) => patch({ avatarPosition: v })}
                options={AVATAR_POSITION_OPTIONS}
              />

              <SegmentedField
                label="Tên"
                value={g.authorAlign ?? 'left'}
                onChange={(v) => patch({ authorAlign: v })}
                options={AUTHOR_ALIGN_OPTIONS}
              />

              {groupKey === 'membership' && (
                <SegmentedField
                  label="Dòng số tháng hội viên"
                  value={g.monthsAlign ?? 'left'}
                  onChange={(v) => patch({ monthsAlign: v })}
                  options={AUTHOR_ALIGN_OPTIONS}
                />
              )}

              <SegmentedField
                label="Nội dung tin nhắn"
                value={g.messagePosition ?? 'below'}
                onChange={(v) => patch({ messagePosition: v })}
                options={MESSAGE_POSITION_OPTIONS}
                columns={2}
              />

              <div className="flex flex-col gap-2">
                <span className="text-xs text-inkMuted">Padding — khoảng đệm 4 cạnh trong bubble</span>
                <div className="grid grid-cols-2 gap-3">
                  <PaddingSideField
                    label="Trên"
                    side="top"
                    value={g.paddingTopScale ?? 1}
                    onChange={(v) => patch({ paddingTopScale: v })}
                  />
                  <PaddingSideField
                    label="Phải"
                    side="right"
                    value={g.paddingRightScale ?? 1}
                    onChange={(v) => patch({ paddingRightScale: v })}
                  />
                  <PaddingSideField
                    label="Dưới"
                    side="bottom"
                    value={g.paddingBottomScale ?? 1}
                    onChange={(v) => patch({ paddingBottomScale: v })}
                  />
                  <PaddingSideField
                    label="Trái"
                    side="left"
                    value={g.paddingLeftScale ?? 1}
                    onChange={(v) => patch({ paddingLeftScale: v })}
                  />
                </div>
              </div>

              {groupKey === 'superchat' && (
                <>
                  <SectionDivider label="Số tiền" />

                  <SegmentedField
                    label="Vị trí số tiền"
                    value={g.amountPosition ?? 'inline'}
                    onChange={(v) => patch({ amountPosition: v })}
                    options={[
                      { value: 'inline', label: 'Cạnh tên' },
                      { value: 'block', label: 'Dòng riêng' },
                    ]}
                    columns={2}
                  />

                  {g.amountPosition === 'block' && (
                    <SegmentedField
                      label="Căn lề số tiền"
                      value={g.amountAlign ?? 'center'}
                      onChange={(v) => patch({ amountAlign: v })}
                      options={[
                        { value: 'left', label: 'Trái' },
                        { value: 'center', label: 'Giữa' },
                        { value: 'right', label: 'Phải' },
                      ]}
                      columns={3}
                    />
                  )}

                  <SegmentedField
                    label="Kiểu hiển thị số tiền"
                    value={g.amountStyle ?? 'pill'}
                    onChange={(v) => patch({ amountStyle: v })}
                    options={[
                      { value: 'pill', label: 'Khung pill' },
                      { value: 'plain', label: 'Chỉ chữ' },
                    ]}
                    columns={2}
                  />
                </>
              )}
            </AccordionBody>
          </AccordionSection>

          <AccordionSection id={`section-fs-${groupKey}-typography`} title="Cỡ chữ & màu sắc" {...sec('typography', true)}>
            <AccordionBody>
              <ScaleField
                label="Cỡ avatar"
                value={g.avatarScale ?? 1}
                onChange={(v) => patch({ avatarScale: v })}
              />

              <div className="grid grid-cols-2 gap-3 items-end">
                <ScaleField
                  label="Cỡ chữ tên"
                  value={g.authorFontScale ?? 1}
                  onChange={(v) => patch({ authorFontScale: v })}
                />
                <Field label="Màu tên">
                  <ColorPicker
                    value={g.authorColor ?? '#6e56f0'}
                    onChange={(v) => patch({ authorColor: v })}
                    allowGradient={false}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <ScaleField
                  label="Cỡ chữ nội dung"
                  value={g.messageFontScale ?? 1}
                  onChange={(v) => patch({ messageFontScale: v })}
                />
                <Field label="Màu nội dung">
                  <ColorPicker
                    value={g.messageColor ?? '#eaecef'}
                    onChange={(v) => patch({ messageColor: v })}
                    allowGradient={false}
                  />
                </Field>
              </div>

              {groupKey === 'membership' && (
                <div className="grid grid-cols-2 gap-3 items-end">
                  <ScaleField
                    label="Cỡ dòng số tháng"
                    value={g.monthsFontScale ?? 1.25}
                    onChange={(v) => patch({ monthsFontScale: v })}
                  />
                  <Field label="Màu dòng số tháng">
                    <ColorPicker
                      value={g.monthsColor ?? '#ffd166'}
                      onChange={(v) => patch({ monthsColor: v })}
                      allowGradient={false}
                    />
                  </Field>
                </div>
              )}

              {groupKey === 'superchat' && (
                <>
                  <SectionDivider label="Số tiền" />

                  <ScaleField
                    label="Cỡ chữ số tiền"
                    value={g.amountFontScale ?? 1}
                    onChange={(v) => patch({ amountFontScale: v })}
                  />

                  <SegmentedField
                    label="Độ đậm số tiền"
                    value={g.amountFontWeight ?? 'bold'}
                    onChange={(v) => patch({ amountFontWeight: v })}
                    options={WEIGHT_OPTIONS}
                  />
                </>
              )}
            </AccordionBody>
          </AccordionSection>

          <AccordionSection
            id={`section-fs-${groupKey}-color`}
            title={groupKey === 'superchat' ? 'Màu theo tier' : 'Màu bubble'}
            {...sec('color', true)}
          >
            <AccordionBody>
              {groupKey === 'superchat' ? (
                <>
                  <label className="flex items-center gap-2 rounded-lg border border-line bg-panelAlt px-3 py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={g.useTierColor !== false}
                      onChange={(e) => patch({ useTierColor: e.target.checked })}
                      className="h-3.5 w-3.5 accent-focusAccent flex-shrink-0"
                    />
                    <span className="text-xs text-ink">Tự động dùng màu theo tier tiền YouTube</span>
                  </label>

                  {g.useTierColor !== false ? (
                    <div className="rounded-lg bg-panelAlt border border-line p-3 flex flex-col gap-2">
                      <span className="text-[10px] text-inkMuted/80 leading-snug">
                        Màu bubble, viền và tên sẽ tự động đổi theo tier số tiền YouTube.
                      </span>
                      <TierColorPreview />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-panelAlt border border-line p-3 flex flex-col gap-3">
                      <span className="text-[10px] text-amber-400 leading-snug">
                        Đã tắt màu tier — Super Chat không còn tự đổi theo số tiền nữa. Tự chọn màu nền/viền bubble ở
                        đây; Màu tên/Màu nội dung dùng chung field ở phần "Cỡ chữ & màu sắc" trên.
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Màu nền bubble">
                          <ColorPicker
                            value={g.manualBgColor ?? 'rgba(104, 87, 34, 0.8)'}
                            onChange={(v) => patch({ manualBgColor: v })}
                            allowGradient={false}
                          />
                        </Field>
                        <Field label="Màu viền bubble">
                          <ColorPicker
                            value={g.manualBorderColor ?? 'rgba(255, 202, 40, 0.45)'}
                            onChange={(v) => patch({ manualBorderColor: v })}
                            allowGradient={false}
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-inkMuted leading-relaxed">
                    Không có tier tiền như Super Chat, nên đây là màu cố định cho bubble Hội viên. Mặc định (chưa đổi
                    gì) đang hiển thị đúng màu hiện có ở tab Mod / Hội viên — bấm "Dùng mặc định" để bỏ màu riêng và
                    quay về đó.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Màu nền bubble">
                      <div className="flex flex-col gap-1">
                        <ColorPicker
                          value={g.manualBgColor ?? memberRoleStyle?.messageBg ?? 'rgba(30, 58, 95, 0.9)'}
                          onChange={(v) => patch({ manualBgColor: v })}
                          allowGradient={false}
                        />
                        {g.manualBgColor && (
                          <button
                            type="button"
                            onClick={() => patch({ manualBgColor: null })}
                            className="text-[10px] text-inkMuted hover:text-ink text-left underline underline-offset-2 w-fit"
                          >
                            Dùng mặc định
                          </button>
                        )}
                      </div>
                    </Field>
                    <Field label="Màu viền bubble">
                      <div className="flex flex-col gap-1">
                        <ColorPicker
                          value={g.manualBorderColor ?? memberRoleStyle?.messageBorderColor ?? 'rgba(96, 165, 250, 0.45)'}
                          onChange={(v) => patch({ manualBorderColor: v })}
                          allowGradient={false}
                        />
                        {g.manualBorderColor && (
                          <button
                            type="button"
                            onClick={() => patch({ manualBorderColor: null })}
                            className="text-[10px] text-inkMuted hover:text-ink text-left underline underline-offset-2 w-fit"
                          >
                            Dùng mặc định
                          </button>
                        )}
                      </div>
                    </Field>
                  </div>
                </>
              )}
            </AccordionBody>
          </AccordionSection>

          {groupKey === 'superchat' && (
            <AccordionSection id={`section-fs-${groupKey}-badge`} title="Badge & chữ" {...sec('badge', false)}>
              <AccordionBody>
                <BadgeFields
                  badgeBefore={g.badgeBefore}
                  badgeAfter={g.badgeAfter}
                  onChange={patch}
                />
              </AccordionBody>
            </AccordionSection>
          )}

          <AccordionSection id={`section-fs-${groupKey}-texture`} title="Hoạ tiết riêng" {...sec('texture', false)}>
            <AccordionBody>
              <p className="text-[11px] text-inkMuted leading-relaxed">
                Texture nền riêng cho {GROUP_META[groupKey].title} — độc lập với hoạ tiết chung ở tab Bubble. Để trống
                thì dùng chung như bình thường.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <BubbleTextureSection
                  value={{
                    bubbleTextureUrl: g.bubbleTextureUrl,
                    bubbleTextureSize: g.bubbleTextureSize,
                    bubbleTextureRepeat: g.bubbleTextureRepeat,
                    bubbleTextureOpacity: g.bubbleTextureOpacity,
                    bubbleTexturePositionX: g.bubbleTexturePositionX,
                    bubbleTexturePositionY: g.bubbleTexturePositionY,
                    bubbleTextureBlendMode: g.bubbleTextureBlendMode,
                  }}
                  onChange={patch}
                  onReset={() =>
                    patch({
                      bubbleTextureUrl: null,
                      bubbleTextureSize: null,
                      bubbleTextureRepeat: null,
                      bubbleTextureOpacity: null,
                      bubbleTexturePositionX: null,
                      bubbleTexturePositionY: null,
                      bubbleTextureBlendMode: null,
                    })
                  }
                />
              </div>
            </AccordionBody>
          </AccordionSection>

          <AccordionSection
            id={`section-fs-${groupKey}-bubble`}
            title={`Bubble riêng — ${GROUP_META[groupKey].title}`}
            {...sec('bubble', false)}
          >
            <AccordionBody>
              <p className="text-[11px] text-inkMuted leading-relaxed">
                {groupKey === 'superchat'
                  ? 'Viền, bo góc, độ mờ, đổ bóng, glow riêng cho bubble Super Chat — áp dụng bất kể màu theo tier ở trên đang bật hay tắt.'
                  : 'Viền, bo góc, độ mờ, đổ bóng, glow riêng cho bubble Hội viên.'}{' '}
                Đây là phần thiết kế bubble thật sự (không chỉ màu); để mặc định thì dùng chung như tab Bubble chung.
              </p>

              <div className="grid grid-cols-2 gap-3 items-end">
                <Field label={`Độ dày viền — ${g.bubbleBorderWidth ?? 1}px`}>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={g.bubbleBorderWidth ?? 1}
                    onChange={(e) => patch({ bubbleBorderWidth: Number(e.target.value) })}
                  />
                </Field>
                <SegmentedField
                  label="Kiểu viền"
                  value={g.bubbleBorderStyle ?? 'solid'}
                  onChange={(v) => patch({ bubbleBorderStyle: v })}
                  options={[
                    { value: 'solid', label: 'Liền' },
                    { value: 'dashed', label: 'Đứt khúc' },
                    { value: 'dotted', label: 'Chấm' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <Field label={`Bo góc — ${g.bubbleRadius ?? 14}px`}>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    value={g.bubbleRadius ?? 14}
                    onChange={(e) => patch({ bubbleRadius: Number(e.target.value) })}
                  />
                </Field>
                <Field label={`Độ mờ bubble — ${Math.round((g.bubbleOpacity ?? 1) * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={g.bubbleOpacity ?? 1}
                    onChange={(e) => patch({ bubbleOpacity: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ShadowSection value={g.bubbleBoxShadow} onChange={(v) => patch({ bubbleBoxShadow: v })} allowCustomCss />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlowSection value={g.bubbleGlow} onChange={(v) => patch({ bubbleGlow: v })} allowCustomCss />
              </div>
            </AccordionBody>
          </AccordionSection>

          <AccordionSection
            id={`section-fs-${groupKey}-bunny`}
            title="Tai thỏ (Bunny Ears)"
            {...sec('bunny', false)}
          >
            <AccordionBody>
              <p className="text-[11px] text-inkMuted leading-relaxed">
                Bật/tắt tai thỏ riêng cho {GROUP_META[groupKey].title} — độc lập với cài đặt tai thỏ chung (tab
                Bubble). {GROUP_META[groupKey].title} luôn ép về 1 bubble duy nhất (không tách tên/nội dung ra
                riêng), nên dù Bố cục chung đang để "bọc chung" hay "bọc từng phần" thì cũng chỉ có{' '}
                <b>đúng 1 cặp tai thỏ</b> ở toàn bộ khung, không tách theo từng phần. Chọn "Kế thừa" để dùng lại đúng
                trạng thái bật/tắt của cài đặt tai thỏ chung.
              </p>
              <Field label="Tai thỏ cho nhóm này">
                <select
                  className={inputClass}
                  value={g.bubbleBunnyEars === true ? 'true' : g.bubbleBunnyEars === false ? 'false' : 'default'}
                  onChange={(e) => {
                    const v = e.target.value;
                    patch({ bubbleBunnyEars: v === 'true' ? true : v === 'false' ? false : null });
                  }}
                >
                  <option value="default">Kế thừa chung</option>
                  <option value="true">Bật</option>
                  <option value="false">Tắt</option>
                </select>
              </Field>
            </AccordionBody>
          </AccordionSection>
        </div>
      </fieldset>
    </div>
  );
}

export default function FanServicePanel() {
  const { fanServiceLocal, pushFanServiceUpdate, roleLocal } = useEditorState();
  const [activeGroup, setActiveGroup] = useState('superchat');
  const accordion = useFanServiceAccordion();

  if (!fanServiceLocal) return null;

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-sm font-semibold">Fan Service</h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Tuỳ chỉnh riêng cho Super Chat và các thông báo hội viên (mới / gia hạn / tặng) — độc lập với Bố cục và Vai
          trò chung.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-panelAlt border border-line p-1">
        {Object.keys(GROUP_META).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveGroup(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeGroup === key ? 'bg-focusAccent text-white' : 'text-inkMuted hover:bg-line hover:text-ink'
            }`}
          >
            {GROUP_META[key].title}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-inkMuted -mt-2">{GROUP_META[activeGroup].desc}</p>

      <GroupEditor
        groupKey={activeGroup}
        group={fanServiceLocal[activeGroup]}
        onChange={(patch) => pushFanServiceUpdate(activeGroup, patch)}
        memberRoleStyle={roleLocal?.roles?.member}
        accordion={accordion}
      />
    </section>
  );
}