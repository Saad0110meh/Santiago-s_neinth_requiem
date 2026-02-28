const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// NEW: Middleware to parse incoming JSON from the Kitchen
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3004;

app.get('/', (req, res) => {
  res.send('Notification Hub is running and ready for cafeteria orders!');
});

// NEW: Internal API for microservices to trigger push notifications
app.post('/internal/notify', (req, res) => {
  const { student_id, status, message } = req.body;
  console.log(`[HUB] Broadcasting '${status}' to student ${student_id}`);
  
  // Broadcast the update via WebSocket
  io.emit('order_update', { student_id, status, message });
  res.status(200).json({ success: true });
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