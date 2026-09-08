const request = require('supertest');
const app = require('../app');

describe('Authentication & User Management APIs (Cycle Place)', () => {

    test('POST /api/v1/register - Should reject registration with empty required fields (HTTP 400)', async () => {
        const res = await request(app)
            .post('/api/v1/register')
            .send({
                name: '',
                surname: '',
                email: 'invalid-email',
                password: ''
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/v1/register - Should reject registration with weak password (HTTP 400)', async () => {
        const res = await request(app)
            .post('/api/v1/register')
            .send({
                name: 'Test',
                surname: 'User',
                email: 'test.weakpass@unitn.it',
                password: '123' // < 8 characters
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/v1/login - Should return 400 if email or password are missing', async () => {
        const res = await request(app)
            .post('/api/v1/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/v1/login - Should return 401 for incorrect credentials', async () => {
        const res = await request(app)
            .post('/api/v1/login')
            .send({
                email: 'utente.inesistente@unitn.it',
                password: 'PasswordSbagliata!123'
            });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/v1/refresh-token - Should return 401 if refresh token is missing', async () => {
        const res = await request(app)
            .post('/api/v1/refresh-token')
            .send({});

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    test('GET /api/v1/verify-reset-token - Should return 400 for invalid token', async () => {
        const res = await request(app)
            .get('/api/v1/verify-reset-token')
            .query({ token: 'token_falso_inesistente_12345' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

});
