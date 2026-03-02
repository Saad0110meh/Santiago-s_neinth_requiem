const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// NEW: Middleware to parse incoming JSON from the Kitchen
app.use(express.json());
app.use(cors());

// Metrics
const metrics = {
    notifications_sent: 0,
    connected_clients: 0,
    uptime_start: Date.now()
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3004;

app.get('/', (req, res) => {
  res.send('Notification Hub is running and ready for cafeteria orders!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'Notification Hub' });
});

app.get('/metrics', (req, res) => {
    res.json({
        ...metrics,
        uptime_seconds: (Date.now() - metrics.uptime_start) / 1000
    });
});

// NEW: Internal API for microservices to trigger push notifications
app.post('/internal/notify', (req, res) => {
  const { student_id, status, message, order_id, item_id } = req.body;
  console.log(`[HUB] Broadcasting '${status}' to student ${student_id}`);
  
  // Broadcast the update via WebSocket
  io.emit('order_update', { student_id, status, message, order_id, item_id });
  metrics.notifications_sent++;
  res.status(200).json({ success: true });
});

io.on('connection', (socket) => {
  metrics.connected_clients++;
  console.log('New client connected to Notification Hub:', socket.id);
  socket.on('disconnect', () => {
    metrics.connected_clients--;
    console.log('Client disconnected:', socket.id);
  });
});

if (require.main === module) {
    server.listen(PORT, () => {
      console.log('Notification Hub listening on port ' + PORT);
    });
}

module.exports = server; // Export for testing