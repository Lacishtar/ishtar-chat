// Runs inside the HIDDEN BrowserView that loads youtube.com/live_chat.
// contextIsolation + nodeIntegration:false on the page itself; this preload
// is the only thing with access to ipcRenderer, matching the architecture's
// "no renderer captures directly, only the coordinated view does" rule.
const { ipcRenderer } = require('electron');

let selectors = null;
let observer = null;
let seenIds = new Set();
let warnedUnknownTags = new Set();
let batch = [];
let batchTimer = null;
let lastEmitAt = Date.now();
// Tracks which membership event "shapes" (see logMembershipStructureOnce
// below) we've already dumped this session, so each distinct kind of
// membership event (new / renewal-milestone / gift sent / gift received /
// an unrecognized future variant) gets logged exactly once instead of
// flooding the console on every single chat message of that kind.
let loggedMembershipSignatures = new Set();

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

// Single source of truth for the sent/received split of the old
// 'membership_gift' event. Gift Membership on YouTube is actually two
// distinct renderers/announcements:
//   - "gift-purchase-announcement"   -> the gifter buying N memberships
//                                        for the community => SENT
//   - "gift-redemption-announcement" -> a viewer receiving one of those
//                                        gifted memberships           => RECEIVED
// Both the exact-tag branch and the header-text fallback branch below feed
// their hint (tagName and/or headerText) through this one function so the
// sent/received decision only lives in one place.
function classifyGiftEventType(hint) {
  const text = (hint || '').toLowerCase();
  // Redemption-side signals first: English "was gifted", Vietnamese passive
  // "được ... tặng" (was given a gift), or the tag name itself.
  if (/redemption|redeem|was gifted|được[^.!\n]*tặng/i.test(text)) {
    return 'membership_gift_received';
  }
  // Purchase-side signals: English "gifted N memberships", Vietnamese
  // active "(đã) tặng", or the tag name itself.
  if (/purchase|gifted|tặng/i.test(text)) {
    return 'membership_gift_sent';
  }
  // Ambiguous fallback (tag renamed by YouTube, no recognizable wording):
  // redemption fires once per recipient and is by far the more commonly
  // seen of the two in a chat feed, so default there rather than 'sent'.
  return 'membership_gift_received';
}

// Debug aid for building/fixing membership parsing logic against REAL
// captured markup instead of guessing. The first time we see a given
// "shape" of membership event in a session, dump everything about that
// node: full outerHTML, plus which of the known candidate selectors
// actually matched something and what text they held. Keyed by
// `${tagName}::${eventType}` — not just eventType — so e.g. a renamed
// future tag that still resolves to the same eventType gets its own dump
// too, since its underlying markup may differ.
//
// Logged via console.warn (not ipcRenderer.send) because capture-manager.js
// already forwards this hidden BrowserView's console output straight to
// this process's own terminal (see the 'console-message' listener there) —
// piggybacking on that existing pipe instead of adding a new IPC channel/
// log file to maintain.
//
// Resets naturally every time a new stream is connected, since connect()
// tears down the old BrowserView and loads a fresh page (a fresh JS
// context for this whole preload script), so you'll get one full set of
// dumps per session rather than just once ever.
function logMembershipStructureOnce(node, eventType, headerText, messageEl, badges) {
  const tagName = (node.tagName || '').toLowerCase();
  const signature = `${tagName}::${eventType}`;
  if (loggedMembershipSignatures.has(signature)) return;
  loggedMembershipSignatures.add(signature);

  // Candidate sub-elements worth knowing about when writing/adjusting the
  // parsing logic above. For each, record whether it existed on this node
  // and, if so, its own tag/id and text — this shows at a glance which
  // selector is the "real" source of truth for this particular event shape.
  const candidateSelectors = [
    '#header-primary-text',
    '#header-sub-text',
    '#header-content-primary-text',
    '#header-title',
    '#message',
    '#primary-text',
    '#author-name',
    '#chat-badges',
  ];
  const matchedFields = {};
  for (const sel of candidateSelectors) {
    const el = node.querySelector(sel);
    matchedFields[sel] = el
      ? { tagName: (el.tagName || '').toLowerCase(), text: el.textContent.trim().slice(0, 200) }
      : null;
  }

  const snapshot = {
    capturedAt: new Date().toISOString(),
    signature,
    tagName,
    resolved: {
      eventType,
      headerText,
      messageText: messageEl ? messageEl.textContent.trim() : '',
      badges,
    },
    matchedFields,
    // Capped so a pathological/huge node can't spam the console — real
    // membership-item-renderer nodes are small, this is just a safety net.
    outerHTML: (node.outerHTML || '').slice(0, 8000),
  };

  // ASCII-only heads-up in the terminal (signature is always plain ASCII
  // tag names + eventType, so this line is safe on any console codepage).
  // The full snapshot — which may contain Vietnamese/Japanese/etc. text —
  // goes to capture-manager.js via IPC to be written as a UTF-8 file
  // instead, since printing that text directly through console.warn is
  // what produces mojibake on a non-UTF-8 Windows terminal.
  console.warn(`[membership-debug] NEW event shape captured: ${signature} — see membership-debug.log`);
  ipcRenderer.send('capturer:membership-debug', snapshot);
}

function extractMessage(node) {
  try {
    const authorEl = node.querySelector(selectors.author);
    // NOTE: selectors.message is a combined fallback list that also
    // contains the header selectors (#header-sub-text, #header-title,
    // etc.) so plain-text messages — which only have #message — still
    // resolve. But node.querySelector() on a comma-separated selector
    // returns the first match in DOCUMENT ORDER, not list order. On
    // membership/gift renderers the header ("Hội viên trong 6 tháng" /
    // "Member for 6 months") sits BEFORE #message in the DOM, so the
    // combined query was grabbing the header text as messageEl and the
    // member's actual typed note in #message was silently dropped —
    // never captured anywhere. Try the dedicated body selector first so
    // #message (the real accompanying text, when present) wins; only
    // fall back to the combined list for renderers that have no #message
    // node at all (e.g. some header-only announcements).
    const messageBodySelector = selectors.messageBody || '#message';
    const messageEl = node.querySelector(messageBodySelector) || node.querySelector(selectors.message);
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
    let headerText = '';

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
      // eventType is decided right here at capture time — see
      // classifyGiftEventType() above for the single source of truth on
      // how "gift" tags/text split into sent vs received.
      eventType = classifyGiftEventType(tagName);
    } else if (node.matches('yt-live-chat-membership-item-renderer') || isLikelyMembershipTag) {
      // Don't use a single comma-separated querySelector here — on a comma
      // list, querySelector() returns the first match in DOCUMENT ORDER,
      // not selector-list order, which silently picks the wrong element
      // whenever more than one candidate exists on the same node (we hit
      // exactly this with an earlier, incorrect assumption about where
      // YouTube puts the month/year count — see membership-debug.log
      // captures from a real stream: the count is directly inside
      // #header-primary-text, e.g. "Hội viên trong 17 tháng"; there is no
      // #header-sub-text element in current markup at all. A same-named-
      // looking but unrelated '#header-subtext' — no hyphen — does exist,
      // but holds a static per-channel tagline identical across every
      // membership item, not per-event data, so it must never be read as
      // the milestone text). Keep this as an explicit priority list (not a
      // single hardcoded id) anyway, since it's a cheap defensive fallback
      // if YouTube's markup shifts again — just don't assume any specific
      // one of these is guaranteed to hold the count on today's markup.
      const headerPriority =
        selectors.membershipHeaderPriority || [
          '#header-sub-text',
          '#header-primary-text',
          '#header-content-primary-text',
          '#header-title',
        ];
      let headerSub = null;
      for (const sel of headerPriority) {
        const el = node.querySelector(sel);
        if (el && el.textContent.trim()) {
          headerSub = el;
          break;
        }
      }
      headerText = headerSub ? headerSub.textContent.trim() : '';

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
        eventType = classifyGiftEventType(`${tagName} ${headerText}`);
      } else if (node.querySelector('#message') || hasMilestoneCount) {
        eventType = 'membership_milestone';
      } else {
        eventType = 'membership_new';
      }

      if (headerText && !badges.includes(headerText)) {
        // unshift, not push: badges already contains the author's
        // persistent tier badge (from #chat-badges' aria-label, collected
        // earlier in this function for every message type) — e.g.
        // "Hội viên (1 năm)". That's YouTube's coarse badge tier, only
        // updated at fixed milestones (1/2/6/12/24 months...), NOT the
        // exact current duration. headerText, when it's a milestone event,
        // carries the real exact count instead (e.g. "Hội viên trong 17
        // tháng" for someone whose tier badge still only says "1 năm").
        // shared/chat-message.js's deriveMemberMonths() returns on the
        // FIRST regex match in this array, so the precise headerText value
        // must come before the coarse tier badge or the coarse/wrong
        // number always wins.
        badges.unshift(headerText);
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

    if (isMembership) {
      logMembershipStructureOnce(node, eventType, headerText, messageEl, badges);
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