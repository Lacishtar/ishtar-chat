import { useEffect, useRef, useState } from 'react';

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </label>
  );
}

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
    },
  };
}

export default function LayoutPanel({ api, layoutConfig }) {
  const [local, setLocal] = useState(() => contractSimpleLayout(layoutConfig));
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocal(contractSimpleLayout(layoutConfig));
  }, [layoutConfig]);

  function pushUpdate(partial) {
    setLocal((prev) => {
      const next = { ...prev, ...partial };
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        api.updateLayout(expandSimpleLayout(next));
      }, 100);
      return next;
    });
  }

  if (!layoutConfig) return null;

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col gap-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Bố cục</h2>

      <Field label="Căn khung chat trên màn hình">
        <select
          className={inputClass}
          value={local.chatAlign}
          onChange={(e) => pushUpdate({ chatAlign: e.target.value })}
        >
          <option value="left">Trái</option>
          <option value="center">Giữa</option>
          <option value="right">Phải</option>
        </select>
      </Field>

      <Field label={`Khoảng cách giữa các tin nhắn — ${local.chatGap ?? 10}px`}>
        <input
          type="range"
          min={0}
          max={60}
          value={local.chatGap ?? 10}
          onChange={(e) => pushUpdate({ chatGap: Number(e.target.value) })}
        />
      </Field>

      <Field label="Chiều ngang nội dung">
        <select
          className={inputClass}
          value={local.contentDirection}
          onChange={(e) => pushUpdate({ contentDirection: e.target.value })}
        >
          <option value="ltr">Trái → Phải</option>
          <option value="rtl">Phải → Trái</option>
        </select>
      </Field>

      <Field label="Vị trí avatar">
        <select
          className={inputClass}
          value={local.avatarPosition}
          onChange={(e) => pushUpdate({ avatarPosition: e.target.value })}
        >
          <option value="left">Bên trái nội dung</option>
          <option value="top">Phía trên nội dung</option>
          <option value="right">Bên phải nội dung</option>
        </select>
      </Field>

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
