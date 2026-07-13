// Runs inside the HIDDEN BrowserView that loads youtube.com/live_chat.
// contextIsolation + nodeIntegration:false on the page itself; this preload
// is the only thing with access to ipcRenderer, matching the architecture's
// "no renderer captures directly, only the coordinated view does" rule.
const { ipcRenderer } = require('electron');

let selectors = null;
let observer = null;
let seenIds = new Set();
let batch = [];
let batchTimer = null;
let lastEmitAt = Date.now();

function resolveAvatarUrl(root, selectors) {
  const avatarEl = root.querySelector(selectors.avatar);
  if (!avatarEl) return '';

  const candidates = [avatarEl];
  if (avatarEl.tagName !== 'IMG') {
    avatarEl.querySelectorAll('img').forEach((img) => candidates.push(img));
  }

  for (const el of candidates) {
    // YouTube's yt-img-shadow may set src asynchronously; check multiple
    // lazy-load attribute patterns used across different YouTube DOM versions.
    const src =
      el.src ||
      el.getAttribute('src') ||
      el.getAttribute('data-src') ||
      el.getAttribute('lazy-src') ||
      // yt-img-shadow sometimes stores the URL on the parent custom element
      (el.parentElement ? el.parentElement.getAttribute('src') : '') ||
      '';
    if (src && !src.startsWith('data:') && src !== window.location.href) return src;
  }

  return '';
}

function extractMessage(node) {
  try {
    const authorEl = node.querySelector(selectors.author);
    const messageEl = node.querySelector(selectors.message);
    const badgeEls = node.querySelectorAll(selectors.badgeContainer);

    const badges = Array.from(badgeEls)
      .map((b) => b.getAttribute(selectors.badgeAccessibilityLabelAttr) || '')
      .filter(Boolean);

    const isSuperchat = node.matches(selectors.superchatRenderer);

    // Superchat amount display text (e.g. "$5.00") — only queried for paid
    // messages. Currency parsing itself happens in shared/chat-message.js's
    // normalizeMessage(), so this stays pure DOM extraction, no logic.
    const superchatAmountEl =
      isSuperchat && selectors.superchatAmount ? node.querySelector(selectors.superchatAmount) : null;

    return {
      id: node.id || null,
      author: authorEl ? authorEl.textContent.trim() : '',
      avatarUrl: resolveAvatarUrl(node, selectors),
      // innerHTML (not textContent) so YouTube's emoji <img> tags survive.
      messageHtml: messageEl ? messageEl.innerHTML : '',
      // Plain-text mirror of messageHtml — tag-free, used for language
      // detection and (later) Rule Engine text matching.
      messageText: messageEl ? messageEl.textContent.trim() : '',
      badges,
      isSuperchat,
      superchatAmountRaw: superchatAmountEl ? superchatAmountEl.textContent.trim() : '',
    };
  } catch (err) {
    return null;
  }
}

function flushBatch() {
  if (batch.length === 0) return;
  ipcRenderer.send('capturer:batch', batch);
  batch = [];
  batchTimer = null;
}

function queueMessage(raw) {
  batch.push(raw);
  lastEmitAt = Date.now();
  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, selectors.scanThrottleMs || 80);
  }
}

function handleAddedNode(node) {
  if (!(node instanceof HTMLElement)) return;
  if (!node.matches || !node.matches(selectors.messageRenderer)) return;

  const dedupeKey = node.id || null;
  if (dedupeKey) {
    if (seenIds.has(dedupeKey)) return;
    seenIds.add(dedupeKey);
    // Keep the dedupe set from growing forever across a long stream.
    if (seenIds.size > 5000) {
      seenIds = new Set(Array.from(seenIds).slice(-2000));
    }
  }

  const extracted = extractMessage(node);
  if (!extracted) return;

  if (extracted.avatarUrl) {
    // Avatar URL already resolved — send immediately.
    queueMessage(extracted);
  } else {
    // Avatar img.src may not be set yet (YouTube yt-img-shadow lazy-loads).
    // Re-probe once after a short delay, then send regardless so the message
    // is never dropped. 300 ms is enough for the custom element lifecycle but
    // well within the window before YouTube removes old chat nodes.
    setTimeout(() => {
      if (document.body.contains(node)) {
        extracted.avatarUrl = resolveAvatarUrl(node, selectors);
      }
      queueMessage(extracted);
    }, 300);
  }
}

function startObserving() {
  const container = document.querySelector(selectors.chatContainer);
  if (!container) {
    ipcRenderer.send('capturer:container-not-found');
    return false;
  }

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(handleAddedNode);
    }
  });

  observer.observe(container, { childList: true });

  // Pick up any messages already present before the observer attached.
  container.querySelectorAll(selectors.messageRenderer).forEach(handleAddedNode);

  ipcRenderer.send('capturer:started');
  return true;
}

function stopObserving() {
  if (observer) observer.disconnect();
  observer = null;
  seenIds = new Set();
  batch = [];
  clearTimeout(batchTimer);
  batchTimer = null;
}

// Self-healing heartbeat: if the chat is supposedly connected but nothing
// has come through in a while, tell the main process so it can warn the
// user instead of silently looking "connected" while actually dead.
setInterval(() => {
  if (!observer || !selectors) return;
  const idleFor = Date.now() - lastEmitAt;
  if (idleFor > (selectors.staleAfterMs || 45000)) {
    ipcRenderer.send('capturer:stale', idleFor);
  }
}, 10000);

ipcRenderer.on('capturer:init', (_event, incomingSelectors) => {
  selectors = incomingSelectors;
  lastEmitAt = Date.now();
  const ok = startObserving();
  if (!ok) {
    ipcRenderer.send('capturer:selector-error', 'chatContainer not found — YouTube layout may have changed.');
  }
});

ipcRenderer.on('capturer:stop', () => {
  stopObserving();
});

window.addEventListener('beforeunload', stopObserving);