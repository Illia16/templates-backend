const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
let count = 0;
wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {
    const parsed = JSON.parse(data);
    console.log('parsedData: %s', parsed);
    count = count+Number(parsed.index)

    const message = `Current count is: ${count}`;
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  });

  ws.send('current count is:', count);
});