const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3004;

app.get('/', (req, res) => {
  res.send('Notification Hub is running and ready for cafeteria orders!');
});

io.on('connection', (socket) => {
  console.log('New client connected to Notification Hub:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log('Notification Hub listening on port ' + PORT);
});