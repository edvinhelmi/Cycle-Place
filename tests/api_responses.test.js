const request = require('supertest');
const app = require('../app');

describe('API Contract Verification', () => {

    test('GET /api/v1/config restituisce googleClientId', async () => {
        const res = await request(app).get('/api/v1/config');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('googleClientId');
        expect(typeof res.body.googleClientId).toBe('string');
    });

    test('GET /api/v1/rastrelliere restituisce FeatureCollection GeoJSON', async () => {
        const res = await request(app).get('/api/v1/rastrelliere');
        expect(res.statusCode).toBe(200);
        expect(res.body.type).toBe('FeatureCollection');
        expect(Array.isArray(res.body.features)).toBe(true);
    });

    test('POST /api/v1/login restituisce 400 se i campi sono vuoti', async () => {
        const res = await request(app)
            .post('/api/v1/login')
            .send({});
        
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});