const express = require('express');
const redis = require('redis');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3003;

// Corrected Service Names for Docker Network
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://notification-hub:3004';

// Metrics Storage
const metrics = {
    total_orders: 0,
    active_orders: 0, // Now represents concurrent processing count
    failures: 0,
    total_processing_time: 0,
    queue_occupancy: 0 // Redis Queue Length
};

const MAX_CONCURRENT_ORDERS = 50; // Limit processing capacity
const MAX_QUEUE_CAPACITY = 50; // For percentage calculation
let redisClient;

async function connectRedis() {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    await redisClient.connect();

    console.log("Kitchen connected to Redis. Waiting for orders...");
    processQueue();
}

async function processQueue() {
    while (true) {
        try {
            // 1. Update Queue Occupancy Metric
            const len = await redisClient.lLen('kitchen_orders');
            metrics.queue_occupancy = Math.min(Math.round((len / MAX_QUEUE_CAPACITY) * 100), 100);

            // 2. Concurrency Control: If full, wait before taking new orders
            if (metrics.active_orders >= MAX_CONCURRENT_ORDERS) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            // 3. Fetch Order (Blocking with timeout to allow loop to re-check concurrency)
            const result = await redisClient.blPop('kitchen_orders', 1);
            
            if (result) {
                metrics.active_orders++;
                const order = JSON.parse(result.element);
                
                // Process asynchronously to allow concurrency
                processOrder(order).finally(() => {
                    metrics.active_orders--;
                });
            }
        } catch (error) {
            console.error("Queue processing error:", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function processOrder(order) {
    const start = Date.now();
    const studentId = order.student_id;
    console.log(`[x] KITCHEN: Processing Prepackaged Order for Student ${studentId}`);

    try {
        // 1. Notify Hub: "Processing"
        await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
            student_id: studentId,
            status: "Processing",
            message: "Your prepackaged meal is being retrieved.",
            order_id: order.order_id,
            item_id: order.item_id
        }).catch(err => console.error("Failed to notify hub (Processing):", err.message));

        // Simulation: Retrieval time (faster than cooking)
        const processingTime = Math.floor(Math.random() * 4000) + 3000; // 3-7 seconds
        await new Promise(resolve => setTimeout(resolve, processingTime));

        // Metrics Update
        metrics.total_orders++;
        metrics.total_processing_time += (Date.now() - start);

        console.log(`[v] KITCHEN: Order Ready for Student ${studentId}!`);

        // 2. Notify Hub: "Ready"
        await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
            student_id: studentId,
            status: "Ready",
            message: "Your Iftar is ready for pickup!",
            order_id: order.order_id,
            item_id: order.item_id
        });
    } catch (err) {
        metrics.failures++;
        console.error("Order processing failed:", err.message);
    }
}

app.get('/metrics', (req, res) => {
    const avg_time = metrics.total_orders > 0 
        ? metrics.total_processing_time / metrics.total_orders 
        : 0;

    res.json({
        total_orders: metrics.total_orders,
        order_processing_count: metrics.active_orders,
        queue_occupancy: metrics.queue_occupancy,
        failures: metrics.failures,
        average_processing_time_ms: parseFloat(avg_time.toFixed(2))
    });
});

app.get('/health', async (req, res) => {
    try {
        if (!redisClient || !redisClient.isOpen) throw new Error('Redis connection lost');
        await redisClient.ping();
        res.status(200).json({ status: 'healthy', service: 'Kitchen Queue', redis: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'unhealthy', service: 'Kitchen Queue', error: error.message });
    }
});

app.post('/api/kill', (req, res) => {
    console.error("💀 CHAOS INITIATED: Shutting down Kitchen Queue...");
    res.status(200).json({ message: "Kitchen Queue going down!" });
    setTimeout(() => {
        process.exit(1);
    }, 500);
});

if (require.main === module) {
    connectRedis().catch(err => console.error("Failed to connect to Redis:", err));
    app.listen(PORT, () => {
        console.log(`Kitchen Queue service running on port ${PORT}`);
    });
}

module.exports = app;