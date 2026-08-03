const WebSocket = require('ws');

const HEARTBEAT_INTERVAL_MS = 30_000;

function attachWebSocketServer(httpServer, getInitialPayload) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/overlay/socket' });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    const initial = getInitialPayload();
    socket.send(JSON.stringify({ type: 'theme:changed', data: initial }));
  });

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch (_) {
        // socket closed between isAlive check and ping — safe to ignore
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeatTimer));

  function broadcast(type, data) {
    const payload = JSON.stringify({ type, data });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  return { wss, broadcast };
}

module.exports = { attachWebSocketServer };
