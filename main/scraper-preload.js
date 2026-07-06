// Runs inside the HIDDEN BrowserView that loads youtube.com/live_chat.
// contextIsolation + nodeIntegration:false on the page itself; this preload
// is the only thing with access to ipcRenderer, matching the architecture's
// "no renderer scrapes directly, only the coordinated view does" rule.
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
    const src = el.src || el.getAttribute('src') || el.getAttribute('data-src') || '';
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
  ipcRenderer.send('scraper:batch', batch);
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
  if (extracted) queueMessage(extracted);
}

function startObserving() {
  const container = document.querySelector(selectors.chatContainer);
  if (!container) {
    ipcRenderer.send('scraper:container-not-found');
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

  ipcRenderer.send('scraper:started');
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
    ipcRenderer.send('scraper:stale', idleFor);
  }
}, 10000);

ipcRenderer.on('scraper:init', (_event, incomingSelectors) => {
  selectors = incomingSelectors;
  lastEmitAt = Date.now();
  const ok = startObserving();
  if (!ok) {
    ipcRenderer.send('scraper:selector-error', 'chatContainer not found — YouTube layout may have changed.');
  }
});

ipcRenderer.on('scraper:stop', () => {
  stopObserving();
});

window.addEventListener('beforeunload', stopObserving);
