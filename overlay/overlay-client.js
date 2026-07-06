(function () {
  const state = window.__OVS_INITIAL_STATE__ || {};
  let currentTheme = state.theme || state.themeId || 'classic';
  let currentConfig = state.config || {};
  let currentLayout = state.layoutConfig || {};
  let messageTemplate = null;
  let messageHistory = Array.isArray(state.history) ? [...state.history] : [];

  const listEl = document.getElementById('ovs-chat-list');
  const themeStyleEl = document.getElementById('ovs-theme-style');

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

  function px(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${n}px` : '0px';
  }

  // Keep in sync with shared/avatar-url.js#toAvatarProxyUrl.
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
    if (currentConfig.showAvatar === false || !rawUrl) {
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

  // Keep in sync with shared/layout-config.js#compileLayoutToCssVariables.
  function compileLayoutToCssVariables(layout) {
    const l = layout || {};
    const mr = l.messageRow || {};
    const meta = l.metaRow || {};
    const body = l.bodyColumn || {};
    const slots = l.slots || {};
    const screen = l.screen || {};
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

      '--ovs-layout-slot-author-order': String(slots.author?.order ?? 0),
      '--ovs-layout-slot-author-padding': px(slots.author?.padding ?? 0),
      '--ovs-layout-slot-author-margin': px(slots.author?.margin ?? 0),

      '--ovs-layout-slot-badges-order': String(slots.badges?.order ?? 1),
      '--ovs-layout-slot-badges-padding': px(slots.badges?.padding ?? 0),
      '--ovs-layout-slot-badges-margin': px(slots.badges?.margin ?? 0),

      '--ovs-layout-slot-message-order': String(slots.message?.order ?? 1),
      '--ovs-layout-slot-message-padding': px(slots.message?.padding ?? 0),
      '--ovs-layout-slot-message-margin': px(slots.message?.margin ?? 0),

      '--ovs-layout-chat-align': ALIGN_TO_FLEX[screen.chatAlign] || 'flex-start',
      '--ovs-layout-content-direction': 'ltr',
    };
  }

  function applyCssVariables(config, layout) {
    const cfg = config || {};
    const root = document.documentElement;
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
      ...compileLayoutToCssVariables(layout),
    };
    Object.entries(map).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'undefinedpx') {
        root.style.setProperty(key, value);
      }
    });

    listEl.classList.toggle('ovs-position-top-down', config.position === 'top-down');
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

    const incomingHistory = Array.isArray(data.history) ? data.history : null;

    const finish = () => {
      applyCssVariables(currentConfig, currentLayout);
      if (themeSwitch) {
        resetTickerPlayback();
        listEl.innerHTML = '';
      }
      if (incomingHistory && (themeSwitch || options.forceHistory || listEl.children.length === 0)) {
        messageHistory = [...incomingHistory];
        renderHistory(messageHistory);
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

  const TICKER_THEMES = new Set(['ticker']);
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

  function createMessageNode(msg) {
    const node = messageTemplate.content.firstElementChild.cloneNode(true);

    const avatarEl = node.querySelector('[data-slot="avatar"]');
    const authorEl = node.querySelector('[data-slot="author"]');
    const badgesEl = node.querySelector('[data-slot="badges"]');
    const messageEl = node.querySelector('[data-slot="message"]');

    if (avatarEl) {
      applyAvatar(avatarEl, msg.avatarUrl);
    }
    if (authorEl) authorEl.textContent = msg.author;
    if (badgesEl) {
      if (currentConfig.showBadges === false || !msg.badges || msg.badges.length === 0) {
        badgesEl.setAttribute('data-hidden', 'true');
      } else {
        badgesEl.textContent = msg.badges.map((b) => `[${b}]`).join(' ');
      }
    }
    // messageHtml originates from YouTube's own already-sanitized chat
    // renderer (plain text + their emoji <img> tags) — that's what lets us
    // safely use innerHTML here instead of losing the emoji.
    if (messageEl) messageEl.innerHTML = msg.messageHtml;

    if (msg.isSuperchat) node.classList.add('ovs-superchat');
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
        applyCssVariables(currentConfig, currentLayout);
      } else if (payload.type === 'layout:updated') {
        currentLayout = payload.data;
        applyCssVariables(currentConfig, currentLayout);
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
        history: state.history,
      },
      { forceHistory: true }
    );
    connectSocket();
  });
})();
