const express = require('express');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsprint-super-secret-2026';

// Updated to match your Docker Service Names
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://stock-service:3002';

// Metrics Storage
const metrics = {
    total_orders: 0,
    cache_rejections: 0,
    forwarded_to_stock: 0,
    failures: 0,
    total_latency: 0,
    redis_latency: 0,
    redis_ops: 0
};

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
    const orderId = crypto.randomUUID();
    const start = Date.now();

    try {
        // 1. High-Speed Cache Check
        const redisStart = Date.now();
        const stockStr = await redisClient.get(`stock:${item_id}`);
        metrics.redis_latency += (Date.now() - redisStart);
        metrics.redis_ops++;
        
        if (stockStr !== null && parseInt(stockStr) < quantity) {
            metrics.total_orders++;
            metrics.cache_rejections++;
            metrics.total_latency += (Date.now() - start);
            return res.status(400).json({ detail: "Order rejected instantly by cache: Insufficient stock." });
        }

        // 2. Forward to Stock Service
        metrics.forwarded_to_stock++;
        const stockResponse = await axios.post(`${STOCK_SERVICE_URL}/stock/reduce`, {
            item_id: item_id,
            quantity: quantity,
            order_id: orderId
        });

        // 3. FIX: Safely extract the student ID from the token
        // This looks for 'student_id', 'id', or 'sub' to avoid sending 'undefined'
        const studentId = req.user.student_id || req.user.id || req.user.sub;

        // 4. Drop order into the Kitchen Queue
        const orderPayload = JSON.stringify({ 
            order_id: orderId,
            student_id: studentId, 
            item_id: item_id 
        });
        
        await redisClient.lPush('kitchen_orders', orderPayload);

        metrics.total_orders++;
        metrics.total_latency += (Date.now() - start);
        return res.status(200).json({
            message: "Order successfully verified and routed",
            order_id: orderId,
            student: studentId,
            stock_status: stockResponse.data
        });

    } catch (error) {
        metrics.total_orders++;
        metrics.total_latency += (Date.now() - start);

        if (error.response && error.response.status === 400) {
            return res.status(400).json(error.response.data);
        }
        
        metrics.failures++; // Count 500s/timeouts as system failures
        console.error("Gateway routing error:", error.message);
        return res.status(500).json({ detail: "Internal Gateway Error" });
    }
});

// ---------------------------------------------------------
// STOCK MANAGEMENT PROXY
// ---------------------------------------------------------
app.get('/api/stock', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${STOCK_SERVICE_URL}/stock`);
        res.json(response.data);
    } catch (e) {
        res.status(e.response?.status || 500).json(e.response?.data || { error: "Failed to fetch stock list" });
    }
});

app.get('/api/stock/:id', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${STOCK_SERVICE_URL}/stock/${req.params.id}`);
        res.json(response.data);
    } catch (e) {
        res.status(e.response?.status || 500).json(e.response?.data || { error: "Failed to fetch stock" });
    }
});

app.post('/api/stock/increase', authenticateToken, async (req, res) => {
    try {
        const response = await axios.post(`${STOCK_SERVICE_URL}/stock/increase`, req.body);
        // Invalidate cache so next order gets fresh data
        await redisClient.del(`stock:${req.body.item_id}`);
        res.json(response.data);
    } catch (e) {
        res.status(e.response?.status || 500).json(e.response?.data || { error: "Failed to increase stock" });
    }
});

// Metrics Endpoint
app.get('/metrics', (req, res) => {
    const avg_latency = metrics.total_orders > 0 
        ? metrics.total_latency / metrics.total_orders 
        : 0;
    
    const avg_redis_latency = metrics.redis_ops > 0
        ? metrics.redis_latency / metrics.redis_ops
        : 0;
    
    res.json({
        total_orders: metrics.total_orders,
        cache_rejections: metrics.cache_rejections,
        forwarded_to_stock: metrics.forwarded_to_stock,
        failures: metrics.failures,
        average_latency_ms: parseFloat(avg_latency.toFixed(2)),
        average_redis_latency_ms: parseFloat(avg_redis_latency.toFixed(2))
    });
});

// Health Endpoint
app.get('/health', async (req, res) => {
    try {
        if (!redisClient || !redisClient.isOpen) throw new Error('Redis connection lost');
        await redisClient.ping();
        res.status(200).json({ status: 'healthy', service: 'Order Gateway', redis: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'unhealthy', service: 'Order Gateway', error: error.message });
    }
});

// Chaos Toggle
app.post('/api/kill', authenticateToken, (req, res) => {
    console.error("💀 CHAOS INITIATED: Shutting down Gateway...");
    res.status(200).json({ message: "Gateway going down!" });
    setTimeout(() => {
        process.exit(1); 
    }, 500);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Order Gateway running on port ${PORT}`);
    });
}

module.exports = app;