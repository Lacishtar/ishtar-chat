const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { app, BrowserView, BrowserWindow, ipcMain } = require('electron');
const selectorsConfig = require('./selectors.config.json');
const { normalizeMessage } = require('../shared/chat-message');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parseVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl.trim());
    if (url.hostname === 'youtu.be') {
      return url.pathname.replace('/', '') || null;
    }
    if (url.pathname.startsWith('/live/')) {
      return url.pathname.split('/')[2] || null;
    }
    if (url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
    return null;
  } catch (err) {
    return null;
  }
}

function parseChannelLiveUrl(rawUrl) {
  try {
    const url = new URL(rawUrl.trim());
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;

    let pathname = url.pathname.replace(/\/+$/, '');
    if (pathname.toLowerCase().endsWith('/live')) {
      pathname = pathname.slice(0, -'/live'.length);
    }

    const isChannelRef =
      /^\/channel\/[^/]+$/.test(pathname) ||
      /^\/c\/[^/]+$/.test(pathname) ||
      /^\/user\/[^/]+$/.test(pathname) ||
      /^\/@[^/]+$/.test(pathname);

    if (!isChannelRef) return null;

    return `https://www.youtube.com${pathname}/live`;
  } catch (err) {
    return null;
  }
}

class CaptureManager extends EventEmitter {
  constructor(mainWindow) {
    super();
    this.mainWindow = mainWindow;
    this.view = null;
    this.videoId = null;
    this.status = 'idle'; // idle | connecting | connected | stale | error

    // --- Race-condition guard between 'capturer:deleted' and 'capturer:batch' ---
    // capture-preload.js sends creates through a THROTTLED batch (up to
    // scanThrottleMs, default 80ms — or up to 300ms+throttle while it's
    // still waiting to resolve an avatar URL), but sends deletes IMMEDIATELY,
    // with no batching at all. If a message gets moderated/deleted on
    // YouTube's side fast enough, 'capturer:deleted' can arrive here before
    // the 'capturer:batch' carrying that same message's create event even
    // gets flushed. Without this guard, the overlay would process a
    // chat:deleted for an id it doesn't know yet (harmless no-op), then
    // later process chat:new for that same id and render it — with no way
    // to ever delete it again, since capture-preload.js's own
    // `deletedReported` set already marks that id as "reported" and will
    // never re-send a delete for it.
    //
    // _knownIds: ids we've already emitted a 'message' event for and are
    //   still considered "alive" (not yet deleted).
    // _pendingDeletes: ids reported deleted before their create ever
    //   arrived — checked by the batch handler so it can drop the create
    //   entirely instead of ever letting it reach the overlay.
    this._knownIds = new Set();
    this._pendingDeletes = new Set();

    this._bindIpc();
  }

  _resetDeletionTracking() {
    this._knownIds = new Set();
    this._pendingDeletes = new Set();
  }

  _bindIpc() {
    ipcMain.on('capturer:batch', (event, rawBatch) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      const messages = rawBatch.map(normalizeMessage);
      messages.forEach((m) => {
        if (this._pendingDeletes.has(m.id)) {
          // Already reported deleted before this create arrived — drop it,
          // it must never reach the overlay.
          this._pendingDeletes.delete(m.id);
          return;
        }
        this._knownIds.add(m.id);
        if (this._knownIds.size > 5000) {
          this._knownIds = new Set(Array.from(this._knownIds).slice(-2000));
        }
        this.emit('message', m);
      });
    });

    ipcMain.on('capturer:started', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus('connected');
    });

    ipcMain.on('capturer:selector-error', (event, message) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus('error', message);
    });

    ipcMain.on('capturer:container-not-found', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus(
        'error',
        'Không tìm thấy khung chat. Video có thể không phải livestream đang có chat, hoặc YouTube đã đổi giao diện.'
      );
    });

    ipcMain.on('capturer:stale', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      if (this.status === 'connected') this._setStatus('stale');
    });

    ipcMain.on('capturer:membership-debug', (event, snapshot) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      const logPath = path.join(app.getPath('userData'), 'membership-debug.log');
      const block =
        `\n===== ${snapshot.capturedAt}  signature="${snapshot.signature}" =====\n` +
        JSON.stringify(snapshot, null, 2) +
        '\n';
      fs.appendFile(logPath, block, 'utf8', (err) => {
        if (err) console.warn('[membership-debug] failed to write log file:', err.message);
      });
    });

    ipcMain.on('capturer:leaderboard-response', (event, response) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this.emit('leaderboard-response', response);
    });

    ipcMain.on('capturer:deleted', (event, payload) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      const id = payload && payload.id ? String(payload.id) : null;
      if (!id) return;

      if (!this._knownIds.has(id)) {
        // The create for this id hasn't reached us yet (still sitting in
        // capture-preload.js's throttled batch) — remember it so the batch
        // handler above can drop the create the moment it does arrive,
        // instead of ever showing a message that's already deleted.
        this._pendingDeletes.add(id);
        if (this._pendingDeletes.size > 5000) {
          this._pendingDeletes = new Set(Array.from(this._pendingDeletes).slice(-2000));
        }
        return;
      }

      this._knownIds.delete(id);
      this.emit('message-deleted', { id });
    });
  }

  fetchLeaderboard() {
    return new Promise(async (resolve) => {
      if (!this.videoId) {
        console.warn('[capture-manager] fetchLeaderboard: videoId is null — not connected');
        return resolve({ ok: false, error: 'Chưa kết nối đến livestream chat nào.', items: [] });
      }

      const videoId = this.videoId;
      // Dùng popout URL thay vì embed_domain — Leaderboard không mở được trong embedded chat
      const popoutUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}&hl=vi&persist_hl=1`;

      let lbWin = null;
      // Chờ items xuất hiện lần đầu (tối đa 10s) + chờ số lượng ổn định
      // (tối đa 12s) + chờ avatar load xong (tối đa 6s) có thể cộng dồn
      // gần 30s trước khi cả bắt đầu clone — nên nới trần lên 45s.
      const TIMEOUT_MS = 45000;
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        try {
          if (lbWin && !lbWin.isDestroyed()) {
            lbWin.destroy();
            lbWin = null;
          }
        } catch (_e) { /* no-op */ }
        resolve(result);
      };

      const globalTimer = setTimeout(() => {
        console.warn('[capture-manager] fetchLeaderboard: global timeout 20s');
        finish({ ok: false, error: 'Hết thời gian chờ (Timeout 20s) khi tải popout chat.', items: [] });
      }, TIMEOUT_MS);

      try {
        // showInactive() + setOpacity(0): window được show (Chromium render đầy đủ, virtual scroll OK)
        // nhưng opacity=0 nên người dùng không thấy gì, showInactive() không cướp focus
        //
        // ĐÃ THỬ phóng cửa sổ lên 4000px với hy vọng panel leaderboard ăn
        // theo chiều cao viewport (bỏ được vòng lặp cuộn) — debug log thực
        // tế (2026-08-06) cho thấy container của panel luôn có
        // clientHeight=1029 CỐ ĐỊNH bất kể cửa sổ cao bao nhiêu, tức panel
        // tự set chiều cao riêng không phụ thuộc window. Trả về 900 (không
        // có lợi gì khi giữ 4000). Hướng tối ưu thật sự nằm ở việc cuộn
        // theo TRANG thay vì từng item — xem scraperScript bên dưới.
        lbWin = new BrowserWindow({
          width: 480,
          height: 900,
          show: false,       // khởi tạo ẩn, sẽ show ngay sau
          skipTaskbar: true, // không hiện trong taskbar
          frame: false,
          transparent: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false,
          },
        });

        // Đặt cùng vị trí với mainWindow để nằm "sau" nó về mặt z-order
        try {
          const [mx, my] = this.mainWindow.getPosition();
          lbWin.setPosition(mx, my);
        } catch (_) {}

        lbWin.setOpacity(0);   // hoàn toàn trong suốt — không thấy được
        lbWin.showInactive();  // show mà không cướp focus khỏi mainWindow

        lbWin.webContents.setAudioMuted(true);
        lbWin.webContents.setUserAgent(CHROME_UA);

        if (process.env.OVS_DEV) {
          lbWin.webContents.openDevTools({ mode: 'detach' });
        }


        lbWin.webContents.on('did-fail-load', (_e, code, desc) => {
          if (code === -3) return;
          clearTimeout(globalTimer);
          console.error(`[capture-manager] fetchLeaderboard: popout window failed to load (${code} ${desc})`);
          finish({ ok: false, error: `Không tải được popout chat (${desc}).`, items: [] });
        });

        lbWin.webContents.on('did-finish-load', async () => {
          if (settled) return;

          // Selector config
          const sel = selectorsConfig;

          // Script chạy trong page context — giống hệt DevTools console
          // Logs được gom vào mảng và trả về cùng result để in ở main process
          const scraperScript = `
            (async () => {
              const _logs = [];
              const _log = (...a) => { _logs.push(a.join(' ')); };

              const itemSel   = ${JSON.stringify(sel.leaderboardItem   || 'ytvl-live-leaderboard-item-view-model')};
              const rankSel   = ${JSON.stringify(sel.leaderboardRank   || '.ytvlLiveLeaderboardItemViewModelRankNumber')};
              const nameSel   = ${JSON.stringify(sel.leaderboardChannelName || '.ytvlLiveLeaderboardItemChannelContentViewModelChannelName')};
              const xpSel     = ${JSON.stringify(sel.leaderboardXp     || '.ytvlLiveLeaderboardItemViewModelPoints')};
              const badgeSel  = ${JSON.stringify(sel.leaderboardBadge  || '.ytvlLiveLeaderboardItemChannelContentViewModelBadge button, .ytvlLiveLeaderboardItemChannelContentViewModelBadge')};
              const avatarSel = ${JSON.stringify(sel.leaderboardAvatar || 'img')};

              // Bước 1: Tìm và click nút mở leaderboard
              const btn = document.querySelector("#viewer-leaderboard-entry-point button") ||
                          document.querySelector("#viewer-leaderboard-entry-point yt-button-shape button") ||
                          document.querySelector("#viewer-leaderboard-entry-point");

              _log("[lb-scraper] location.href:", location.href);
              _log("[lb-scraper] entry point button:", btn ? btn.tagName + '#' + btn.id : 'NOT FOUND');

              if (!btn) {
                return { ok: false, error: "Không tìm thấy #viewer-leaderboard-entry-point button trong popout chat.", items: [], logs: _logs };
              }

              btn.click();
              _log("[lb-scraper] Đã click nút leaderboard, chờ panel render...");

              // Bước 2: Chờ items xuất hiện lần đầu (tối đa 10s)
              const maxWait = 10000;
              const tick = 150;
              let elapsed = 0;
              let nodes = document.querySelectorAll(itemSel);
              while (nodes.length === 0 && elapsed < maxWait) {
                await new Promise(r => setTimeout(r, tick));
                elapsed += tick;
                nodes = document.querySelectorAll(itemSel);
                if (elapsed % 1000 === 0) _log("[lb-scraper] Chờ..." + elapsed + "ms, items:" + nodes.length);
              }

              _log("[lb-scraper] Batch đầu tiên: " + nodes.length + " items sau " + elapsed + "ms");

              if (nodes.length === 0) {
                return { ok: false, error: "Panel leaderboard đã click nhưng không có item nào xuất hiện sau " + maxWait + "ms.", items: [], logs: _logs };
              }

              // Bước 2b: Chờ panel render đủ toàn bộ item.
              //
              // Log chẩn đoán xác nhận: bảng leaderboard của YouTube KHÔNG
              // virtualize — toàn bộ item (tối đa ~50, giới hạn cứng của
              // YouTube) đều nằm sẵn trong DOM cùng lúc, không bị tái sử
              // dụng khi cuộn. Cái duy nhất thay đổi giữa các lần mở panel
              // là initial render không đều (batch đầu có thể chỉ 22-40
              // item), cần thêm thời gian để đạt đủ số lượng ổn định.

              // Tìm <img> avatar xuyên qua shadow DOM: nhiều row của YouTube
              // bọc avatar trong custom element có shadow root riêng (ví dụ
              // yt-img-shadow), mà querySelector thường KHÔNG xuyên qua
              // được. Đây chính là lý do 36/50 item "vĩnh viễn không có
              // avatar" dù chờ bao lâu — không phải do load chậm, mà do
              // không tìm thấy được thẻ <img> thật.
              const findAvatarImg = (node) => {
                const direct = node.querySelector(avatarSel);
                if (direct) return direct;
                const all = node.querySelectorAll('*');
                for (const el of all) {
                  if (el.shadowRoot) {
                    const found = el.shadowRoot.querySelector(avatarSel);
                    if (found) return found;
                  }
                }
                return null;
              };
              const readAvatarSrc = (node) => {
                const imgEl = findAvatarImg(node);
                if (!imgEl) return '';
                return imgEl.currentSrc || imgEl.src || imgEl.getAttribute('src') ||
                  imgEl.getAttribute('data-src') || imgEl.getAttribute('lazy-src') || '';
              };
              const hasRealAvatar = (node) => /^https?:\\/\\//.test(readAvatarSrc(node));

              // Chờ tổng số item ổn định (không đổi 2 lần check liên tiếp,
              // mỗi lần 150ms — đủ để panel render hết 50 item, vẫn giữ
              // trần ~12s để an toàn nếu panel render chậm bất thường).
              let stableRounds = 0;
              let lastCount = document.querySelectorAll(itemSel).length;
              const maxStabilizeRounds = 80; // 80 * 150ms ≈ 12s trần
              for (let i = 0; i < maxStabilizeRounds; i++) {
                await new Promise((r) => setTimeout(r, 150));
                const count = document.querySelectorAll(itemSel).length;
                if (count === lastCount) {
                  stableRounds++;
                  if (stableRounds >= 2) break;
                } else {
                  stableRounds = 0;
                  lastCount = count;
                }
                _log("[lb-scraper] chờ ổn định — round " + (i + 1) + ", count=" + count);
              }
              _log("[lb-scraper] Số lượng item đã ổn định: " + lastCount);

              // HTML dump xác nhận nguyên nhân thật: <img> avatar vẫn nằm
              // sẵn trong DOM (không phải shadow DOM, không bị xoá), nhưng
              // YouTube tự lazy-load từng avatar dựa theo item đó đã từng
              // được cuộn vào khung nhìn hay chưa (thiếu class
              // "ytCoreImageLoaded" + thiếu attribute src khi chưa được
              // trigger). Vì node không bị tái sử dụng (đã xác nhận ở lần
              // test trước), cuộn qua toàn bộ không có rủi ro mất item như
              // lo ngại ban đầu — chỉ cần cuộn để trigger lazy-load ảnh.
              //
              // Bước 2c: cửa sổ ẩn giờ được main process phóng rất cao
              // (xem capture-manager.js) với hy vọng toàn bộ item đã nằm
              // sẵn trong viewport, khỏi cần cuộn. Nhưng panel leaderboard
              // có thể vẫn tự set overflow/scroll riêng bên trong, không
              // phụ thuộc chiều cao cửa sổ ngoài — nên ở đây PHẢI đo thực
              // tế trước khi quyết định bỏ qua vòng lặp cuộn, không được
              // giả định suông. Nếu vẫn phát hiện container bị cắt/scroll
              // riêng, rơi về đúng vòng lặp cuộn cũ — hành vi/độ an toàn
              // giữ nguyên 100% so với trước, chỉ khác là bỏ qua khi thật
              // sự không cần.
              {
                const findScrollContainer = (node) => {
                  let el = node;
                  while (el && el !== document.body && el !== document.documentElement) {
                    const cs = getComputedStyle(el);
                    const clips = cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden';
                    if (clips && el.scrollHeight > el.clientHeight + 8) {
                      return el;
                    }
                    el = el.parentElement;
                  }
                  return null;
                };

                const firstNode = document.querySelectorAll(itemSel)[0] || null;
                const scrollContainer = firstNode ? findScrollContainer(firstNode) : null;

                if (!scrollContainer) {
                  _log("[lb-scraper] Không có scroll/clip container riêng trong panel — mọi item đã nằm trong viewport, BỎ QUA vòng lặp cuộn.");
                } else {
                  // Cuộn THEO TRANG thay vì từng item: mỗi lần nhảy scrollTop
                  // một đoạn ≈ 80% chiều cao khung nhìn (client height) —
                  // overlap 20% để không bỏ sót item nằm ở biên giữa 2 trang.
                  // Vì container hiển thị nhiều item cùng lúc (ví dụ
                  // clientHeight=1029, mỗi item ~65px → ~16 item/trang), một
                  // lần nhảy đã trigger lazy-load cho cả cụm item đó, không
                  // cần scrollIntoView riêng từng item như trước (50 bước →
                  // còn ~4-5 bước).
                  const ch = scrollContainer.clientHeight;
                  const sh = scrollContainer.scrollHeight;
                  const maxScrollTop = Math.max(0, sh - ch);
                  const stepSize = Math.max(1, Math.floor(ch * 0.8));
                  const positions = [];
                  for (let pos = 0; pos < maxScrollTop; pos += stepSize) positions.push(pos);
                  positions.push(maxScrollTop); // luôn chạm đáy, tránh sót do làm tròn

                  for (const pos of positions) {
                    scrollContainer.scrollTop = pos;
                    await new Promise((r) => setTimeout(r, 220));
                  }
                  _log("[lb-scraper] Đã cuộn theo trang qua " + positions.length + " vị trí (container clientHeight=" + ch + ", scrollHeight=" + sh + ") để trigger lazy-load avatar.");

                  // Vét lại: item nào lỡ vẫn chưa có avatar (do rơi đúng
                  // biên giữa 2 trang) thì cuộn trực tiếp riêng item đó —
                  // số lượng sót thường là 0, cùng lắm vài item nên chi phí
                  // gần như không đáng kể.
                  const stragglers = Array.from(document.querySelectorAll(itemSel)).filter((n) => !hasRealAvatar(n));
                  if (stragglers.length > 0) {
                    _log("[lb-scraper] Còn " + stragglers.length + " item chưa có avatar sau khi cuộn trang — cuộn vét riêng từng item.");
                    for (const node of stragglers) {
                      node.scrollIntoView({ block: 'center', behavior: 'instant' });
                      await new Promise((r) => setTimeout(r, 120));
                    }
                  }
                }
              }

              // Chờ avatar của từng item resolve xong src thật (poll tới
              // ~4s, check mỗi 150ms) — giờ chỉ còn để bắt trường hợp thật
              // sự load chậm, vì phần lớn "thiếu avatar" là do shadow DOM
              // (đã fix trên), không phải do tốc độ.
              const maxAvatarWaitRounds = 27; // 27 * 150ms ≈ 4s trần
              for (let i = 0; i < maxAvatarWaitRounds; i++) {
                const liveNodes = Array.from(document.querySelectorAll(itemSel));
                const pendingCount = liveNodes.filter((n) => !hasRealAvatar(n)).length;
                _log("[lb-scraper] chờ avatar — round " + (i + 1) + ", còn " + pendingCount + "/" + liveNodes.length + " chưa có avatar");
                if (pendingCount === 0) break;
                await new Promise((r) => setTimeout(r, 150));
              }

              // Bước 3: Parse trực tiếp từ node SỐNG (không clone) — vì
              // cloneNode() không bao giờ copy shadow DOM, nên nếu đọc
              // avatar sau khi clone thì mọi thứ tìm được ở bước trên coi
              // như mất trắng.
              const liveItemNodes = Array.from(document.querySelectorAll(itemSel));
              _log("[lb-scraper] Tổng cộng " + liveItemNodes.length + " items.");

              const items = [];
              liveItemNodes.forEach((node, index) => {
                const rankEl = node.querySelector(rankSel);
                const rank = rankEl ? rankEl.textContent.trim() : String(index + 1);

                const avatarUrl = readAvatarSrc(node);

                const nameEl = node.querySelector(nameSel);
                const channelName = nameEl ? nameEl.textContent.trim() : "";

                const xpEl = node.querySelector(xpSel);
                const xp = xpEl ? xpEl.textContent.trim() : "";

                const badgeEl = node.querySelector(badgeSel);
                let badge = "";
                if (badgeEl) {
                  badge = badgeEl.getAttribute("aria-label") || badgeEl.getAttribute("title") || badgeEl.textContent.trim() || "";
                }

                items.push({ rank, avatarUrl, channelName, xp, badge });
              });

              return { ok: true, items, logs: _logs };
            })();
          `;


          try {
            const result = await lbWin.webContents.executeJavaScript(scraperScript, true);
            clearTimeout(globalTimer);
            // In toàn bộ logs từ trong scraper ra terminal main process
            if (result?.logs?.length) {
              // Write to a UTF-8 log file — console.log() on Windows
              // (cmd.exe with a non-UTF-8 codepage) garbles Vietnamese text
              // into mojibake. A file opened in any text editor reads fine
              // regardless of terminal encoding.
              const logPath = path.join(app.getPath('userData'), 'leaderboard-scrape-debug.log');
              const block =
                `\n===== ${new Date().toISOString()} =====\n` +
                result.logs.join('\n') +
                '\n';
              fs.appendFile(logPath, block, 'utf8', (err) => {
                if (err) console.warn('[capture-manager] failed to write leaderboard-scrape-debug.log:', err.message);
              });
            }
            const { logs: _l, ...resultWithoutLogs } = result || {};
            finish(resultWithoutLogs || { ok: false, error: 'Scraper trả về kết quả rỗng.', items: [] });
          } catch (jsErr) {
            clearTimeout(globalTimer);
            console.error('[capture-manager] fetchLeaderboard: executeJavaScript threw:', jsErr);
            finish({ ok: false, error: `Lỗi khi chạy scraper: ${jsErr.message}`, items: [] });
          }
        });

        await lbWin.webContents.loadURL(popoutUrl, {
          extraHeaders: 'Accept-Language: vi-VN,vi;q=0.9\n',
        });
      } catch (err) {
        clearTimeout(globalTimer);
        console.error('[capture-manager] fetchLeaderboard: exception:', err);
        finish({ ok: false, error: `Lỗi khi tạo hidden BrowserWindow: ${err.message}`, items: [] });
      }
    });
  }

  _setStatus(status, error) {
    this.status = status;
    this.emit('status', { status, error: error || null, videoId: this.videoId });
  }

  _resolveChannelVideoId(channelLiveUrl) {
    return new Promise((resolve) => {
      const probe = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          backgroundThrottling: false,
        },
      });

      let settled = false;
      const timeoutId = setTimeout(() => finish(null), 12000);

      const finish = (videoId) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          this.mainWindow.removeBrowserView(probe);
        } catch (_e) {
          /* no-op */
        }
        resolve(videoId);
      };

      const checkCanonical = async () => {
        if (settled) return;
        try {
          const href = await probe.webContents.executeJavaScript(
            `(document.querySelector('link[rel="canonical"]') || document.querySelector('meta[property="og:url"]'))?.[document.querySelector('link[rel="canonical"]') ? 'href' : 'content'] || location.href`,
            true
          );
          finish(parseVideoId(href));
        } catch (_e) {
          /* page may have navigated away mid-read; ignore, other signals will settle it */
        }
      };

      this.mainWindow.addBrowserView(probe);
      probe.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      probe.setAutoResize({ width: false, height: false });
      probe.webContents.setAudioMuted(true);
      probe.webContents.setUserAgent(CHROME_UA);

      probe.webContents.on('did-navigate', (_e, navigatedUrl) => {
        const videoId = parseVideoId(navigatedUrl);
        if (videoId) {
          finish(videoId);
        } else {
          setTimeout(checkCanonical, 800);
        }
      });
      // Client-side redirect (history.pushState/replaceState) — same
      // document, so did-navigate never fires for this.
      probe.webContents.on('did-navigate-in-page', (_e, navigatedUrl) => {
        finish(parseVideoId(navigatedUrl));
      });
      probe.webContents.on('did-finish-load', () => {
        setTimeout(checkCanonical, 500);
      });
      probe.webContents.on('did-fail-load', (_e, code) => {
        if (code === -3) return;
        finish(null);
      });

      probe.webContents
        .loadURL(channelLiveUrl, { extraHeaders: 'Accept-Language: vi-VN,vi;q=0.9\n' })
        .catch(() => finish(null));
    });
  }

  async connect(rawUrl) {
    let videoId = parseVideoId(rawUrl);

    if (!videoId) {
      const channelLiveUrl = parseChannelLiveUrl(rawUrl);
      if (!channelLiveUrl) {
        this._setStatus(
          'error',
          'Link không đúng định dạng — dùng link video/live hoặc link kênh YouTube.'
        );
        return { ok: false, error: 'invalid_url' };
      }

      this._setStatus('connecting');
      videoId = await this._resolveChannelVideoId(channelLiveUrl);
      if (!videoId) {
        this._setStatus('error', 'Kênh hiện không có livestream nào đang diễn ra.');
        return { ok: false, error: 'channel_not_live' };
      }
    }

    await this.disconnect();

    this.videoId = videoId;
    this._resetDeletionTracking();
    this._setStatus('connecting');

    this.view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'capture-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    });

    this.mainWindow.addBrowserView(this.view);
    this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    this.view.setAutoResize({ width: false, height: false });
    this.view.webContents.setAudioMuted(true);
    this.view.webContents.setUserAgent(CHROME_UA);

    this.view.webContents.on('did-finish-load', () => {
      this.view.webContents.send('capturer:init', selectorsConfig);
    });

    this.view.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) {
        console.warn('[capture-view]', message);
      }
    });
    if (process.env.OVS_DEV) {
      this.view.webContents.openDevTools({ mode: 'detach' });
    }

    this.view.webContents.on('did-fail-load', (_e, code, desc) => {
      if (code === -3) return; // aborted by our own disconnect(), ignore
      this._setStatus('error', `Không tải được trang chat (${desc}).`);
    });

    // Electron app) so YouTube's badge/member aria-labels ("Thành viên (6
    // tháng)"...) come back in a known, parseable language regardless of
    const chatUrl = `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&embed_domain=localhost&hl=vi&persist_hl=1`;
    try {
      await this.view.webContents.loadURL(chatUrl, {
        extraHeaders: 'Accept-Language: vi-VN,vi;q=0.9\n',
      });
    } catch (err) {
      this._setStatus('error', 'Không tải được trang chat.');
      return { ok: false, error: 'load_failed' };
    }

    return { ok: true, videoId };
  }

  async disconnect() {
    if (!this.view) return;
    try {
      this.view.webContents.send('capturer:stop');
    } catch (_e) {
      /* view may already be gone */
    }
    try {
      this.mainWindow.removeBrowserView(this.view);
    } catch (_e) {
      /* no-op */
    }
    this.view = null;
    this.videoId = null;
    this._resetDeletionTracking();
    this._setStatus('idle');
  }
}

module.exports = { CaptureManager, parseVideoId, parseChannelLiveUrl };
