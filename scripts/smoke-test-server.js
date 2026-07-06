// Exercises main/server/http-server.js + ws-server.js exactly as main/index.js
// wires them, without needing Electron/BrowserWindow at all.
const http = require('http');
const WebSocket = require('ws');
const { startServer } = require('../main/server/http-server');
const { attachWebSocketServer } = require('../main/server/ws-server');

function getState() {
  return {
    themeId: 'classic',
    config: { fontSize: 16, textColor: '#EAECEF', bubbleBg: 'rgba(22,25,31,0.72)' },
    sessionId: 'test-session',
  };
}

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

async function main() {
  const { server, port } = await startServer(getState, 3900);
  const { broadcast } = attachWebSocketServer(server, getState);
  console.log(`[smoke] server listening on ${port}`);

  const overlayRes = await get(`http://127.0.0.1:${port}/overlay?session=test-session`);
  console.log('[smoke] GET /overlay status:', overlayRes.status);
  if (overlayRes.status !== 200) throw new Error('overlay route failed');
  if (!overlayRes.body.includes('window.__OVS_INITIAL_STATE__')) {
    throw new Error('initial state placeholder not replaced correctly');
  }
  if (!overlayRes.body.includes('"themeId":"classic"') && !overlayRes.body.includes('classic')) {
    throw new Error('theme id missing from injected state');
  }
  console.log('[smoke] overlay HTML contains injected state ✔');

  const clientJsRes = await get(`http://127.0.0.1:${port}/overlay/overlay-client.js`);
  console.log('[smoke] GET /overlay/overlay-client.js status:', clientJsRes.status);
  if (clientJsRes.status !== 200) throw new Error('overlay-client.js static serve failed');

  const templateRes = await get(`http://127.0.0.1:${port}/themes/classic/template.html`);
  console.log('[smoke] GET /themes/classic/template.html status:', templateRes.status);
  if (templateRes.status !== 200) throw new Error('theme template static serve failed');

  const styleRes = await get(`http://127.0.0.1:${port}/themes/classic/style.css`);
  console.log('[smoke] GET /themes/classic/style.css status:', styleRes.status);
  if (styleRes.status !== 200) throw new Error('theme style static serve failed');

  const badAvatarRes = await get(`http://127.0.0.1:${port}/avatar/proxy?url=https://evil.example/a.png`);
  console.log('[smoke] GET /avatar/proxy (blocked host) status:', badAvatarRes.status);
  if (badAvatarRes.status !== 400) throw new Error('avatar proxy should reject non-YouTube hosts');
  console.log('[smoke] avatar proxy host guard ✔');

  // WebSocket round trip: connect, expect initial theme:changed, then a
  // broadcasted chat:new.
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/overlay/socket`);
    let gotInitial = false;

    ws.on('open', () => console.log('[smoke] ws connected'));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!gotInitial && msg.type === 'theme:changed') {
        gotInitial = true;
        console.log('[smoke] received initial theme:changed ✔');
        broadcast('chat:new', { id: '1', author: 'test', messageHtml: 'hi' });
      } else if (msg.type === 'chat:new') {
        console.log('[smoke] received broadcasted chat:new ✔');
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('ws test timed out')), 5000);
  });

  console.log('[smoke] ALL CHECKS PASSED');
  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
