const express = require('express');
const redis = require('redis');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3003;

// Corrected Service Names for Docker Network
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://notification-hub:3004';

// Metrics Storage
const metrics = {
    total_orders: 0,
    active_orders: 0,
    failures: 0,
    total_cooking_time: 0,
    burned_meals: 0 // Creative Metric: Randomly incremented to simulate kitchen mishaps
};

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
            metrics.active_orders = 0; // Waiting state
            const result = await redisClient.blPop('kitchen_orders', 0);
            metrics.active_orders = 1; // Cooking state
            
            if (result) {
                const start = Date.now();
                const order = JSON.parse(result.element);
                const studentId = order.student_id; // Now correctly passed from Gateway!
                
                console.log(`[x] KITCHEN: Received Order for Student ${studentId}`);
                
                // 1. Notify Hub: "In Kitchen"
                await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
                    student_id: studentId,
                    status: "In Kitchen",
                    message: "Your food is being prepared!"
                }).catch(err => console.error("Failed to notify hub (In Kitchen):", err.message));

                // Cooking Simulation
                const cookingTime = Math.floor(Math.random() * 4000) + 3000;
                await new Promise(resolve => setTimeout(resolve, cookingTime));
                
                // Metrics Update
                const duration = Date.now() - start;
                metrics.total_orders++;
                metrics.total_cooking_time += duration;

                // Creative Metric: 5% chance to burn a meal
                if (Math.random() < 0.05) {
                    metrics.burned_meals++;
                }

                console.log(`[v] KITCHEN: Order Ready for Student ${studentId}!`);
                
                // 2. Notify Hub: "Ready"
                await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
                    student_id: studentId,
                    status: "Ready",
                    message: "Your Iftar is ready for pickup!"
                }).catch(err => console.error("Failed to notify hub (Ready):", err.message));
            }
        } catch (error) {
            metrics.failures++;
            console.error("Queue processing error:", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

app.get('/metrics', (req, res) => {
    const avg_time = metrics.total_orders > 0 
        ? metrics.total_cooking_time / metrics.total_orders 
        : 0;

    res.json({
        total_orders: metrics.total_orders,
        active_orders: metrics.active_orders,
        failures: metrics.failures,
        burned_meals: metrics.burned_meals,
        average_cooking_time_ms: parseFloat(avg_time.toFixed(2))
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

if (require.main === module) {
    connectRedis();
    app.listen(PORT, () => {
        console.log(`Kitchen Queue service running on port ${PORT}`);
    });
}

module.exports = app;