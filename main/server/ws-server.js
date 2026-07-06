const WebSocket = require('ws');

/**
 * @param {import('http').Server} httpServer
 * @param {() => object} getInitialPayload  returns { theme, config } sent right on connect
 */
function attachWebSocketServer(httpServer, getInitialPayload) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/overlay/socket' });

  wss.on('connection', (socket) => {
    const initial = getInitialPayload();
    socket.send(JSON.stringify({ type: 'theme:changed', data: initial }));
  });

  function broadcast(type, data) {
    const payload = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  return { wss, broadcast };
}

module.exports = { attachWebSocketServer };
