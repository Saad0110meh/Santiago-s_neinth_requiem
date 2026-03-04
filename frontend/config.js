// Global Configuration for API Endpoints
const CONFIG = {
    GATEWAY_URL: 'http://localhost:3000',
    IDENTITY_URL: 'http://localhost:3001',
    STOCK_URL: 'http://localhost:3002',
    KITCHEN_URL: 'http://localhost:3003',
    NOTIFICATION_URL: 'http://localhost:3004'
};

// Environment Detection (Optional: Auto-switch for Production)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('Running in production mode');
    // Uncomment and set your Railway/Production URLs here:
    /*
    CONFIG.GATEWAY_URL = 'https://order-gateway-production.up.railway.app';
    CONFIG.IDENTITY_URL = 'https://identity-provider-production.up.railway.app';
    CONFIG.STOCK_URL = 'https://stock-service-production.up.railway.app';
    CONFIG.KITCHEN_URL = 'https://kitchen-queue-production.up.railway.app';
    CONFIG.NOTIFICATION_URL = 'https://notification-hub-production.up.railway.app';
    */
}