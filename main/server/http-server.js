const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { createAvatarProxyRouter } = require('./avatar-proxy');

const OVERLAY_DIR = path.join(__dirname, '..', '..', 'overlay');
const THEMES_DIR = path.join(__dirname, '..', '..', 'themes');
const OVERLAY_TEMPLATE = fs.readFileSync(path.join(OVERLAY_DIR, 'index.html'), 'utf-8');

/**
 * @param {() => object} getState
 * @param {number} preferredPort
 * @param {{ bubbleAssetsDir?: string }} [options]
 */
function createApp(getState, options = {}) {
  const app = express();

  app.get('/overlay', (req, res) => {
    const { themeId, config, layoutConfig, sessionId, history, slotStyleConfig, animationConfig } = getState();
    const initialState = {
      theme: themeId,
      themeId,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      session: sessionId,
      history,
    };
    const html = OVERLAY_TEMPLATE.replace(
      '/*OVS_INITIAL_STATE*/ {}',
      JSON.stringify(initialState)
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  });

  // Serves overlay-client.js (and anything else dropped in /overlay) as
  // static files — this is what actually answers GET /overlay/overlay-client.js.
  app.use('/overlay', express.static(OVERLAY_DIR));
  app.use('/themes', express.static(THEMES_DIR));
  app.use('/avatar', createAvatarProxyRouter());

  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

/**
 * Starts listening, trying successive ports if the preferred one is busy —
 * there's no multi-tenant server here, so a free local port is all we need.
 */
function startServer(getState, preferredPort = 3000, maxAttempts = 10, options = {}) {
  return new Promise((resolve, reject) => {
    const app = createApp(getState, options);
    const server = http.createServer(app);

    let attempt = 0;

    const tryListen = (port) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
          attempt += 1;
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        server.removeAllListeners('error');
        resolve({ app, server, port });
      });
    };

    tryListen(preferredPort);
  });
}

module.exports = { startServer };
