const WebSocket = require('ws');
let wss;
let clients = [];

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log("📡 Cliente conectado ao WebSocket");
    clients.push(ws);

    ws.on('close', () => {
      clients = clients.filter(c => c !== ws);
    });
  });
}

function sendSolarData(data) {
  clients.forEach(ws => ws.send(JSON.stringify(data)));
}

module.exports = { initWebSocket, sendSolarData };
