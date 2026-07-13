import { useMemo } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';
import ColorPicker from './Customize/shared/ColorPicker.jsx';
import { BORDER_STYLE_OPTIONS } from './Customize/shared/constants.js';

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children }) {
  // Plain wrapper, not <label> -- an unassociated <label> around
  // multi-control content can cause the browser to auto-forward a
  // phantom click to whichever labelable descendant is currently first
  // in DOM order. See shared/fields.jsx for the full writeup.
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </div>
  );
}

/** Segmented icon-button group — replaces plain <select> for a few choices where a
 *  visual cue (alignment, position) communicates faster than reading text. */
function SegmentedField({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.hint || opt.label}
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                active
                  ? 'bg-focusAccent border-focusAccent text-white'
                  : 'bg-panelAlt border-line text-inkMuted hover:bg-line hover:text-ink'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Icon set for the segmented fields above — plain 20x20 stroke icons using currentColor
   so they inherit the active/inactive text color automatically. */
const ICONS = {
  alignLeft: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="12" y2="10" />
      <line x1="3" y1="15" x2="14" y2="15" />
    </svg>
  ),
  alignCenter: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="5" y1="10" x2="15" y2="10" />
      <line x1="4" y1="15" x2="16" y2="15" />
    </svg>
  ),
  alignRight: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="8" y1="10" x2="17" y2="10" />
      <line x1="6" y1="15" x2="17" y2="15" />
    </svg>
  ),
  arrowRight: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="10" x2="16" y2="10" />
      <polyline points="11,5 16,10 11,15" />
    </svg>
  ),
  arrowLeft: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="10" x2="17" y2="10" />
      <polyline points="9,5 4,10 9,15" />
    </svg>
  ),
  avatarLeft: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="5" cy="10" r="2.6" />
      <line x1="10" y1="7" x2="17" y2="7" />
      <line x1="10" y1="10" x2="15" y2="10" />
      <line x1="10" y1="13" x2="16" y2="13" />
    </svg>
  ),
  avatarTop: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10" cy="5" r="2.6" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="15" x2="13" y2="15" />
    </svg>
  ),
  avatarRight: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="15" cy="10" r="2.6" />
      <line x1="3" y1="7" x2="10" y2="7" />
      <line x1="5" y1="10" x2="10" y2="10" />
      <line x1="4" y1="13" x2="10" y2="13" />
    </svg>
  ),
};

/** Mirrors shared/layout-config.js#contractSimpleLayout for the browser. */
function contractSimpleLayout(layout) {
  if (!layout) {
    return {
      avatarPosition: 'left',
      nameBadges: 'inline-after',
      messagePosition: 'below',
      gap: 10,
      padding: 8,
      chatAlign: 'left',
      contentDirection: 'ltr',
      bubbleWrapMode: 'row',
      bubbleWrapAuthor: false,
      bubbleWrapMessage: false,
      headerSplit: false,
      headerDividerColor: 'rgba(255, 255, 255, 0.14)',
      headerDividerWidth: 1,
      headerDividerStyle: 'solid',
      headerDividerLength: 100,
    };
  }

  const mr = layout.messageRow || {};
  const meta = layout.metaRow || {};
  const body = layout.bodyColumn || {};
  const slots = layout.slots || {};
  const screen = layout.screen || {};

  let avatarPosition = 'left';
  if (mr.direction === 'vertical') avatarPosition = 'top';
  else if ((slots.avatar?.order ?? 0) > 0) avatarPosition = 'right';

  let nameBadges = 'inline-after';
  if (meta.direction === 'vertical') nameBadges = 'badges-below';
  else if ((slots.badges?.order ?? 1) < (slots.author?.order ?? 0)) nameBadges = 'inline-before';

  const messagePosition = body.direction === 'horizontal' ? 'beside' : 'below';

  const slotPositionFields = (key) => ({
    [`${key}PositionMode`]: slots[key]?.position ?? 'static',
    [`${key}Top`]: slots[key]?.top ?? null,
    [`${key}Left`]: slots[key]?.left ?? null,
    [`${key}Right`]: slots[key]?.right ?? null,
    [`${key}Bottom`]: slots[key]?.bottom ?? null,
    [`${key}ZIndex`]: slots[key]?.zIndex ?? null,
  });

  return {
    avatarPosition,
    nameBadges,
    messagePosition,
    gap: mr.gap ?? 10,
    padding: mr.padding ?? 8,
    chatAlign: screen.chatAlign ?? 'left',
    chatGap: screen.chatGap ?? 10,
    contentDirection: screen.contentDirection ?? 'ltr',
    bubbleWrapMode: screen.bubbleWrapRow === true ? 'row' : 'split',
    bubbleWrapAuthor: Boolean(screen.bubbleWrapAuthor),
    bubbleWrapMessage: Boolean(screen.bubbleWrapMessage),
    headerSplit: Boolean(screen.headerSplit),
    headerDividerColor: screen.headerDividerColor ?? 'rgba(255, 255, 255, 0.14)',
    headerDividerWidth: screen.headerDividerWidth ?? 1,
    headerDividerStyle: screen.headerDividerStyle ?? 'solid',
    headerDividerLength: screen.headerDividerLength ?? 100,
    avatarPadding: slots.avatar?.padding ?? 0,
    avatarMargin: slots.avatar?.margin ?? 0,
    authorPadding: slots.author?.padding ?? 0,
    authorMargin: slots.author?.margin ?? 0,
    badgesPadding: slots.badges?.padding ?? 0,
    badgesMargin: slots.badges?.margin ?? 0,
    messagePadding: slots.message?.padding ?? 0,
    messageMargin: slots.message?.margin ?? 0,
    showAvatarSlot: slots.avatar?.visible ?? null,
    showAuthorSlot: slots.author?.visible ?? null,
    showBadgesSlot: slots.badges?.visible ?? null,
    showMessageSlot: slots.message?.visible ?? null,
    ...slotPositionFields('avatar'),
    ...slotPositionFields('author'),
    ...slotPositionFields('badges'),
    ...slotPositionFields('message'),
  };
}

/** Mirrors shared/layout-config.js#expandSimpleLayout for the browser. */
function expandSimpleLayout(simple) {
  const s = { ...contractSimpleLayout(null), ...simple };

  const slotFromSimple = (key, order) => ({
    order,
    padding: s[`${key}Padding`] ?? 0,
    margin: s[`${key}Margin`] ?? 0,
    visible: s[`show${key.charAt(0).toUpperCase()}${key.slice(1)}Slot`] ?? null,
    position: s[`${key}PositionMode`] ?? 'static',
    top: s[`${key}Top`] ?? null,
    left: s[`${key}Left`] ?? null,
    right: s[`${key}Right`] ?? null,
    bottom: s[`${key}Bottom`] ?? null,
    zIndex: s[`${key}ZIndex`] ?? null,
  });

  const wrapRow = s.bubbleWrapMode !== 'split';
  const wrapAuthor = !wrapRow && Boolean(s.bubbleWrapAuthor);
  const wrapMessage = !wrapRow && Boolean(s.bubbleWrapMessage);

  return {
    messageRow: {
      direction: s.avatarPosition === 'top' ? 'vertical' : 'horizontal',
      gap: s.gap,
      align: 'start',
      padding: s.padding,
      margin: 0,
    },
    metaRow: {
      direction: s.nameBadges === 'badges-below' ? 'vertical' : 'horizontal',
      gap: 6,
      align: 'center',
      padding: 0,
      margin: s.nameBadges === 'badges-below' ? 0 : 2,
    },
    bodyColumn: {
      direction: s.messagePosition === 'beside' ? 'horizontal' : 'vertical',
      gap: s.messagePosition === 'beside' ? 6 : 2,
      align: s.messagePosition === 'beside' ? 'baseline' : 'stretch',
      padding: 0,
      margin: 0,
    },
    slots: {
      avatar: slotFromSimple('avatar', s.avatarPosition === 'right' ? 1 : 0),
      author: slotFromSimple('author', s.nameBadges === 'inline-before' ? 1 : 0),
      badges: slotFromSimple('badges', s.nameBadges === 'inline-before' ? 0 : 1),
      message: slotFromSimple('message', 1),
    },
    screen: {
      chatAlign: s.chatAlign || 'left',
      chatGap: s.chatGap,
      contentDirection: s.contentDirection || 'ltr',
      bubbleWrapRow: wrapRow,
      bubbleWrapAuthor: wrapAuthor,
      bubbleWrapMessage: wrapMessage,
      bubbleScope: null,
      headerSplit: Boolean(s.headerSplit),
      headerDividerColor: s.headerDividerColor || 'rgba(255, 255, 255, 0.14)',
      headerDividerWidth: s.headerDividerWidth ?? 1,
      headerDividerStyle: s.headerDividerStyle || 'solid',
      headerDividerLength: s.headerDividerLength ?? 100,
    },
  };
}

export default function LayoutPanel() {
  // `layoutLocal` (full expanded shape) is the single authoritative editing
  // buffer, shared with CustomPresetsPanel — there's no separate "local"
  // copy here anymore. We only contract it into the simple shape this UI
  // is built around, purely for rendering.
  const { layoutLocal, pushLayoutUpdate } = useEditorState();
  const local = useMemo(() => contractSimpleLayout(layoutLocal), [layoutLocal]);

  function pushUpdate(partial) {
    const next = { ...local, ...partial };
    pushLayoutUpdate(expandSimpleLayout(next));
  }

  if (!layoutLocal) return null;

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Bố cục</h2>

      <SegmentedField
        label="Căn khung chat trên màn hình"
        value={local.chatAlign}
        onChange={(v) => pushUpdate({ chatAlign: v })}
        options={[
          { value: 'left', label: 'Trái', hint: 'Neo khung chat vào mép trái màn hình', icon: ICONS.alignLeft },
          { value: 'center', label: 'Giữa', hint: 'Căn khung chat vào giữa màn hình', icon: ICONS.alignCenter },
          { value: 'right', label: 'Phải', hint: 'Neo khung chat vào mép phải màn hình', icon: ICONS.alignRight },
        ]}
      />

      <Field label={`Khoảng cách giữa các tin nhắn — ${local.chatGap ?? 10}px`}>
        <input
          type="range"
          min={0}
          max={60}
          value={local.chatGap ?? 10}
          onChange={(e) => pushUpdate({ chatGap: Number(e.target.value) })}
        />
      </Field>

      <SegmentedField
        label="Hướng bố cục (avatar/tên ở phía nào)"
        value={local.contentDirection}
        onChange={(v) => pushUpdate({ contentDirection: v })}
        options={[
          { value: 'ltr', label: 'Trái → Phải', hint: 'Avatar bên trái, nội dung đọc sang phải (mặc định)', icon: ICONS.arrowRight },
          { value: 'rtl', label: 'Phải → Trái', hint: 'Lật bố cục: avatar bên phải, nội dung đọc sang trái', icon: ICONS.arrowLeft },
        ]}
      />

      <SegmentedField
        label="Vị trí avatar"
        value={local.avatarPosition}
        onChange={(v) => pushUpdate({ avatarPosition: v })}
        options={[
          { value: 'left', label: 'Bên trái', hint: 'Avatar bên trái nội dung', icon: ICONS.avatarLeft },
          { value: 'top', label: 'Phía trên', hint: 'Avatar phía trên nội dung', icon: ICONS.avatarTop },
          { value: 'right', label: 'Bên phải', hint: 'Avatar bên phải nội dung', icon: ICONS.avatarRight },
        ]}
      />

      <Field label="Tên & badge">
        <select
          className={inputClass}
          value={local.nameBadges}
          onChange={(e) => pushUpdate({ nameBadges: e.target.value })}
        >
          <option value="inline-after">Cùng hàng — badge sau tên</option>
          <option value="inline-before">Cùng hàng — badge trước tên</option>
          <option value="badges-below">Badge xuống dòng dưới tên</option>
        </select>
      </Field>

      <Field label="Nội dung tin nhắn">
        <select
          className={inputClass}
          value={local.messagePosition}
          onChange={(e) => pushUpdate({ messagePosition: e.target.value })}
        >
          <option value="below">Dưới tên & badge</option>
          <option value="beside">Cạnh tên (cùng hàng)</option>
        </select>
      </Field>

      <Field label="Khung chat bọc">
        <select
          className={inputClass}
          value={local.bubbleWrapMode}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === 'row') {
              pushUpdate({ bubbleWrapMode: 'row', bubbleWrapAuthor: false, bubbleWrapMessage: false });
            } else {
              pushUpdate({
                bubbleWrapMode: 'split',
                bubbleWrapAuthor: local.bubbleWrapAuthor || false,
                bubbleWrapMessage: local.bubbleWrapMessage !== false,
              });
            }
          }}
        >
          <option value="row">Cả tin nhắn (avatar + tên + nội dung)</option>
          <option value="split">Bọc riêng từng phần</option>
        </select>
      </Field>

      {local.bubbleWrapMode === 'split' && (
        <div className="flex flex-wrap gap-4 text-sm pl-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={local.bubbleWrapAuthor ?? false}
              onChange={(e) => pushUpdate({ bubbleWrapAuthor: e.target.checked })}
              className="accent-focusAccent"
            />
            Bọc tên
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={local.bubbleWrapMessage ?? true}
              onChange={(e) => pushUpdate({ bubbleWrapMessage: e.target.checked })}
              className="accent-focusAccent"
            />
            Bọc nội dung chat
          </label>
        </div>
      )}

      {local.bubbleWrapMode === 'row' && (
        <>
          <label className="flex items-center gap-2 text-sm pl-1">
            <input
              type="checkbox"
              checked={local.headerSplit ?? false}
              onChange={(e) => pushUpdate({ headerSplit: e.target.checked })}
              className="accent-focusAccent"
            />
            Chia đôi bubble: header (avatar + tên) / nội dung chat
          </label>

          {local.headerSplit && (
            <div className="flex flex-col gap-3 text-sm pl-1">
              <Field label="Màu vạch chia (kéo alpha để chỉnh độ trong suốt)">
                <ColorPicker
                  value={local.headerDividerColor || 'rgba(255, 255, 255, 0.14)'}
                  onChange={(v) => pushUpdate({ headerDividerColor: v })}
                  allowGradient={false}
                />
              </Field>
              <div className="flex flex-wrap gap-4 items-end">
                <Field label={`Độ dày vạch — ${local.headerDividerWidth ?? 1}px`}>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={local.headerDividerWidth ?? 1}
                    onChange={(e) => pushUpdate({ headerDividerWidth: Number(e.target.value) })}
                  />
                </Field>
                <Field label={`Độ dài vạch — ${local.headerDividerLength ?? 100}%`}>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={local.headerDividerLength ?? 100}
                    onChange={(e) => pushUpdate({ headerDividerLength: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Kiểu vạch">
                  <select
                    className={inputClass}
                    value={local.headerDividerStyle || 'solid'}
                    onChange={(e) => pushUpdate({ headerDividerStyle: e.target.value })}
                  >
                    {BORDER_STYLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}
        </>
      )}

      <h3 className="text-xs uppercase tracking-wide text-inkMuted pt-1">Ẩn/hiện (layout)</h3>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.showAvatarSlot ?? true}
            onChange={(e) => pushUpdate({ showAvatarSlot: e.target.checked })}
            className="accent-focusAccent"
          />
          Avatar
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.showAuthorSlot ?? true}
            onChange={(e) => pushUpdate({ showAuthorSlot: e.target.checked })}
            className="accent-focusAccent"
          />
          Tên
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.showBadgesSlot ?? true}
            onChange={(e) => pushUpdate({ showBadgesSlot: e.target.checked })}
            className="accent-focusAccent"
          />
          Badge
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={local.showMessageSlot ?? true}
            onChange={(e) => pushUpdate({ showMessageSlot: e.target.checked })}
            className="accent-focusAccent"
          />
          Nội dung
        </label>
      </div>
    </section>
  );
}