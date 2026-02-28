const express = require('express');
const redis = require('redis');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3003;

// Corrected Service Names for Docker Network
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://notification-hub:3004';

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
                
                console.log(`[v] KITCHEN: Order Ready for Student ${studentId}!`);
                
                // 2. Notify Hub: "Ready"
                await axios.post(`${NOTIFICATION_URL}/internal/notify`, {
                    student_id: studentId,
                    status: "Ready",
                    message: "Your Iftar is ready for pickup!"
                }).catch(err => console.error("Failed to notify hub (Ready):", err.message));
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