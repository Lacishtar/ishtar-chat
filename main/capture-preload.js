// Runs inside the HIDDEN BrowserView that loads youtube.com/live_chat.
// Only this preload has ipcRenderer access — no renderer captures directly.
const { ipcRenderer } = require('electron');

let selectors = null;
let observer = null;
let seenIds = new Set();
let warnedUnknownTags = new Set();
let batch = [];
let batchTimer = null;
let lastEmitAt = Date.now();
// Membership event "shapes" already dumped this session (see
// logMembershipStructureOnce) — one dump per distinct kind, not per message.
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

function classifyGiftEventType(hint) {
  const text = (hint || '').toLowerCase();
  // Redemption signals: "was gifted", Vietnamese "được ... tặng", or tag name.
  if (/redemption|redeem|was gifted|được[^.!\n]*tặng/i.test(text)) {
    return 'membership_gift_received';
  }
  // Purchase signals: "gifted N memberships", Vietnamese "(đã) tặng", or tag name.
  if (/purchase|gifted|tặng/i.test(text)) {
    return 'membership_gift_sent';
  }
  // Ambiguous fallback — redemption is the more common of the two in a chat feed.
  return 'membership_gift_received';
}

function logMembershipStructureOnce(node, eventType, headerText, messageEl, badges) {
  const tagName = (node.tagName || '').toLowerCase();
  const signature = `${tagName}::${eventType}`;
  if (loggedMembershipSignatures.has(signature)) return;
  loggedMembershipSignatures.add(signature);

  const candidateSelectors = [
    '#header-primary-text',
    '#header-sub-text',
    '#header-content-primary-text',
    '#header-title',
    '#header-subtext',
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

  console.warn(`[membership-debug] NEW event shape captured: ${signature} — see membership-debug.log`);
  ipcRenderer.send('capturer:membership-debug', snapshot);
}

function extractMessage(node) {
  try {
    const authorEl = node.querySelector(selectors.author);
    // NOTE: selectors.message is a combined fallback list that also
    // membership/gift renderers the header ("Hội viên trong 6 tháng" /
    // member's actual typed note in #message was silently dropped —
    const messageBodySelector = selectors.messageBody || '#message';
    const messageEl = node.querySelector(messageBodySelector) || node.querySelector(selectors.message);
    const badgeEls = node.querySelectorAll(selectors.badgeContainer);

    const badges = Array.from(badgeEls)
      .map((b) => b.getAttribute(selectors.badgeAccessibilityLabelAttr) || '')
      .filter(Boolean);

    // powers "Dùng badge thật" (useRealBadge, shared/role-style-config.js):
    // custom-designed Mốc tháng badge instead of only ever reading its
    const badgeIconCandidates = Array.from(badgeEls)
      .map((b) => {
        const label = b.getAttribute(selectors.badgeAccessibilityLabelAttr) || '';
        const imgEl = b.querySelector(selectors.badgeIconImg || 'img');
        const url = imgEl ? (imgEl.src || imgEl.getAttribute('src') || '') : '';
        return { label, url };
      })
      .filter((c) => c.url);
    const memberBadgeIcon = badgeIconCandidates.find((c) =>
      /member|th[aà]nh\s*vi[eê]n|h[ộo]i\s*vi[eê]n/i.test(c.label)
    );
    const badgeIconUrl = (memberBadgeIcon || badgeIconCandidates[0] || {}).url || '';

    const tagNameEarly = (node.tagName || '').toLowerCase();
    const isSuperchat = selectors.superchatRenderer ? node.matches(selectors.superchatRenderer) : false;
    const isMembership =
      (selectors.membershipRenderer ? node.matches(selectors.membershipRenderer) : false) ||
      /membership|sponsorship/.test(tagNameEarly);

    const superchatAmountEl =
      isSuperchat && selectors.superchatAmount ? node.querySelector(selectors.superchatAmount) : null;

    const tagName = (node.tagName || '').toLowerCase();
    const isLikelyMembershipTag = /membership|sponsorship/.test(tagName);

    let eventType = 'text';
    let headerText = '';
    let membershipTierName = '';

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
      eventType = classifyGiftEventType(tagName);
    } else if (node.matches('yt-live-chat-membership-item-renderer') || isLikelyMembershipTag) {
      // #header-primary-text, e.g. "Hội viên trong 17 tháng"; there is no
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

      const tierNameSelector = selectors.membershipTierName || '#header-subtext';
      const tierNameEl = node.querySelector(tierNameSelector);
      membershipTierName = tierNameEl ? tierNameEl.textContent.trim() : '';

      // alike — contains the word "member"/"thành viên", so checking that
      // Milestone's real signal is a NUMERIC month/year count ("6 tháng",
      // "1 year") or a personal thank-you note (#message) — NOT the bare
      // word "member"/"thành viên" by itself, since that word shows up in
      // new-member-join headers just as often ("đã trở thành Thành viên
      // mới") and used to make every new-member join misclassify as a
      const hasMilestoneCount = /\d+\s*(month|months|year|years|tháng|năm)/i.test(headerText);

      if (/gift|tặng/i.test(headerText)) {
        eventType = classifyGiftEventType(`${tagName} ${headerText}`);
      } else if (node.querySelector('#message') || hasMilestoneCount) {
        eventType = 'membership_milestone';
      } else {
        eventType = 'membership_new';
      }

      if (headerText && !badges.includes(headerText)) {
        // "Hội viên (1 năm)". That's YouTube's coarse badge tier, only
        // carries the real exact count instead (e.g. "Hội viên trong 17
        // tháng" for someone whose tier badge still only says "1 năm").
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
      badgeIconUrl,
      eventType,
      isSuperchat,
      superchatAmountRaw: superchatAmountEl ? superchatAmountEl.textContent.trim() : '',
      superchatColor,
      membershipTierName,
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
  const looksLikeMembershipTag = /membership|sponsorship/.test(tagName);

  if (!node.matches || (!node.matches(selectors.messageRenderer) && !looksLikeMembershipTag)) return;

  if (looksLikeMembershipTag && selectors.messageRenderer && !node.matches(selectors.messageRenderer)) {
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

function triggerElementClick(el) {
  if (!el) return;
  const opts = { bubbles: true, cancelable: true, view: window };
  try { el.focus?.(); } catch (_e) {}
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  } catch (_e) {}
  try {
    if (typeof el.click === 'function') el.click();
  } catch (_e) {}
}

async function fetchViewerLeaderboardSnapshot(requestId) {
  try {
    const btn = document.querySelector("#viewer-leaderboard-entry-point button") ||
                document.querySelector("#viewer-leaderboard-entry-point yt-button-shape button") ||
                document.querySelector("#viewer-leaderboard-entry-point");

    const initialCount = document.querySelectorAll("ytvl-live-leaderboard-item-view-model").length;

    const panelSel = 'ytvl-live-leaderboard-renderer, #viewer-leaderboard-renderer, ytd-live-chat-leaderboard-renderer';
    const itemSel = selectors?.leaderboardItem || 'ytvl-live-leaderboard-item-view-model';

    const existingPanel = document.querySelector(panelSel);
    const originallyOpen = !!(existingPanel || initialCount > 0);

    if (!originallyOpen && btn) {
      btn.click();
      triggerElementClick(btn);

      // Theo dõi xem DOM có thay đổi không sau click
      const _mutationObserver = new MutationObserver((mutations) => {
        const added = mutations.reduce((sum, m) => sum + m.addedNodes.length, 0);
        const removed = mutations.reduce((sum, m) => sum + m.removedNodes.length, 0);
        const countNow = document.querySelectorAll('ytvl-live-leaderboard-item-view-model').length;
        if (countNow > 0) {
          _mutationObserver.disconnect();
        }
      });
      _mutationObserver.observe(document.body, { childList: true, subtree: true });
      // Tự dừng sau 7s phòng leak
      setTimeout(() => _mutationObserver.disconnect(), 7000);

    }

    const maxWait = 6000;
    const interval = 150;
    let elapsed = 0;
    let itemsFound = document.querySelectorAll(itemSel);

    while (itemsFound.length === 0 && elapsed < maxWait) {
      if (elapsed === 1500 && !originallyOpen && btn) {
        btn.click();
        triggerElementClick(btn);
      }
      await new Promise((res) => setTimeout(res, interval));
      elapsed += interval;
      itemsFound = document.querySelectorAll(itemSel);
    }


    const items = [];
    const rankSel = selectors?.leaderboardRank || '.ytvlLiveLeaderboardItemViewModelRankNumber';
    const avatarSel = selectors?.leaderboardAvatar || 'img';
    const nameSel = selectors?.leaderboardChannelName || '.ytvlLiveLeaderboardItemChannelContentViewModelChannelName';
    const xpSel = selectors?.leaderboardXp || '.ytvlLiveLeaderboardItemViewModelPoints';
    const badgeSel = selectors?.leaderboardBadge || '.ytvlLiveLeaderboardItemChannelContentViewModelBadge button, .ytvlLiveLeaderboardItemChannelContentViewModelBadge';

    itemsFound.forEach((node, index) => {
      const rankEl = node.querySelector(rankSel);
      const rank = rankEl ? rankEl.textContent.trim() : `${index + 1}`;

      const avatarUrl = resolveAvatarUrl(node, { avatar: avatarSel });

      const nameEl = node.querySelector(nameSel);
      const channelName = nameEl ? nameEl.textContent.trim() : '';

      const xpEl = node.querySelector(xpSel);
      const xp = xpEl ? xpEl.textContent.trim() : '';

      const badgeEl = node.querySelector(badgeSel);
      let badge = '';
      if (badgeEl) {
        badge =
          badgeEl.getAttribute('aria-label') ||
          badgeEl.getAttribute('title') ||
          badgeEl.textContent.trim() ||
          '';
      }

      items.push({
        rank,
        avatarUrl,
        channelName,
        xp,
        badge,
      });
    });

    if (!originallyOpen && btn) {
      try {
        const closeBtn = document.querySelector(
          '#viewer-leaderboard-close-button, ytvl-live-leaderboard-renderer #close-button, #close-button button'
        );
        if (closeBtn) {
          triggerElementClick(closeBtn);
        } else {
          btn.click();
          triggerElementClick(btn);
        }
      } catch (closeErr) {
        console.warn('[leaderboard-debug] Lỗi khi đóng lại panel:', closeErr && closeErr.message);
      }
    }

    ipcRenderer.send('capturer:leaderboard-response', {
      requestId,
      ok: true,
      items,
    });
  } catch (err) {
    console.error(`[leaderboard-debug] Exception while parsing leaderboard:`, err);
    ipcRenderer.send('capturer:leaderboard-response', {
      requestId,
      ok: false,
      error: err && err.message ? err.message : 'Lỗi khi parse bảng xếp hạng',
      items: [],
    });
  }
}

ipcRenderer.on('capturer:fetch-leaderboard', (_event, requestId) => {
  fetchViewerLeaderboardSnapshot(requestId);
});

ipcRenderer.on('capturer:stop', () => {
  stopObserving();
});

window.addEventListener('beforeunload', stopObserving);