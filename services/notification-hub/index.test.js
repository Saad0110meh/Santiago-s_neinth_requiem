const request = require('supertest');
const server = require('./index');

describe('Notification Hub Service', () => {
    it('should return health status', async () => {
        const res = await request(server).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual('healthy');
    });

    it('should accept internal notifications', async () => {
        const res = await request(server)
            .post('/internal/notify')
            .send({
                student_id: '123',
                status: 'Test',
                message: 'Hello'
            });
        expect(res.statusCode).toEqual(200);
    });
});
