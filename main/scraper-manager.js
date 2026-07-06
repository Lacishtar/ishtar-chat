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

class ScraperManager extends EventEmitter {
  constructor(mainWindow) {
    super();
    this.mainWindow = mainWindow;
    this.view = null;
    this.videoId = null;
    this.status = 'idle'; // idle | connecting | connected | stale | error
    this._bindIpc();
  }

  _bindIpc() {
    ipcMain.on('scraper:batch', (event, rawBatch) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      const messages = rawBatch.map(normalizeMessage);
      messages.forEach((m) => this.emit('message', m));
    });

    ipcMain.on('scraper:started', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus('connected');
    });

    ipcMain.on('scraper:selector-error', (event, message) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus('error', message);
    });

    ipcMain.on('scraper:container-not-found', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      this._setStatus(
        'error',
        'Không tìm thấy khung chat. Video có thể không phải livestream đang có chat, hoặc YouTube đã đổi giao diện.'
      );
    });

    ipcMain.on('scraper:stale', (event) => {
      if (!this.view || event.sender !== this.view.webContents) return;
      if (this.status === 'connected') this._setStatus('stale');
    });
  }

  _setStatus(status, error) {
    this.status = status;
    this.emit('status', { status, error: error || null, videoId: this.videoId });
  }

  async connect(rawUrl) {
    const videoId = parseVideoId(rawUrl);
    if (!videoId) {
      this._setStatus('error', 'Link không đúng định dạng YouTube live/watch.');
      return { ok: false, error: 'invalid_url' };
    }

    await this.disconnect();

    this.videoId = videoId;
    this._setStatus('connecting');

    this.view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'scraper-preload.js'),
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
      this.view.webContents.send('scraper:init', selectorsConfig);
    });

    this.view.webContents.on('did-fail-load', (_e, code, desc) => {
      if (code === -3) return; // aborted by our own disconnect(), ignore
      this._setStatus('error', `Không tải được trang chat (${desc}).`);
    });

    const chatUrl = `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&embed_domain=localhost`;
    try {
      await this.view.webContents.loadURL(chatUrl);
    } catch (err) {
      this._setStatus('error', 'Không tải được trang chat.');
      return { ok: false, error: 'load_failed' };
    }

    return { ok: true, videoId };
  }

  async disconnect() {
    if (!this.view) return;
    try {
      this.view.webContents.send('scraper:stop');
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

module.exports = { ScraperManager, parseVideoId };
