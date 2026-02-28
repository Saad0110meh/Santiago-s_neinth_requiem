const express = require('express');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3003;
const REDIS_URL = process.env.REDIS_URL || 'redis://cafeteria-redis:6379';

let redisClient;

async function connectRedis() {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    await redisClient.connect();
    console.log("Kitchen connected to Redis. Waiting for orders...");
    
    // Start the background worker loop
    processQueue();
}

// ---------------------------------------------------------
// CORE REQUIREMENT: Asynchronous Order Processing
// ---------------------------------------------------------
async function processQueue() {
    while (true) {
        try {
            // Wait for an order to be pushed to the 'kitchen_orders' list
            const result = await redisClient.blPop('kitchen_orders', 0);
            
            if (result) {
                const order = JSON.parse(result.element);
                console.log(`[x] KITCHEN: Received Order for Student ${order.student_id} (Item: ${order.item_id})`);
                
                // Simulate time-intensive cooking/preparation process (3-7s)
                const cookingTime = Math.floor(Math.random() * (7000 - 3000 + 1) + 3000);
                await new Promise(resolve => setTimeout(resolve, cookingTime));
                
                console.log(`[v] KITCHEN: Order Ready for Student ${order.student_id}! (Took ${cookingTime/1000}s)`);
                
                // (In the final phase, we will tell the Notification Hub to alert the student here)
            }
        } catch (error) {
            console.error("Queue processing error:", error);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pause briefly on error before retrying
        }
    }
}

connectRedis();

// ---------------------------------------------------------
// OBSERVABILITY: Health Endpoint 
// ---------------------------------------------------------
// Must return 200 OK if reachable[cite: 40].
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'Kitchen Queue' });
});

app.listen(PORT, () => {
    console.log(`Kitchen Queue service running on port ${PORT}`);
});