const path = require('path');
const { EventEmitter } = require('events');
const { BrowserView, ipcMain } = require('electron');
const selectorsConfig = require('./selectors.config.json');
const { normalizeMessage } = require('../shared/chat-message');

// A real, visible YouTube user agent — reduces the odds of the embed being
// served a degraded/no-JS chat frame. We don't spoof anything beyond the UA;
// no request forging, no rate abuse, just "look like a normal browser tab".
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

// Recognizes a *channel* URL (not a specific video/live URL) — /channel/UC…,
// /c/name, /user/name, or the modern /@handle form — and returns the
// channel's canonical "/live" URL. YouTube resolves that URL server-side:
// if the channel is currently streaming it redirects (301/302) to the
// active watch page; if not, it just serves the channel page itself. We
// exploit that redirect to turn "channel link" into "current live video id"
// without needing the YouTube Data API or a signed-in session.
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
    this._bindIpc();
  }

  _bindIpc() {
    ipcMain.on('capturer:batch', (event, rawBatch) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      const messages = rawBatch.map(normalizeMessage);
      messages.forEach((m) => this.emit('message', m));
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
  }

  _setStatus(status, error) {
    this.status = status;
    this.emit('status', { status, error: error || null, videoId: this.videoId });
  }

  // Probes a channel's "/live" URL with a throwaway hidden BrowserView (kept
  // off `this.view` so it never collides with disconnect()/the real capture
  // view) and reads the video id back out of wherever YouTube's redirect
  // lands. Resolves to null if the channel isn't currently live, or if the
  // probe fails/times out.
  //
  // YouTube doesn't consistently use a real HTTP 30x for this anymore — some
  // channel redirects now happen client-side (history.pushState/replaceState
  // after the page's JS reads its own ytInitialData), which never fires
  // Electron's `did-navigate` (that event is for full/document navigations
  // only). So we watch three independent signals and take whichever resolves
  // a video id first:
  //   1. did-navigate       — classic server-side redirect
  //   2. did-navigate-in-page — client-side pushState/replaceState redirect
  //   3. canonical link tag  — fallback read of the DOM once the page has
  //      settled, in case YouTube updates the address bar via a mechanism
  //      that doesn't fire either navigation event at all
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

      // Reads the canonical/og:url the page currently reports and tries to
      // pull a video id out of it. Used as a fallback after load settles,
      // and also re-checked shortly after each navigation event in case the
      // event fired before YouTube's JS finished updating the URL.
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

      // did-navigate fires once the main frame has finished navigating,
      // i.e. after any redirect chain has resolved — so getURL()/the event
      // arg here is already the final destination.
      probe.webContents.on('did-navigate', (_e, navigatedUrl) => {
        const videoId = parseVideoId(navigatedUrl);
        if (videoId) {
          finish(videoId);
        } else {
          // Landed on the plain channel/live page over HTTP — YouTube may
          // still redirect us client-side a moment later, so keep waiting
          // and double check the DOM once things settle.
          setTimeout(checkCanonical, 800);
        }
      });
      // Client-side redirect (history.pushState/replaceState) — same
      // document, so did-navigate never fires for this.
      probe.webContents.on('did-navigate-in-page', (_e, navigatedUrl) => {
        finish(parseVideoId(navigatedUrl));
      });
      probe.webContents.on('did-finish-load', () => {
        // Belt-and-suspenders: whatever mechanism YouTube used (or didn't
        // use) to update the URL, the canonical tag reflects the real
        // current video once the page has actually finished loading.
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

    // Attached but sized to 0×0 and never added visibly — the "hidden" part
    // of "hidden BrowserView". We still attach it to a window because
    // BrowserViews need a host window to run their renderer process.
    this.mainWindow.addBrowserView(this.view);
    this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    this.view.setAutoResize({ width: false, height: false });
    this.view.webContents.setAudioMuted(true);
    this.view.webContents.setUserAgent(CHROME_UA);

    this.view.webContents.on('did-finish-load', () => {
      this.view.webContents.send('capturer:init', selectorsConfig);
    });

    this.view.webContents.on('did-fail-load', (_e, code, desc) => {
      if (code === -3) return; // aborted by our own disconnect(), ignore
      this._setStatus('error', `Không tải được trang chat (${desc}).`);
    });

    // Force Vietnamese UI locale on this BrowserView only (not the whole
    // Electron app) so YouTube's badge/member aria-labels ("Thành viên (6
    // tháng)"...) come back in a known, parseable language regardless of
    // the host machine's OS/Chromium locale. `hl=vi` covers YouTube's own
    // ?hl= param; the Accept-Language header covers cases where YouTube
    // falls back to browser-negotiated language instead. `persist_hl=1`
    // keeps it from being overridden by the signed-in account's language
    // preference once a session cookie exists.
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
    // Electron has no public webContents.destroy(); removing it from the
    // window and dropping our reference is what lets it get GC'd. See
    // architecture doc §2.4 (Resource cleanup) for why this matters — a
    // BrowserView on youtube.com can hold 150-300MB.
    this.view = null;
    this.videoId = null;
    this._setStatus('idle');
  }
}

module.exports = { CaptureManager, parseVideoId, parseChannelLiveUrl };
