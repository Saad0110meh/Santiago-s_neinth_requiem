const express = require('express');
const redis = require('redis');
const axios = require('axios'); // NEW

const app = express();
const PORT = process.env.PORT || 3003;
const REDIS_URL = process.env.REDIS_URL || 'redis://cafeteria-redis:6379';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://cafeteria-notifications:3004'; // NEW

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
            const result = await redisClient.blPop('kitchen_orders', 0);
            
            if (result) {
                const order = JSON.parse(result.element);
                console.log(`[x] KITCHEN: Received Order for Student ${order.student_id}`);
                
                // 1. Notify student that order is In Kitchen
                await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
                    student_id: order.student_id,
                    status: "In Kitchen",
                    message: "Your food is being prepared!"
                }).catch(err => console.error("Failed to notify hub:", err.message));

                // Simulate time-intensive cooking process (3-7s)
                const cookingTime = Math.floor(Math.random() * (7000 - 3000 + 1) + 3000);
                await new Promise(resolve => setTimeout(resolve, cookingTime));
                
                console.log(`[v] KITCHEN: Order Ready for Student ${order.student_id}!`);
                
                // 2. Notify student that order is Ready
                await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
                    student_id: order.student_id,
                    status: "Ready",
                    message: "Your Iftar is ready for pickup!"
                }).catch(err => console.error("Failed to notify hub:", err.message));
            }
        } catch (error) {
            console.error("Queue processing error:", error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

connectRedis();

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'Kitchen Queue' });
});

app.listen(PORT, () => {
    console.log(`Kitchen Queue service running on port ${PORT}`);
});