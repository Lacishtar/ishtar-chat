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

  return {
    avatarPosition,
    nameBadges,
    messagePosition,
    gap: mr.gap ?? 10,
    padding: mr.padding ?? 8,
    chatAlign: screen.chatAlign ?? 'left',
    contentDirection: screen.contentDirection ?? 'ltr',
  };
}

/** Mirrors shared/layout-config.js#expandSimpleLayout for the browser. */
function expandSimpleLayout(simple) {
  const s = { ...contractSimpleLayout(null), ...simple };

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
      avatar: { order: s.avatarPosition === 'right' ? 1 : 0, padding: 0, margin: 0 },
      author: { order: s.nameBadges === 'inline-before' ? 1 : 0, padding: 0, margin: 0 },
      badges: { order: s.nameBadges === 'inline-before' ? 0 : 1, padding: 0, margin: 0 },
      message: { order: 1, padding: 0, margin: 0 },
    },
    screen: {
      chatAlign: s.chatAlign || 'left',
      contentDirection: s.contentDirection || 'ltr',
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

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Khoảng cách avatar — ${local.gap}px`}>
          <input
            type="range"
            min={0}
            max={24}
            value={local.gap}
            onChange={(e) => pushUpdate({ gap: Number(e.target.value) })}
          />
        </Field>

        <Field label={`Padding bubble — ${local.padding}px`}>
          <input
            type="range"
            min={0}
            max={24}
            value={local.padding}
            onChange={(e) => pushUpdate({ padding: Number(e.target.value) })}
          />
        </Field>
      </div>
    </section>
  );
}
