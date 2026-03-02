const request = require('supertest');
const app = require('./index');

// Mock Redis to prevent connection attempts during tests
jest.mock('redis', () => ({
    createClient: () => ({
        on: jest.fn(),
        connect: jest.fn(),
        get: jest.fn(),
        lPush: jest.fn(),
        isOpen: true,
        ping: jest.fn().mockResolvedValue('PONG')
    })
}));

// Mock Axios to prevent network calls
jest.mock('axios');

describe('Order Gateway Security', () => {
    it('should reject requests without a token (401)', async () => {
        const res = await request(app)
            .post('/api/order')
            .send({ item_id: 1, quantity: 1 });
        
        expect(res.statusCode).toEqual(401);
        expect(res.body.detail).toMatch(/missing/i);
    });

    it('should reject requests with an invalid token (401)', async () => {
        const res = await request(app)
            .post('/api/order')
            .set('Authorization', 'Bearer invalid-token-123')
            .send({ item_id: 1, quantity: 1 });
        
        expect(res.statusCode).toEqual(401);
        expect(res.body.detail).toMatch(/invalid/i);
    });
});
