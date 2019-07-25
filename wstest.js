const express = require("express");
const WebSocket = require('ws');
const url = require('url');

const app = express();

app.get('/', (req, res) => {
    res.send("HELLO WORLD")
})
const server = app.listen(7777, () => {
    console.log('Server listening', server);
})

const wss = new WebSocket.Server({ noServer: true });
 
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    ws.send(message)
  });
 
  ws.send('something');
});

server.on('upgrade', function upgrade(request, socket, head) {
    const pathname = url.parse(request.url).pathname;
   
    if (pathname === '/foo') {
      wss1.handleUpgrade(request, socket, head, function done(ws) {
        wss1.emit('connection', ws, request);
      });
    } else if (pathname === '/bar') {
      wss2.handleUpgrade(request, socket, head, function done(ws) {
        wss2.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });