(function () {
  const state = window.__OVS_INITIAL_STATE__ || {};
  let currentTheme = state.theme || state.themeId || 'classic';
  let currentConfig = state.config || {};
  let currentLayout = state.layoutConfig || {};
  let currentSlotStyle = state.slotStyleConfig || {};
  let currentAnimation = state.animationConfig || {};
  let currentDecoration = state.decorationConfig || { layers: [] };
  let currentRoleStyle = state.roleStyleConfig || { roles: {} };
  let messageTemplate = null;
  let messageHistory = Array.isArray(state.history) ? [...state.history] : [];

  const listEl = document.getElementById('ovs-chat-list');
  const themeStyleEl = document.getElementById('ovs-theme-style');

  const TICKER_THEMES = new Set(['ticker']);
  const DANMAKU_THEMES = new Set(['danmaku']);

  const DANMAKU_LANE_COUNT = 12;
  const DANMAKU_LANE_TOP = ['4%', '12%', '20%', '28%', '36%', '44%', '52%', '60%', '68%', '76%', '84%', '92%'];
  const DANMAKU_LANE_BASE_DURATION_SEC = [9, 11, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11];
  const DANMAKU_SPEED = 3;
  let danmakuLaneCursor = 0;

  function danmakuLaneDurationSec(lane) {
    return DANMAKU_LANE_BASE_DURATION_SEC[lane] / DANMAKU_SPEED;
  }

  if (!listEl || !themeStyleEl) {
    console.error('[ovs] overlay markup missing #ovs-chat-list or #ovs-theme-style');
    return;
  }

  const ALIGN_TO_FLEX = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
    left: 'flex-start',
    right: 'flex-end',
  };

  function directionToFlex(direction) {
    return direction === 'vertical' ? 'column' : 'row';
  }

  function flexDirectionForRow(rowDirection, mirrorHorizontal) {
    if (rowDirection === 'vertical') return 'column';
    return mirrorHorizontal ? 'row-reverse' : 'row';
  }

  function syncThemeModeClass() {
    if (!listEl) return;
    listEl.classList.toggle('ovs-theme-danmaku', DANMAKU_THEMES.has(currentTheme));
    listEl.classList.toggle('ovs-theme-ticker', TICKER_THEMES.has(currentTheme));
    if (DANMAKU_THEMES.has(currentTheme)) {
      listEl.dataset.ovsThemeMode = 'danmaku';
    } else if (TICKER_THEMES.has(currentTheme)) {
      listEl.dataset.ovsThemeMode = 'ticker';
    } else {
      listEl.dataset.ovsThemeMode = 'stack';
    }
  }

  function isFlythroughTheme() {
    return DANMAKU_THEMES.has(currentTheme) || TICKER_THEMES.has(currentTheme);
  }

  function pickDanmakuLane() {
    const lane = danmakuLaneCursor % DANMAKU_LANE_COUNT;
    danmakuLaneCursor += 1;
    return lane;
  }

  function bindDanmakuRemoval(node) {
    node.addEventListener(
      'animationend',
      (ev) => {
        if (ev.target === node && ev.animationName === 'ovs-danmaku-fly' && node.isConnected) {
          node.remove();
        }
      },
      { once: true }
    );
  }

  function appendDanmakuMessage(msg) {
    const node = createMessageNode(msg);
    const lane = pickDanmakuLane();
    const durationSec = danmakuLaneDurationSec(lane);

    node.dataset.danmakuLane = String(lane);
    node.style.top = DANMAKU_LANE_TOP[lane];
    node.style.animationDuration = `${durationSec}s`;
    bindDanmakuRemoval(node);

    listEl.appendChild(node);
  }

  function px(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n}px` : '0px';
  }

  function offsetVar(value) {
    return value != null && Number.isFinite(Number(value)) ? px(value) : 'auto';
  }

  function zIndexVar(value) {
    return value != null && Number.isFinite(Number(value)) ? String(value) : 'auto';
  }

  // Keep in sync with shared/image-url.js#toImageProxyUrl.
  function toImageProxyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:') return '';
      const host = u.hostname.toLowerCase();
      const allowed = [
        'i.ibb.co',
        'ibb.co',
        'i.imgur.com',
        'imgur.com',
        'cdn.discordapp.com',
        'media.discordapp.net',
        'raw.githubusercontent.com',
        'images.unsplash.com',
        'placehold.co',
        'placekitten.com',
      ];
      if (!allowed.some((h) => host === h || host.endsWith('.' + h))) return '';
      return `/image/proxy?url=${encodeURIComponent(rawUrl)}`;
    } catch (_err) {
      return '';
    }
  }

  // Keep in sync with shared/decoration-config.js#compileLayerInlineStyle.
  const PLACEMENT_CORNERS = {
    'top-left': { left: '0', top: '0' },
    'top-right': { left: '100%', top: '0' },
    'bottom-left': { left: '0', top: '100%' },
    'bottom-right': { left: '100%', top: '100%' },
    'top-center': { left: '50%', top: '0' },
    'bottom-center': { left: '50%', top: '100%' },
    'center-left': { left: '0', top: '50%' },
    'center-right': { left: '100%', top: '50%' },
    center: { left: '50%', top: '50%' },
  };

  function compileLayerInlineStyle(layer) {
    const translateX = Number(layer.translateX) || 0;
    const translateY = Number(layer.translateY) || 0;
    const rotate = Number(layer.rotate) || 0;
    const zIndex = layer.zIndex != null ? Number(layer.zIndex) : 5;
    const opacity = layer.opacity != null ? Number(layer.opacity) : 1;
    const width = layer.width != null ? Number(layer.width) : 48;
    const height = layer.height != null ? Number(layer.height) : 48;
    const placement = layer.placement || 'custom';
    const base = {
      position: 'absolute',
      right: 'auto',
      bottom: 'auto',
      zIndex: String(zIndex),
      opacity: String(opacity),
      width: `${width}px`,
      height: `${height}px`,
      objectFit: 'contain',
      pointerEvents: 'none',
    };
    const rot = `${rotate}deg`;

    if (placement === 'custom') {
      return {
        ...base,
        left: '0',
        top: '0',
        transform: `translate(${translateX}px, ${translateY}px) rotate(${rot})`,
        transformOrigin: 'center center',
      };
    }

    const corner = PLACEMENT_CORNERS[placement] || PLACEMENT_CORNERS['bottom-left'];
    return {
      ...base,
      left: corner.left,
      top: corner.top,
      transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) rotate(${rot})`,
      transformOrigin: 'center center',
    };
  }

  function ensurePositionedAnchor(el) {
    if (!el) return null;
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    return el;
  }

  function resolveBubbleAnchor(messageNode) {
    if (!messageNode) return null;
    const root = document.documentElement;
    const msgWrap = root.dataset.ovsBubbleWrapMessage === 'true';
    if (msgWrap) {
      return messageNode.querySelector('[data-slot="message"]') || messageNode;
    }
    return messageNode;
  }

  function applyInlineStyle(el, styleMap) {
    Object.entries(styleMap).forEach(([key, value]) => {
      el.style[key] = value;
    });
  }

  function ensureDecorationAnchor(el, anchorName) {
    if (!el) return null;
    if (anchorName === 'avatar' && el.tagName === 'IMG') {
      const existing = el.closest('.ovs-decoration-anchor[data-anchor="avatar"]');
      if (existing) return existing;
      const wrap = document.createElement('span');
      wrap.className = 'ovs-decoration-anchor';
      wrap.dataset.anchor = 'avatar';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      return wrap;
    }
    return el;
  }

  function resolveAnchorElement(messageNode, anchor) {
    if (!messageNode) return null;
    if (anchor === 'bubble') return resolveBubbleAnchor(messageNode);
    if (anchor === 'row') return messageNode;
    if (anchor === 'body') return messageNode.querySelector('.ovs-body') || messageNode;
    if (anchor === 'avatar') {
      const avatarEl = messageNode.querySelector('[data-slot="avatar"]');
      return ensureDecorationAnchor(avatarEl, 'avatar') || messageNode;
    }
    if (anchor === 'author') {
      return messageNode.querySelector('[data-slot="author"]') || messageNode;
    }
    if (anchor === 'message') {
      return messageNode.querySelector('[data-slot="message"]') || messageNode;
    }
    return messageNode;
  }

  function ensureDecorationHost(anchorEl, anchorName) {
    if (!anchorEl) return null;
    ensurePositionedAnchor(anchorEl);
    let host = anchorEl.querySelector(`:scope > .ovs-decoration-host[data-for-anchor="${anchorName}"]`);
    if (!host) {
      host = document.createElement('div');
      host.className = 'ovs-decoration-host';
      host.dataset.forAnchor = anchorName;
      anchorEl.insertBefore(host, anchorEl.firstChild);
    }
    return host;
  }

  function clearDecorationLayers(messageNode) {
    if (!messageNode) return;
    messageNode.querySelectorAll('.ovs-decoration-layer').forEach((el) => el.remove());
  }

  function applyDecorationLayers(messageNode, decorationConfig) {
    if (!messageNode) return;
    const layers = Array.isArray(decorationConfig?.layers) ? decorationConfig.layers : [];
    layers.forEach((layer) => {
      if (!layer || layer.enabled === false || !layer.imageUrl) return;
      const anchorEl = resolveAnchorElement(messageNode, layer.anchor || 'message');
      const host = ensureDecorationHost(anchorEl, layer.anchor || 'message');
      if (!host) return;

      const img = document.createElement('img');
      img.className = 'ovs-decoration-layer';
      img.alt = '';
      img.decoding = 'async';
      img.dataset.layerId = layer.id || '';
      img.dataset.placement = layer.placement || 'custom';
      applyInlineStyle(img, compileLayerInlineStyle(layer));

      const proxied = toImageProxyUrl(layer.imageUrl);
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.setAttribute('data-load-error', 'true');
      img.onload = () => img.removeAttribute('data-load-error');
      img.src = proxied || layer.imageUrl;

      host.appendChild(img);
    });
  }

  function refreshAllDecorations() {
    if (isFlythroughTheme()) return;
    const applyTo = (node) => {
      clearDecorationLayers(node);
      applyDecorationLayers(node, currentDecoration);
    };
    listEl.querySelectorAll('.ovs-message').forEach(applyTo);
    if (tickerTrackEl) {
      tickerTrackEl.querySelectorAll('.ovs-message').forEach(applyTo);
    }
  }

  function toAvatarProxyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:') return '';
      const host = u.hostname.toLowerCase();
      const allowed = ['yt3.ggpht.com', 'yt4.ggpht.com', 'ggpht.com', 'googleusercontent.com', 'ytimg.com'];
      if (!allowed.some((h) => host === h || host.endsWith('.' + h))) return '';
      return `/avatar/proxy?url=${encodeURIComponent(rawUrl)}`;
    } catch (_err) {
      return '';
    }
  }

  function applyAvatar(avatarEl, rawUrl) {
    if (!avatarEl) return;
    const effective = resolveEffectiveSlotStyle(currentSlotStyle, currentConfig);
    if (!effective.avatar.visible || currentConfig.showAvatar === false || !rawUrl) {
      avatarEl.setAttribute('data-hidden', 'true');
      avatarEl.removeAttribute('src');
      return;
    }

    avatarEl.removeAttribute('data-hidden');
    avatarEl.referrerPolicy = 'no-referrer';
    avatarEl.decoding = 'async';

    const proxied = toAvatarProxyUrl(rawUrl);
    avatarEl.onerror = () => avatarEl.setAttribute('data-hidden', 'true');
    avatarEl.onload = () => avatarEl.removeAttribute('data-hidden');

    if (proxied) {
      avatarEl.src = proxied;
    } else {
      avatarEl.referrerPolicy = 'no-referrer';
      avatarEl.src = rawUrl;
    }
  }

  // Keep in sync with shared/layout-config.js#normalizeBubbleWrapScreen.
  function normalizeBubbleWrapScreen(screen) {
    const s = screen || {};

    if (
      s.bubbleScope === 'message'
      && s.bubbleWrapRow == null
      && !s.bubbleWrapAuthor
      && !s.bubbleWrapMessage
    ) {
      return {
        ...s,
        bubbleWrapRow: false,
        bubbleWrapAuthor: false,
        bubbleWrapMessage: true,
        bubbleScope: null,
      };
    }

    if (s.bubbleWrapRow === false || s.bubbleWrapAuthor === true || s.bubbleWrapMessage === true) {
      return {
        ...s,
        bubbleWrapRow: false,
        bubbleWrapAuthor: Boolean(s.bubbleWrapAuthor),
        bubbleWrapMessage: Boolean(s.bubbleWrapMessage),
        bubbleScope: null,
      };
    }

    return {
      ...s,
      bubbleWrapRow: true,
      bubbleWrapAuthor: false,
      bubbleWrapMessage: false,
      bubbleScope: null,
    };
  }

  function isRowBubbleWrap(screen) {
    return normalizeBubbleWrapScreen(screen).bubbleWrapRow === true;
  }

  // Keep in sync with shared/layout-config.js#compileLayoutToCssVariables.
  function compileLayoutToCssVariables(layout) {
    const l = layout || {};
    const mr = l.messageRow || {};
    const meta = l.metaRow || {};
    const body = l.bodyColumn || {};
    const slots = l.slots || {};
    const screen = normalizeBubbleWrapScreen(l.screen || {});
    const mirrorHorizontal = screen.contentDirection === 'rtl';

    return {
      '--ovs-layout-message-direction': flexDirectionForRow(mr.direction || 'horizontal', mirrorHorizontal),
      '--ovs-layout-message-gap': px(mr.gap ?? 10),
      '--ovs-layout-message-align': ALIGN_TO_FLEX[mr.align] || 'flex-start',
      '--ovs-layout-message-padding': px(mr.padding ?? 0),
      '--ovs-layout-message-margin': px(mr.margin ?? 0),

      '--ovs-layout-meta-direction': flexDirectionForRow(meta.direction || 'horizontal', mirrorHorizontal),
      '--ovs-layout-meta-gap': px(meta.gap ?? 6),
      '--ovs-layout-meta-align': ALIGN_TO_FLEX[meta.align] || 'center',
      '--ovs-layout-meta-padding': px(meta.padding ?? 0),
      '--ovs-layout-meta-margin': px(meta.margin ?? 0),

      '--ovs-layout-body-direction': flexDirectionForRow(body.direction || 'vertical', mirrorHorizontal),
      '--ovs-layout-body-gap': px(body.gap ?? 2),
      '--ovs-layout-body-align': ALIGN_TO_FLEX[body.align] || 'stretch',
      '--ovs-layout-body-padding': px(body.padding ?? 0),
      '--ovs-layout-body-margin': px(body.margin ?? 0),

      '--ovs-layout-slot-avatar-order': String(slots.avatar?.order ?? 0),
      '--ovs-layout-slot-avatar-padding': px(slots.avatar?.padding ?? 0),
      '--ovs-layout-slot-avatar-margin': px(slots.avatar?.margin ?? 0),
      '--ovs-layout-slot-avatar-position': slots.avatar?.position === 'absolute' ? 'absolute' : 'static',
      '--ovs-layout-slot-avatar-top': offsetVar(slots.avatar?.top),
      '--ovs-layout-slot-avatar-left': offsetVar(slots.avatar?.left),
      '--ovs-layout-slot-avatar-right': offsetVar(slots.avatar?.right),
      '--ovs-layout-slot-avatar-bottom': offsetVar(slots.avatar?.bottom),
      '--ovs-layout-slot-avatar-z-index': zIndexVar(slots.avatar?.zIndex),

      '--ovs-layout-slot-author-order': String(slots.author?.order ?? 0),
      '--ovs-layout-slot-author-padding': px(slots.author?.padding ?? 0),
      '--ovs-layout-slot-author-margin': px(slots.author?.margin ?? 0),
      '--ovs-layout-slot-author-position': slots.author?.position === 'absolute' ? 'absolute' : 'static',
      '--ovs-layout-slot-author-top': offsetVar(slots.author?.top),
      '--ovs-layout-slot-author-left': offsetVar(slots.author?.left),
      '--ovs-layout-slot-author-right': offsetVar(slots.author?.right),
      '--ovs-layout-slot-author-bottom': offsetVar(slots.author?.bottom),
      '--ovs-layout-slot-author-z-index': zIndexVar(slots.author?.zIndex),

      '--ovs-layout-slot-badges-order': String(slots.badges?.order ?? 1),
      '--ovs-layout-slot-badges-padding': px(slots.badges?.padding ?? 0),
      '--ovs-layout-slot-badges-margin': px(slots.badges?.margin ?? 0),
      '--ovs-layout-slot-badges-position': slots.badges?.position === 'absolute' ? 'absolute' : 'static',
      '--ovs-layout-slot-badges-top': offsetVar(slots.badges?.top),
      '--ovs-layout-slot-badges-left': offsetVar(slots.badges?.left),
      '--ovs-layout-slot-badges-right': offsetVar(slots.badges?.right),
      '--ovs-layout-slot-badges-bottom': offsetVar(slots.badges?.bottom),
      '--ovs-layout-slot-badges-z-index': zIndexVar(slots.badges?.zIndex),

      '--ovs-layout-slot-message-order': String(slots.message?.order ?? 1),
      '--ovs-layout-slot-message-padding': px(slots.message?.padding ?? 0),
      '--ovs-layout-slot-message-margin': px(slots.message?.margin ?? 0),
      '--ovs-layout-slot-message-position': slots.message?.position === 'absolute' ? 'absolute' : 'static',
      '--ovs-layout-slot-message-top': offsetVar(slots.message?.top),
      '--ovs-layout-slot-message-left': offsetVar(slots.message?.left),
      '--ovs-layout-slot-message-right': offsetVar(slots.message?.right),
      '--ovs-layout-slot-message-bottom': offsetVar(slots.message?.bottom),
      '--ovs-layout-slot-message-z-index': zIndexVar(slots.message?.zIndex),

      '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
      '--ovs-layout-content-direction': 'ltr',
      '--ovs-bubble-wrap-row': isRowBubbleWrap(screen) ? '1' : '0',
      '--ovs-bubble-wrap-author': !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? '1' : '0',
      '--ovs-bubble-wrap-message': !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? '1' : '0',
    };
  }

  // Keep in sync with shared/slot-style-config.js#resolveEffectiveSlotStyle.
  function resolveEffectiveSlotStyle(slotStyle, customizeConfig) {
    const cfg = customizeConfig || {};
    const slots = (slotStyle && slotStyle.slots) || {};
    const g = (key, fallback) => (slots[key] && slots[key][fallback] !== undefined && slots[key][fallback] !== null
      ? slots[key][fallback]
      : undefined);

    const slotVis = (slotKey, globalKey, defaultVal) => {
      const layoutVis = currentLayout.slots?.[slotKey]?.visible;
      const styleVis = g(slotKey, 'visible');
      if (layoutVis !== undefined && layoutVis !== null) return Boolean(layoutVis);
      if (styleVis !== undefined && styleVis !== null) return Boolean(styleVis);
      if (cfg[globalKey] !== undefined) return Boolean(cfg[globalKey]);
      return defaultVal;
    };

    return {
      avatar: {
        visible: slotVis('avatar', 'showAvatar', true),
        size: g('avatar', 'size') ?? cfg.avatarSize ?? 32,
      },
      author: { visible: slotVis('author', null, true) },
      badges: { visible: slotVis('badges', 'showBadges', true) },
      message: { visible: slotVis('message', null, true) },
    };
  }

  // Keep in sync with shared/slot-bubble-config.js#compileSlotBubbleDecoration.
  function compileSlotBubbleDecoration(prefix, slot, globalConfig) {
    const cfg = globalConfig || {};
    const isSetLocal = (v) => v !== undefined && v !== null;
    const resolve = (key) => (isSetLocal(slot?.[key]) ? slot[key] : cfg[key]);
    const vars = {};
    const pxLocal = (v) => (Number.isFinite(Number(v)) ? `${Number(v)}px` : undefined);

    const bg = resolve('bubbleBg');
    if (bg) vars[`--ovs-slot-${prefix}-bubble-bg`] = bg;
    if (resolve('bubbleRadius') != null) vars[`--ovs-slot-${prefix}-bubble-radius`] = pxLocal(resolve('bubbleRadius'));
    if (resolve('bubbleOpacity') != null) vars[`--ovs-slot-${prefix}-bubble-opacity`] = String(resolve('bubbleOpacity'));
    if (isSetLocal(resolve('bubbleBorderWidth'))) vars[`--ovs-slot-${prefix}-bubble-border-width`] = pxLocal(resolve('bubbleBorderWidth'));
    if (isSetLocal(resolve('bubbleBorderStyle'))) vars[`--ovs-slot-${prefix}-bubble-border-style`] = resolve('bubbleBorderStyle');
    if (isSetLocal(resolve('bubbleBorderColor'))) vars[`--ovs-slot-${prefix}-bubble-border-color`] = resolve('bubbleBorderColor');
    if (isSetLocal(resolve('bubbleBoxShadow'))) vars[`--ovs-slot-${prefix}-bubble-box-shadow`] = resolve('bubbleBoxShadow');

    const padX = isSetLocal(resolve('bubblePaddingX'))
      ? resolve('bubblePaddingX')
      : (isSetLocal(resolve('bubblePadding')) ? resolve('bubblePadding') : null);
    const padY = isSetLocal(resolve('bubblePaddingY'))
      ? resolve('bubblePaddingY')
      : (isSetLocal(resolve('bubblePadding')) ? resolve('bubblePadding') : null);
    if (padX != null) vars[`--ovs-slot-${prefix}-bubble-pad-x`] = pxLocal(padX);
    if (padY != null) vars[`--ovs-slot-${prefix}-bubble-pad-y`] = pxLocal(padY);
    return vars;
  }

  // Keep in sync with shared/slot-style-config.js#compileSlotStyleToCssVariables.
  function compileSlotStyleToCssVariables(slotStyle, customizeConfig) {
    const cfg = customizeConfig || {};
    const slots = (slotStyle && slotStyle.slots) || {};
    const px = (v) => (Number.isFinite(Number(v)) ? `${Number(v)}px` : undefined);
    const pick = (slot, key) => (slots[slot] && slots[slot][key] != null ? slots[slot][key] : null);
    const pickTransform = (slot) => ({
      rotate: pick(slot, 'rotate') ?? 0,
      translateX: pick(slot, 'translateX') ?? 0,
      translateY: pick(slot, 'translateY') ?? 0,
      transformOrigin: pick(slot, 'transformOrigin') ?? 'center center',
    });
    const assignTransform = (prefix, t) => {
      vars[`--ovs-slot-${prefix}-rotate`] = `${t.rotate}deg`;
      vars[`--ovs-slot-${prefix}-translate-x`] = px(t.translateX);
      vars[`--ovs-slot-${prefix}-translate-y`] = px(t.translateY);
      vars[`--ovs-slot-${prefix}-transform-origin`] = t.transformOrigin;
    };
    const vars = {};

    const avatarSize = pick('avatar', 'size') ?? cfg.avatarSize;
    if (avatarSize != null) vars['--ovs-slot-avatar-size'] = px(avatarSize);
    const avatarRadius = pick('avatar', 'borderRadius');
    if (avatarRadius != null) {
      vars['--ovs-slot-avatar-border-radius'] = typeof avatarRadius === 'string' && avatarRadius.includes('%')
        ? avatarRadius
        : px(avatarRadius);
    }
    if (pick('avatar', 'borderWidth') != null) vars['--ovs-slot-avatar-border-width'] = px(pick('avatar', 'borderWidth'));
    if (pick('avatar', 'borderStyle') != null) vars['--ovs-slot-avatar-border-style'] = pick('avatar', 'borderStyle');
    if (pick('avatar', 'borderColor') != null) vars['--ovs-slot-avatar-border-color'] = pick('avatar', 'borderColor');
    if (pick('avatar', 'opacity') != null) vars['--ovs-slot-avatar-opacity'] = String(pick('avatar', 'opacity'));
    if (pick('avatar', 'margin') != null) vars['--ovs-slot-avatar-margin'] = px(pick('avatar', 'margin'));
    assignTransform('avatar', pickTransform('avatar'));

    const authorFont = pick('author', 'fontFamily') ?? cfg.fontFamily;
    const authorSize = pick('author', 'fontSize') ?? (cfg.fontSize != null ? Math.round(cfg.fontSize * 0.9) : null);
    if (authorFont) vars['--ovs-slot-author-font-family'] = authorFont;
    if (authorSize != null) vars['--ovs-slot-author-font-size'] = px(authorSize);
    if (pick('author', 'color') ?? cfg.authorColor) vars['--ovs-slot-author-color'] = pick('author', 'color') ?? cfg.authorColor;
    if (pick('author', 'fontWeight') != null) vars['--ovs-slot-author-font-weight'] = String(pick('author', 'fontWeight'));
    if (pick('author', 'opacity') != null) vars['--ovs-slot-author-opacity'] = String(pick('author', 'opacity'));
    if (pick('author', 'margin') != null) vars['--ovs-slot-author-margin'] = px(pick('author', 'margin'));
    assignTransform('author', pickTransform('author'));

    const badgesSize = pick('badges', 'fontSize') ?? (cfg.fontSize != null ? Math.round(cfg.fontSize * 0.65) : null);
    if (badgesSize != null) vars['--ovs-slot-badges-font-size'] = px(badgesSize);
    if (pick('badges', 'opacity') != null) vars['--ovs-slot-badges-opacity'] = String(pick('badges', 'opacity'));
    if (pick('badges', 'margin') != null) vars['--ovs-slot-badges-margin'] = px(pick('badges', 'margin'));
    assignTransform('badges', pickTransform('badges'));

    const msgFont = pick('message', 'fontFamily') ?? cfg.fontFamily;
    const msgSize = pick('message', 'fontSize') ?? cfg.fontSize;
    if (msgFont) vars['--ovs-slot-message-font-family'] = msgFont;
    if (msgSize != null) vars['--ovs-slot-message-font-size'] = px(msgSize);
    if (pick('message', 'color') ?? cfg.textColor) vars['--ovs-slot-message-color'] = pick('message', 'color') ?? cfg.textColor;
    if (pick('message', 'fontWeight') != null) vars['--ovs-slot-message-font-weight'] = String(pick('message', 'fontWeight'));
    if (pick('message', 'opacity') != null) vars['--ovs-slot-message-opacity'] = String(pick('message', 'opacity'));
    if (pick('message', 'margin') != null) vars['--ovs-slot-message-margin'] = px(pick('message', 'margin'));
    assignTransform('message', pickTransform('message'));

    Object.assign(vars, compileSlotBubbleDecoration('author', slots.author, cfg));
    Object.assign(vars, compileSlotBubbleDecoration('message', slots.message, cfg));

    return vars;
  }

  // Keep in sync with shared/animation-config.js#compileAnimationToCssVariables.
  function compileAnimationToCssVariables(animationConfig, customizeConfig) {
    const cfg = customizeConfig || {};
    const anim = animationConfig || {};
    const targets = anim.targets || {};
    const base = cfg.animationMs ?? 220;
    const enabled = anim.enabled !== false;
    const vars = { '--ovs-anim-enabled': enabled ? '1' : '0' };

    ['avatar', 'author', 'badges', 'message'].forEach((slot) => {
      const t = targets[slot] || {};
      vars[`--ovs-anim-${slot}-duration`] = `${t.durationMs ?? base}ms`;
      vars[`--ovs-anim-${slot}-delay`] = `${t.delayMs ?? 0}ms`;
      vars[`--ovs-anim-${slot}-easing`] = t.easing || 'ease-out';
      vars[`--ovs-anim-${slot}-translate-x`] = `${t.translateX ?? 0}px`;
      vars[`--ovs-anim-${slot}-translate-y`] = `${t.translateY ?? 0}px`;
    });
    return vars;
  }

  function compileBubbleDecorationToCssVariables(config) {
    const c = config || {};
    const vars = {};
    const pxLocal = (v) => (Number.isFinite(Number(v)) ? `${Number(v)}px` : undefined);
    const isSetLocal = (v) => v !== undefined && v !== null;

    if (isSetLocal(c.bubbleBorderWidth)) vars['--ovs-bubble-border-width'] = pxLocal(c.bubbleBorderWidth);
    if (isSetLocal(c.bubbleBorderStyle)) vars['--ovs-bubble-border-style'] = c.bubbleBorderStyle;
    if (isSetLocal(c.bubbleBorderColor)) vars['--ovs-bubble-border-color'] = c.bubbleBorderColor;
    if (isSetLocal(c.bubbleBoxShadow)) vars['--ovs-bubble-box-shadow'] = c.bubbleBoxShadow;

    const padX = isSetLocal(c.bubblePaddingX) ? c.bubblePaddingX : (isSetLocal(c.bubblePadding) ? c.bubblePadding : null);
    const padY = isSetLocal(c.bubblePaddingY) ? c.bubblePaddingY : (isSetLocal(c.bubblePadding) ? c.bubblePadding : null);
    if (padX != null) vars['--ovs-bubble-pad-x'] = pxLocal(padX);
    if (padY != null) vars['--ovs-bubble-pad-y'] = pxLocal(padY);

    return vars;
  }

  // Keep in sync with shared/role-style-config.js#compileRoleStyleToCssVariables.
  function compileRoleStyleToCssVariables(roleStyle) {
    const roles = roleStyle?.roles || {};
    const vars = {};
    const rootFlags = {};
    const defs = {
      moderator: {
        prefix: 'mod',
        authorColor: '#fca5a5',
        messageBg: '#f87171',
        messageTextColor: '#ffffff',
        badge: 'MOD',
        badgePosition: 'before',
      },
      member: {
        prefix: 'member',
        authorColor: '#93c5fd',
        messageBg: '#60a5fa',
        messageTextColor: '#ffffff',
        badge: '★',
        badgePosition: 'before',
      },
      superchat: {
        prefix: 'superchat',
        authorColor: '#fde047',
        messageBg: '#facc15',
        messageTextColor: '#1f2937',
        badge: '✦',
        badgePosition: 'before',
        showAmount: true,
      },
    };

    Object.keys(defs).forEach((roleKey) => {
      const def = defs[roleKey];
      const role = { ...def, ...(roles[roleKey] || {}) };
      const prefix = def.prefix;
      const enabled = role.enabled !== false;
      rootFlags[`ovsRole${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}Enabled`] = enabled ? 'true' : 'false';

      if (!enabled) return;

      const messageBg = role.messageBg || role.messageBgColor;
      const rowBg = role.rowBg || role.rowBgColor;

      if (role.authorColor) vars[`--ovs-role-${prefix}-author-color`] = role.authorColor;
      if (messageBg) vars[`--ovs-role-${prefix}-message-bg`] = messageBg;
      if (role.messageTextColor) vars[`--ovs-role-${prefix}-message-text-color`] = role.messageTextColor;
      if (rowBg) vars[`--ovs-role-${prefix}-row-bg`] = rowBg;
      vars[`--ovs-role-${prefix}-badge-before-content`] = role.badgeBefore
        ? `"${String(role.badgeBefore).replace(/"/g, '\\"')}"`
        : 'none';
      vars[`--ovs-role-${prefix}-badge-after-content`] = role.badgeAfter
        ? `"${String(role.badgeAfter).replace(/"/g, '\\"')}"`
        : 'none';

      if (roleKey === 'superchat') {
        rootFlags.ovsRoleSuperchatShowAmount = role.showAmount === false ? 'false' : 'true';
      }
    });

    return { vars, rootFlags };
  }

  function applyRoleStyleFlags(rootFlags) {
    const root = document.documentElement;
    const map = {
      ovsRoleModEnabled: 'data-ovs-role-mod-enabled',
      ovsRoleMemberEnabled: 'data-ovs-role-member-enabled',
      ovsRoleSuperchatEnabled: 'data-ovs-role-superchat-enabled',
      ovsRoleSuperchatShowAmount: 'data-ovs-role-superchat-show-amount',
    };
    Object.entries(map).forEach(([key, attr]) => {
      if (rootFlags[key] !== undefined) root.setAttribute(attr, rootFlags[key]);
    });
  }

  function applyCssVariables(config, layout, slotStyle, animationConfig, roleStyle) {
    const cfg = config || {};
    const root = document.documentElement;
    const roleCompiled = compileRoleStyleToCssVariables(roleStyle || currentRoleStyle);
    const map = {
      '--ovs-font-family': cfg.fontFamily,
      '--ovs-font-size': cfg.fontSize != null ? `${cfg.fontSize}px` : undefined,
      '--ovs-text-color': cfg.textColor,
      '--ovs-author-color': cfg.authorColor,
      '--ovs-bubble-bg': cfg.bubbleBg,
      '--ovs-bubble-radius': cfg.bubbleRadius != null ? `${cfg.bubbleRadius}px` : undefined,
      '--ovs-bubble-opacity': cfg.bubbleOpacity != null ? String(cfg.bubbleOpacity) : undefined,
      '--ovs-avatar-size': cfg.avatarSize != null ? `${cfg.avatarSize}px` : undefined,
      '--ovs-animation-ms': cfg.animationMs != null ? `${cfg.animationMs}ms` : undefined,
      ...compileBubbleDecorationToCssVariables(cfg),
      ...compileLayoutToCssVariables(layout),
      ...compileSlotStyleToCssVariables(slotStyle || currentSlotStyle, cfg),
      ...compileAnimationToCssVariables(animationConfig || currentAnimation, cfg),
      ...roleCompiled.vars,
    };
    Object.entries(map).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'undefinedpx') {
        root.style.setProperty(key, value);
      }
    });
    applyRoleStyleFlags(roleCompiled.rootFlags);

    const screen = normalizeBubbleWrapScreen(layout?.screen || {});
    root.dataset.ovsBubbleWrapRow = isRowBubbleWrap(screen) ? 'true' : 'false';
    root.dataset.ovsBubbleWrapAuthor = !isRowBubbleWrap(screen) && screen.bubbleWrapAuthor ? 'true' : 'false';
    root.dataset.ovsBubbleWrapMessage = !isRowBubbleWrap(screen) && screen.bubbleWrapMessage ? 'true' : 'false';
    delete root.dataset.ovsBubbleScope;

    listEl.classList.toggle('ovs-position-top-down', config.position === 'top-down');
    syncThemeModeClass();
    refreshAllSlotVisibility();
  }

  async function loadTheme(themeId) {
    const id = themeId || currentTheme || 'classic';
    try {
      const res = await fetch(`/themes/${encodeURIComponent(id)}/template.html`);
      if (!res.ok) throw new Error(`template HTTP ${res.status}`);
      const html = await res.text();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const tpl = wrapper.querySelector('template');
      if (!tpl) throw new Error('template element missing');
      currentTheme = id;
      themeStyleEl.href = `/themes/${encodeURIComponent(id)}/style.css`;
      syncThemeModeClass();
      messageTemplate = tpl;
      return true;
    } catch (err) {
      console.error('[ovs] loadTheme failed:', id, err);
      if (id !== 'classic') return loadTheme('classic');
      return Boolean(messageTemplate);
    }
  }

  function applyThemePayload(data, options = {}) {
    const nextTheme = data.themeId || data.theme || currentTheme;
    const themeSwitch = Boolean(nextTheme && nextTheme !== currentTheme);
    if (data.config) currentConfig = data.config;
    if (data.layoutConfig) currentLayout = data.layoutConfig;
    if (data.slotStyleConfig) currentSlotStyle = data.slotStyleConfig;
    if (data.animationConfig) currentAnimation = data.animationConfig;
    if (data.decorationConfig) currentDecoration = data.decorationConfig;
    if (data.roleStyleConfig) currentRoleStyle = data.roleStyleConfig;

    const incomingHistory = Array.isArray(data.history) ? data.history : null;

    const finish = () => {
      applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
      if (themeSwitch) {
        resetTickerPlayback();
        danmakuLaneCursor = 0;
        listEl.innerHTML = '';
      }
      if (incomingHistory && (themeSwitch || options.forceHistory || listEl.children.length === 0)) {
        messageHistory = [...incomingHistory];
        renderHistory(messageHistory);
      }
      if (!isFlythroughTheme()) {
        refreshAllDecorations();
      }
    };

    if (themeSwitch || !messageTemplate) {
      return loadTheme(nextTheme).then((ok) => {
        if (ok) finish();
      });
    }
    finish();
    return Promise.resolve();
  }

  const TICKER_SCROLL_PX_PER_SEC = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 260;

  let tickerTrackEl = null;
  let tickerOffset = 0;
  let tickerTargetOffset = 0;
  let tickerRafId = null;
  let tickerLastFrameTs = 0;

  function resetTickerPlayback() {
    if (tickerRafId) {
      cancelAnimationFrame(tickerRafId);
      tickerRafId = null;
    }
    tickerLastFrameTs = 0;
    tickerOffset = 0;
    tickerTargetOffset = 0;
    tickerTrackEl = null;
  }

  function ensureTickerTrack() {
    if (!tickerTrackEl || !tickerTrackEl.isConnected) {
      tickerTrackEl = document.createElement('div');
      tickerTrackEl.className = 'ovs-ticker-track';
      tickerTrackEl.setAttribute('aria-live', 'polite');
      listEl.appendChild(tickerTrackEl);
    }
    return tickerTrackEl;
  }

  function getTickerViewportWidth() {
    const style = getComputedStyle(listEl);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    return Math.max(0, listEl.clientWidth - paddingLeft - paddingRight);
  }

  function recalcTickerTarget() {
    if (!tickerTrackEl) return 0;
    const viewportW = getTickerViewportWidth();
    const trackW = tickerTrackEl.scrollWidth;
    return Math.max(0, trackW - viewportW);
  }

  function measureLeadingTickerItemWidth(first) {
    if (!first) return 0;
    const second = first.nextElementSibling;
    return second ? second.offsetLeft : first.offsetWidth;
  }

  function applyTickerTransform() {
    if (!tickerTrackEl) return;
    tickerTrackEl.style.transform = `translate3d(${-tickerOffset}px, -50%, 0)`;
  }

  function pruneLeftmostTickerMessages() {
    if (!tickerTrackEl) return;
    while (tickerTrackEl.firstElementChild) {
      const first = tickerTrackEl.firstElementChild;
      const pruneWidth = measureLeadingTickerItemWidth(first);
      if (pruneWidth <= 0) break;
      if (tickerOffset < pruneWidth - 0.5) break;
      first.remove();
      tickerOffset -= pruneWidth;
      tickerTargetOffset = Math.max(0, tickerTargetOffset - pruneWidth);
    }
  }

  function trimTickerDom() {
    if (!tickerTrackEl) return;
    const max = currentConfig.maxMessages || 40;
    while (tickerTrackEl.children.length > max) {
      const first = tickerTrackEl.firstElementChild;
      const pruneWidth = measureLeadingTickerItemWidth(first);
      first.remove();
      tickerOffset = Math.max(0, tickerOffset - pruneWidth);
      tickerTargetOffset = Math.max(0, tickerTargetOffset - pruneWidth);
    }
    tickerTargetOffset = recalcTickerTarget();
    tickerOffset = Math.min(tickerOffset, tickerTargetOffset);
    applyTickerTransform();
  }

  function tickerScrollLoop(ts) {
    if (!tickerTrackEl) {
      tickerRafId = null;
      tickerLastFrameTs = 0;
      return;
    }

    if (!tickerLastFrameTs) tickerLastFrameTs = ts;
    const dt = Math.min((ts - tickerLastFrameTs) / 1000, 0.05);
    tickerLastFrameTs = ts;

    if (tickerOffset < tickerTargetOffset) {
      tickerOffset = Math.min(tickerTargetOffset, tickerOffset + TICKER_SCROLL_PX_PER_SEC * dt);
      pruneLeftmostTickerMessages();
      applyTickerTransform();
      tickerRafId = requestAnimationFrame(tickerScrollLoop);
      return;
    }

    tickerLastFrameTs = 0;
    tickerRafId = null;
  }

  function startTickerScrollLoop() {
    tickerTargetOffset = recalcTickerTarget();
    if (tickerRafId || tickerOffset >= tickerTargetOffset) return;
    tickerRafId = requestAnimationFrame(tickerScrollLoop);
  }

  function appendTickerMessage(msg) {
    const track = ensureTickerTrack();
    track.appendChild(createMessageNode(msg));
    trimTickerDom();
    startTickerScrollLoop();
  }

  function renderHistory(history) {
    if (!Array.isArray(history) || history.length === 0) return;
    if (TICKER_THEMES.has(currentTheme)) {
      resetTickerPlayback();
      listEl.innerHTML = '';
      const track = ensureTickerTrack();
      const ordered = currentConfig.position === 'top-down' ? [...history].reverse() : history;
      ordered.forEach((msg) => track.appendChild(createMessageNode(msg)));
      trimTickerDom();
      tickerOffset = tickerTargetOffset;
      applyTickerTransform();
      return;
    }
    if (DANMAKU_THEMES.has(currentTheme)) {
      danmakuLaneCursor = 0;
      listEl.innerHTML = '';
      const ordered = currentConfig.position === 'top-down' ? [...history].reverse() : history;
      ordered.forEach((msg) => appendDanmakuMessage(msg));
      return;
    }
    history.forEach((msg) => renderMessage(msg, { trackHistory: false }));
  }

  function trimToMax() {
    const max = currentConfig.maxMessages || 40;
    while (listEl.children.length > max) {
      // bottom-up: oldest is first child; top-down: oldest is last child.
      const removeFromStart = currentConfig.position !== 'top-down';
      const target = removeFromStart ? listEl.firstElementChild : listEl.lastElementChild;
      if (!target) break;
      target.remove();
    }
  }

  function applySlotVisibility(el, slotKey) {
    if (!el) return;
    const effective = resolveEffectiveSlotStyle(currentSlotStyle, currentConfig);
    if (!effective[slotKey]?.visible) {
      el.setAttribute('data-hidden', 'true');
    } else {
      el.removeAttribute('data-hidden');
    }
  }

  function refreshBadgesVisibility(badgesEl) {
    if (!badgesEl) return;
    applySlotVisibility(badgesEl, 'badges');
    if (badgesEl.getAttribute('data-hidden') === 'true') return;
    if (currentConfig.showBadges === false || !badgesEl.textContent.trim()) {
      badgesEl.setAttribute('data-hidden', 'true');
    }
  }

  function refreshMessageNodeVisibility(node) {
    if (!node) return;
    const avatarEl = node.querySelector('[data-slot="avatar"]');
    const authorEl = node.querySelector('[data-slot="author"]');
    const badgesEl = node.querySelector('[data-slot="badges"]');
    const messageEl = node.querySelector('[data-slot="message"]');

    if (avatarEl) {
      const avatarUrl = avatarEl.dataset.avatarUrl || '';
      applyAvatar(avatarEl, avatarUrl);
    }
    applySlotVisibility(authorEl, 'author');
    applySlotVisibility(messageEl, 'message');
    refreshBadgesVisibility(badgesEl);
  }

  function refreshAllSlotVisibility() {
    const roots = listEl.querySelectorAll('.ovs-message');
    roots.forEach(refreshMessageNodeVisibility);
    if (tickerTrackEl) {
      tickerTrackEl.querySelectorAll('.ovs-message').forEach(refreshMessageNodeVisibility);
    }
  }

  function applySlotEnterAnimation(node) {
    if (TICKER_THEMES.has(currentTheme) || DANMAKU_THEMES.has(currentTheme)) return;
    const root = getComputedStyle(document.documentElement);
    if (root.getPropertyValue('--ovs-anim-enabled').trim() === '0') return;

    const pairs = [
      ['avatar', node.querySelector('[data-slot="avatar"]')],
      ['author', node.querySelector('[data-slot="author"]')],
      ['badges', node.querySelector('[data-slot="badges"]')],
      ['message', node.querySelector('[data-slot="message"]')],
    ];

    pairs.forEach(([, el]) => {
      if (!el || el.getAttribute('data-hidden') === 'true') return;
      el.classList.add('ovs-slot-enter');
      el.addEventListener(
        'animationend',
        (ev) => {
          if (ev.target === el) el.classList.remove('ovs-slot-enter');
        },
        { once: true }
      );
    });
  }

  function createMessageNode(msg) {
    const node = messageTemplate.content.firstElementChild.cloneNode(true);

    const avatarEl = node.querySelector('[data-slot="avatar"]');
    const authorEl = node.querySelector('[data-slot="author"]');
    const badgesEl = node.querySelector('[data-slot="badges"]');
    const messageEl = node.querySelector('[data-slot="message"]');

    if (avatarEl) {
      if (msg.avatarUrl) avatarEl.dataset.avatarUrl = msg.avatarUrl;
      applyAvatar(avatarEl, msg.avatarUrl);
    }
    applySlotVisibility(authorEl, 'author');
    applySlotVisibility(messageEl, 'message');

    if (authorEl) authorEl.textContent = msg.author;
    if (badgesEl) {
      if (msg.badges?.length) {
        badgesEl.textContent = msg.badges.map((b) => `[${b}]`).join(' ');
      }
      refreshBadgesVisibility(badgesEl);
    }
    // messageHtml originates from YouTube's own already-sanitized chat
    // renderer (plain text + their emoji <img> tags) — that's what lets us
    // safely use innerHTML here instead of losing the emoji.
    if (messageEl) messageEl.innerHTML = msg.messageHtml;

    const primaryRole = msg.isSuperchat
      ? 'superchat'
      : msg.roles?.includes('moderator')
        ? 'moderator'
        : msg.roles?.includes('member')
          ? 'member'
          : null;

    if (primaryRole) node.classList.add(`ovs-${primaryRole}`);

    if (msg.isSuperchat && msg.superchatCurrencyRaw && authorEl?.parentElement) {
      const amountEl = document.createElement('span');
      amountEl.className = 'ovs-superchat-amount';
      amountEl.textContent = msg.superchatCurrencyRaw;
      authorEl.parentElement.insertBefore(amountEl, authorEl.nextSibling);
    }

    if (!isFlythroughTheme()) {
      applyDecorationLayers(node, currentDecoration);
    }
    applySlotEnterAnimation(node);
    return node;
  }

  function renderMessage(msg, options = {}) {
    const trackHistory = options.trackHistory !== false;
    if (!messageTemplate) return;

    if (trackHistory) {
      if (currentConfig.position === 'top-down') {
        messageHistory.unshift(msg);
      } else {
        messageHistory.push(msg);
      }
    }

    if (TICKER_THEMES.has(currentTheme)) {
      appendTickerMessage(msg);
      return;
    }

    if (DANMAKU_THEMES.has(currentTheme)) {
      appendDanmakuMessage(msg);
      return;
    }

    const node = createMessageNode(msg);

    if (currentConfig.position === 'top-down') {
      listEl.prepend(node);
    } else {
      listEl.appendChild(node);
    }
    trimToMax();
  }

  function connectSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/overlay/socket`);

    ws.addEventListener('message', (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      if (payload.type === 'chat:new') {
        renderMessage(payload.data);
      } else if (payload.type === 'theme:changed') {
        applyThemePayload(payload.data || {});
      } else if (payload.type === 'config:updated') {
        currentConfig = payload.data;
        applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
        if (!isFlythroughTheme()) refreshAllDecorations();
      } else if (payload.type === 'layout:updated') {
        currentLayout = payload.data;
        applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
        if (!isFlythroughTheme()) refreshAllDecorations();
      } else if (payload.type === 'slot-style:updated') {
        currentSlotStyle = payload.data;
        applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
      } else if (payload.type === 'animation:updated') {
        currentAnimation = payload.data;
        applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
      } else if (payload.type === 'decoration:updated') {
        currentDecoration = payload.data || { layers: [] };
        refreshAllDecorations();
      } else if (payload.type === 'role-style:updated') {
        currentRoleStyle = payload.data || { roles: {} };
        applyCssVariables(currentConfig, currentLayout, currentSlotStyle, currentAnimation, currentRoleStyle);
      }
    });

    ws.addEventListener('close', () => {
      // OBS keeps the Browser Source open for the whole stream, so a brief
      // server restart shouldn't require the user to re-add the source.
      setTimeout(connectSocket, 2000);
    });
  }

  window.addEventListener('resize', () => {
    if (!TICKER_THEMES.has(currentTheme) || !tickerTrackEl) return;
    tickerTargetOffset = recalcTickerTarget();
    tickerOffset = Math.min(tickerOffset, tickerTargetOffset);
    applyTickerTransform();
    startTickerScrollLoop();
  });

  loadTheme(currentTheme).then((ok) => {
    if (!ok) return;
    applyThemePayload(
      {
        themeId: currentTheme,
        config: currentConfig,
        layoutConfig: currentLayout,
        slotStyleConfig: currentSlotStyle,
        animationConfig: currentAnimation,
        decorationConfig: currentDecoration,
        roleStyleConfig: currentRoleStyle,
        history: state.history,
      },
      { forceHistory: true }
    );
    connectSocket();
  });
})();
