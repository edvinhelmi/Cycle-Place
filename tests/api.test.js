const request = require('supertest');
const app = require('../app');

describe('Public & Data Web APIs (Cycle Place)', () => {

    test('GET /api/v1/rastrelliere - Should return 200 and a GeoJSON FeatureCollection', async () => {
        const response = await request(app).get('/api/v1/rastrelliere');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('type', 'FeatureCollection');
        expect(Array.isArray(response.body.features)).toBe(true);
        expect(response.body.features.length).toBeGreaterThan(0);

        const firstFeature = response.body.features[0];
        expect(firstFeature).toHaveProperty('geometry');
        expect(firstFeature).toHaveProperty('properties');
        expect(firstFeature.geometry).toHaveProperty('coordinates');
    });

    test('GET /api/v1/parcheggi - Should return 200 and a GeoJSON FeatureCollection', async () => {
        const response = await request(app).get('/api/v1/parcheggi');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('type', 'FeatureCollection');
        expect(Array.isArray(response.body.features)).toBe(true);
        expect(response.body.features.length).toBeGreaterThan(0);
    });

    test('GET /api/v1/config - Should return client configuration keys', async () => {
        const response = await request(app).get('/api/v1/config');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('googleClientId');
    });

    test('GET /api/v1/routing - Should calculate route between two coordinates in Trento', async () => {
        const response = await request(app)
            .get('/api/v1/routing')
            .query({
                startLat: 46.0697,
                startLng: 11.1211,
                endLat: 46.0710,
                endLng: 11.1230,
                profile: 'cycling-regular',
                language: 'it'
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('type', 'FeatureCollection');
        expect(response.body.features.length).toBeGreaterThan(0);
        const feature = response.body.features[0];
        expect(feature).toHaveProperty('geometry');
        expect(feature.properties).toHaveProperty('segments');
    }, 10000);

    test('Protected routes should reject unauthenticated requests (HTTP 401)', async () => {
        const meRes = await request(app).get('/api/v1/user/me');
        expect(meRes.status).toBe(401);

        const favRes = await request(app).get('/api/v1/user/preferiti');
        expect(favRes.status).toBe(401);

        const postFavRes = await request(app).post('/api/v1/user/preferiti').send({ rastrellieraId: 1 });
        expect(postFavRes.status).toBe(401);

        const segnRes = await request(app).post('/api/v1/segnalazioni').send({ rastrellieraId: 1, tipo: 'vandalismo' });
        expect(segnRes.status).toBe(401);
    });

});
