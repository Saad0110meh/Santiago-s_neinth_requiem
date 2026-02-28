const express = require('express');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsprint-super-secret-2026';

// Updated to match your Docker Service Names
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://stock-service:3002';

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
        // 1. High-Speed Cache Check
        const stockStr = await redisClient.get(`stock:${item_id}`);
        
        if (stockStr !== null && parseInt(stockStr) < quantity) {
            return res.status(400).json({ detail: "Order rejected instantly by cache: Insufficient stock." });
        }

        // 2. Forward to Stock Service
        const stockResponse = await axios.post(`${STOCK_SERVICE_URL}/stock/reduce`, {
            item_id: item_id,
            quantity: quantity
        });

        // 3. FIX: Safely extract the student ID from the token
        // This looks for 'student_id', 'id', or 'sub' to avoid sending 'undefined'
        const studentId = req.user.student_id || req.user.id || req.user.sub;

        // 4. Drop order into the Kitchen Queue
        const orderPayload = JSON.stringify({ 
            student_id: studentId, 
            item_id: item_id 
        });
        
        await redisClient.lPush('kitchen_orders', orderPayload);

        return res.status(200).json({
            message: "Order successfully verified and routed",
            student: studentId,
            stock_status: stockResponse.data
        });

    } catch (error) {
        if (error.response && error.response.status === 400) {
            return res.status(400).json(error.response.data);
        }
        console.error("Gateway routing error:", error.message);
        return res.status(500).json({ detail: "Internal Gateway Error" });
    }
});

// Health Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'Order Gateway' });
});

// Chaos Toggle
app.post('/api/kill', (req, res) => {
    console.error("💀 CHAOS INITIATED: Shutting down Gateway...");
    res.status(200).json({ message: "Gateway going down!" });
    setTimeout(() => {
        process.exit(1); 
    }, 500);
});

app.listen(PORT, () => {
    console.log(`Order Gateway running on port ${PORT}`);
});