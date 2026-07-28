// Runs inside the HIDDEN BrowserView that loads youtube.com/live_chat.
// contextIsolation + nodeIntegration:false on the page itself; this preload
// is the only thing with access to ipcRenderer, matching the architecture's
// "no renderer scrapes directly, only the coordinated view does" rule.
const { ipcRenderer } = require('electron');

let selectors = null;
let observer = null;
let seenIds = new Set();
let warnedUnknownTags = new Set();
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

    const tagNameEarly = (node.tagName || '').toLowerCase();
    const isSuperchat = selectors.superchatRenderer ? node.matches(selectors.superchatRenderer) : false;
    const isMembership =
      (selectors.membershipRenderer ? node.matches(selectors.membershipRenderer) : false) ||
      /membership|sponsorship/.test(tagNameEarly);

    // Superchat amount display text (e.g. "$5.00") — only queried for paid
    // messages. Currency parsing itself happens in shared/chat-message.js's
    // normalizeMessage(), so this stays pure DOM extraction, no logic.
    const superchatAmountEl =
      isSuperchat && selectors.superchatAmount ? node.querySelector(selectors.superchatAmount) : null;

    // Lowercased tag name, used both for the exact-match checks below AND
    // as a defensive fallback (see isLikelyMembershipTag) for when YouTube
    // ships a renamed/variant tag that selectors.config.json doesn't know
    // about yet — without this, a renamed tag would silently fail every
    // node.matches() check below and the whole message would be dropped
    // with zero trace (extractMessage would just never treat it as
    // membership-related, but it would still surface as an eventType
    // 'text' bubble — never as "nothing at all"; if messages disappear
    // completely, that's handleAddedNode's own node.matches(selectors.messageRenderer)
    // gate a few lines up in this file returning early before extractMessage
    // is even called. This tagName fallback ALSO widens what counts as
    // "membership" so isMembership/eventType stay correct even if
    // selectors.membershipRenderer's exact tag list falls behind YouTube's
    // markup.)
    const tagName = (node.tagName || '').toLowerCase();
    const isLikelyMembershipTag = /membership|sponsorship/.test(tagName);

    let eventType = 'text';

    if (node.matches('yt-live-chat-paid-sticker-renderer')) {
      eventType = 'sticker';
    } else if (node.matches('yt-live-chat-paid-message-renderer')) {
      eventType = 'superchat';
    } else if (
      node.matches(
        'yt-live-chat-sponsorships-gift-purchase-announcement-renderer, yt-live-chat-sponsorships-gift-redemption-announcement-renderer, ytd-sponsorships-live-chat-gift-purchase-announcement-renderer, ytd-sponsorships-live-chat-gift-redemption-announcement-renderer'
      ) ||
      (isLikelyMembershipTag && /gift|sponsorship/.test(tagName))
    ) {
      eventType = 'membership_gift';
    } else if (node.matches('yt-live-chat-membership-item-renderer') || isLikelyMembershipTag) {
      const headerSub = node.querySelector(
        '#header-sub-text, #header-primary-text, #header-content-primary-text, #header-title'
      );
      const headerText = headerSub ? headerSub.textContent.trim() : '';

      // IMPORTANT: check "gift" BEFORE the generic member/month check.
      // Almost every membership header — new-member AND gift AND milestone
      // alike — contains the word "member"/"thành viên", so checking that
      // first swallowed gift (and often new-member) headers into
      // membership_milestone and they never reached this branch. Gift
      // keywords are far more specific, so they get first look now.
      // Milestone's real signal is a NUMERIC month/year count ("6 tháng",
      // "1 year") or a personal thank-you note (#message) — NOT the bare
      // word "member"/"thành viên" by itself, since that word shows up in
      // new-member-join headers just as often ("đã trở thành Thành viên
      // mới") and used to make every new-member join misclassify as a
      // milestone too.
      const hasMilestoneCount = /\d+\s*(month|months|year|years|tháng|năm)/i.test(headerText);

      if (/gift|tặng/i.test(headerText)) {
        eventType = 'membership_gift';
      } else if (node.querySelector('#message') || hasMilestoneCount) {
        eventType = 'membership_milestone';
      } else {
        eventType = 'membership_new';
      }

      if (headerText && !badges.includes(headerText)) {
        badges.push(headerText);
      }
    }

    if (isMembership && !badges.some((b) => /member|thành viên|hội viên/i.test(b))) {
      badges.push('Member');
    }

    let messageHtml = messageEl ? messageEl.innerHTML : '';
    let messageText = messageEl ? messageEl.textContent.trim() : '';

    if (eventType === 'sticker' && !messageText) {
      const stickerImg = selectors.stickerImage ? node.querySelector(selectors.stickerImage) : null;
      if (stickerImg) {
        const src =
          stickerImg.src ||
          stickerImg.getAttribute('src') ||
          stickerImg.getAttribute('data-src') ||
          '';
        const alt = stickerImg.getAttribute('alt') || 'Super Sticker';
        if (src) {
          messageHtml = `<img src="${src}" class="ovs-sticker-img" style="max-height:80px;" alt="${alt}" />`;
          messageText = `[${alt}]`;
        }
      }
    }

    let superchatColor = '';
    if (isSuperchat) {
      superchatColor =
        node.style.getPropertyValue('--yt-live-chat-paid-message-primary-color') ||
        node.style.getPropertyValue('--yt-live-chat-paid-sticker-chip-background-color') ||
        (window.getComputedStyle
          ? window.getComputedStyle(node).getPropertyValue('--yt-live-chat-paid-message-primary-color') ||
            window.getComputedStyle(node).getPropertyValue('--yt-live-chat-paid-sticker-chip-background-color')
          : '') ||
        '';
      superchatColor = superchatColor.trim();
    }

    return {
      id: node.id || null,
      author: authorEl ? authorEl.textContent.trim() : '',
      avatarUrl: resolveAvatarUrl(node, selectors),
      // innerHTML (not textContent) so YouTube's emoji <img> tags survive.
      messageHtml,
      // Plain-text mirror of messageHtml — tag-free, used for language
      // detection and (later) Rule Engine text matching.
      messageText,
      badges,
      eventType,
      isSuperchat,
      superchatAmountRaw: superchatAmountEl ? superchatAmountEl.textContent.trim() : '',
      superchatColor,
    };
  } catch (err) {
    console.warn(
      `[chat-overlay] extractMessage failed for <${(node.tagName || '?').toLowerCase()}> — message dropped:`,
      err && err.message
    );
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

  const tagName = (node.tagName || '').toLowerCase();
  // Fallback: YouTube occasionally renames/adds renderer tags without
  // notice. If the configured selector list (selectors.config.json ->
  // messageRenderer) doesn't include the exact new tag, node.matches()
  // below fails and the node — including membership/gift announcements —
  // gets dropped silently with zero trace. Any tag whose name itself
  // mentions "membership" or "sponsorship" is treated as a message
  // regardless, so a config mismatch degrades to "possibly misclassified"
  // instead of "vanishes completely".
  const looksLikeMembershipTag = /membership|sponsorship/.test(tagName);

  if (!node.matches || (!node.matches(selectors.messageRenderer) && !looksLikeMembershipTag)) return;

  if (looksLikeMembershipTag && selectors.messageRenderer && !node.matches(selectors.messageRenderer)) {
    // Selector config is out of date for this tag — surface it so it can
    // be diagnosed (visible via the hidden BrowserView's devtools console),
    // but only ONCE per distinct tag name — a gift-redemption announcement
    // fires once per recipient, so without this a single gifting event
    // could print this warning dozens of times.
    if (!warnedUnknownTags.has(tagName)) {
      warnedUnknownTags.add(tagName);
      console.warn(
        `[chat-overlay] membership/sponsorship tag "${tagName}" not covered by selectors.config.json's ` +
          'messageRenderer/membershipRenderer list — captured via fallback, but please report this tag name ' +
          'so the selectors pack can be updated.'
      );
    }
  }

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