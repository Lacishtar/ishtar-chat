const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { app, BrowserView, ipcMain } = require('electron');
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
      const prefix = '[capture-view]';
      if (level >= 2) {
        console.warn(prefix, message);
      } else {
        console.log(prefix, message);
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
    this._setStatus('idle');
  }
}

module.exports = { CaptureManager, parseVideoId, parseChannelLiveUrl };
