const request = require('supertest');
const app = require('./index');

// Mock Redis and Axios to prevent side effects
jest.mock('redis', () => ({
    createClient: () => ({
        on: jest.fn(),
        connect: jest.fn(),
        isOpen: true,
        ping: jest.fn().mockResolvedValue('PONG')
    })
}));
jest.mock('axios');

describe('Kitchen Queue Service', () => {
    it('should return metrics structure correctly', async () => {
        const res = await request(app).get('/metrics');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('total_orders');
        expect(res.body).toHaveProperty('active_orders');
        expect(res.body).toHaveProperty('burned_meals');
    });

    it('should return 503 for health check when redis is not initialized (test mode)', async () => {
        // In test mode, connectRedis() is not called, so redisClient is undefined.
        // This confirms the health check logic correctly identifies a missing connection.
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(503);
    });
});
