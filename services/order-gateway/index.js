const express = require('express');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsprint-super-secret-2026';
// Use Docker network hostnames to talk to other containers!
const REDIS_URL = process.env.REDIS_URL || 'redis://cafeteria-redis:6379';
const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://cafeteria-stock:3002';

let redisClient;

async function connectRedis() {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    await redisClient.connect();
}
connectRedis();

// ---------------------------------------------------------
// CORE REQUIREMENT: Token Handshake Validation
// ---------------------------------------------------------
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ detail: "Unauthorized: Missing bearer token" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ detail: "Unauthorized: Invalid token" });
        req.user = user;
        next();
    });
};

// ---------------------------------------------------------
// CORE REQUIREMENT: Primary Entry Point & Cache Check
// ---------------------------------------------------------
app.post('/api/order', authenticateToken, async (req, res) => {
    const { item_id, quantity } = req.body;

    try {
        // 1. High-Speed Cache Check (Protects the Database!)
        const stockStr = await redisClient.get(`stock:${item_id}`);
        
        if (stockStr !== null && parseInt(stockStr) < quantity) {
            return res.status(400).json({ detail: "Order rejected instantly by cache: Insufficient stock." });
        }

        // 2. Forward to Stock Service for official atomic deduction
        const stockResponse = await axios.post(`${STOCK_SERVICE_URL}/deduct`, {
            item_id,
            quantity
        });

        // 3. Drop order into the Kitchen Queue (Asynchronous Processing)
        const orderPayload = JSON.stringify({ student_id: req.user.student_id, item_id });
        await redisClient.lPush('kitchen_orders', orderPayload);

        return res.status(200).json({
            message: "Order successfully verified and routed",
            student: req.user.student_id,
            stock_status: stockResponse.data
        });

    } catch (error) {
        // If the Stock Service rejects it (e.g., 400 Bad Request), pass that error to the user
        if (error.response && error.response.status === 400) {
            return res.status(400).json(error.response.data);
        }
        console.error("Gateway routing error:", error.message);
        return res.status(500).json({ detail: "Internal Gateway Error" });
    }
});

// Observability: Health Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'Order Gateway' });
});

//Chaos Toggle
app.post('/api/kill', (req, res) => {
    console.error("💀 CHAOS INITIATED: Shutting down Gateway...");
    res.status(200).json({ message: "Gateway going down!" });
    
    // Give it 500ms to send the response before literally killing the process
    setTimeout(() => {
        process.exit(1); 
    }, 500);
});

app.listen(PORT, () => {
    console.log(`Order Gateway running on port ${PORT}`);
});