const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { createAvatarProxyRouter } = require('./avatar-proxy');
const { createImageProxyRouter } = require('./image-proxy');
const { createSharedEsmRouter } = require('./shared-esm-bridge');

const OVERLAY_DIR = path.join(__dirname, '..', '..', 'overlay');
const OVERLAY_TEMPLATE = fs.readFileSync(path.join(OVERLAY_DIR, 'index.html'), 'utf-8');
const CREDITS_TEMPLATE = fs.readFileSync(path.join(OVERLAY_DIR, 'credits.html'), 'utf-8');

const NO_CACHE_STATIC = {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
};

function createApp(getState, options = {}) {
  const app = express();

  app.get('/overlay', (req, res) => {
    const {
      themeId,
      config,
      layoutConfig,
      history,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
    } = getState();
    const initialState = {
      theme: themeId,
      themeId,
      config,
      layoutConfig,
      slotStyleConfig,
      animationConfig,
      decorationConfig,
      roleStyleConfig,
      fanServiceConfig,
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

  // Stream Credits — a second, independent OBS Browser Source. Static HTML
  // shell (no server-side templating needed) + a same-origin JSON endpoint
  // it polls itself; keeps this fully decoupled from the chat overlay above.
  app.get('/overlay/credits', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(CREDITS_TEMPLATE);
  });

  app.get('/overlay/credits/data', (req, res) => {
    const creditsState = options.getCreditsState
      ? options.getCreditsState()
      : { sections: [], snapshots: {} };
    res.setHeader('Cache-Control', 'no-store');
    res.json(creditsState);
  });

  // Serves overlay-client.js (and anything else dropped in /overlay) as
  // static files — this is what actually answers GET /overlay/overlay-client.js.
  app.use('/overlay', express.static(OVERLAY_DIR, NO_CACHE_STATIC));
  app.use('/shared', createSharedEsmRouter());
  app.use('/avatar', createAvatarProxyRouter());
  app.use('/image', createImageProxyRouter());

  app.get('/health', (req, res) => res.json({ ok: true }));

  return app;
}

// Starts listening, trying successive ports if the preferred one is busy —
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
