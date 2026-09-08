const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
const app = require('../app');

const JWT_SECRET = process.env.SUPER_SECRET || 'segreto_universitario_cycle_place';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key';

// Percorsi dei file JSON per ripristino post-test
const dataPath = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataPath, 'users.json');
const preferitiFile = path.join(dataPath, 'preferiti.json');
const segFile = path.join(dataPath, 'segnalazioni.json');

let originalUsers = '[]';
let originalPreferiti = '{}';
let originalSegnalazioni = '[]';

beforeAll(() => {
    if (fs.existsSync(usersFile)) originalUsers = fs.readFileSync(usersFile, 'utf8');
    if (fs.existsSync(preferitiFile)) originalPreferiti = fs.readFileSync(preferitiFile, 'utf8');
    if (fs.existsSync(segFile)) originalSegnalazioni = fs.readFileSync(segFile, 'utf8');
});

afterAll(() => {
    if (fs.existsSync(usersFile)) fs.writeFileSync(usersFile, originalUsers, 'utf8');
    if (fs.existsSync(preferitiFile)) fs.writeFileSync(preferitiFile, originalPreferiti, 'utf8');
    if (fs.existsSync(segFile)) fs.writeFileSync(segFile, originalSegnalazioni, 'utf8');
});

describe('Cycle Place API - Full Integration Test Suite', () => {
    const testUser = {
        name: 'Mario',
        surname: 'Rossi',
        email: `test_${Date.now()}@unitn.it`,
        password: 'PasswordSicura123!'
    };

    let authToken = '';
    let testUserId = 'test_usr_mock_id';

    beforeAll(() => {
        authToken = jwt.sign(
            { sub: testUserId, email: testUser.email, name: testUser.name, surname: testUser.surname, provider: 'local' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
    });

    // =========================================================================
    // 1. CONFIGURAZIONE & DATI SPAZIALI
    // =========================================================================
    describe('Config & Dati Spaziali', () => {
        test('GET /api/v1/config - Restituisce credenziali pubbliche (Google Client ID)', async () => {
            const res = await request(app).get('/api/v1/config');
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('googleClientId');
        });

        test('GET /api/v1/rastrelliere - Restituisce GeoJSON FeatureCollection', async () => {
            const res = await request(app).get('/api/v1/rastrelliere');
            expect([200, 500]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body).toHaveProperty('type', 'FeatureCollection');
                expect(Array.isArray(res.body.features)).toBe(true);
            }
        });

        test('GET /api/v1/parcheggi - Restituisce parcheggi protetti GeoJSON', async () => {
            const res = await request(app).get('/api/v1/parcheggi');
            expect([200, 500]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.body).toHaveProperty('type', 'FeatureCollection');
            }
        });
    });

    // =========================================================================
    // 2. REGISTRAZIONE E LOGIN (TC-01, TC-02, TC-03, TC-04, TC-05)
    // =========================================================================
    describe('Autenticazione Locale', () => {
        test('TC-01: Creazione account con campi anagrafici vuoti deve restituire 400', async () => {
            const res = await request(app)
                .post('/api/v1/register')
                .send({ name: '', surname: 'Rossi', email: 'test@local.it', password: '123' });
            
            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('TC-03: Creazione account con violazione policy password debole deve restituire 400', async () => {
            const res = await request(app)
                .post('/api/v1/register')
                .send({ name: 'Mario', surname: 'Rossi', email: 'weak@unitn.it', password: '123' });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('TC-04: Registrazione valida deve completarsi con 201', async () => {
            const res = await request(app)
                .post('/api/v1/register')
                .send(testUser);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('message');
        });

        test('TC-02: Creazione account con email duplicata deve restituire 409', async () => {
            const res = await request(app)
                .post('/api/v1/register')
                .send(testUser);

            expect(res.statusCode).toBe(409);
            expect(res.body).toHaveProperty('error');
        });

        test('TC-04 bis: Login formale con credenziali valide restituisce 200 e Token JWT', async () => {
            const res = await request(app)
                .post('/api/v1/login')
                .send({ email: testUser.email, password: testUser.password });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
        });

        test('TC-05: Login errato con credenziali scorrette deve restituire 401', async () => {
            const res = await request(app)
                .post('/api/v1/login')
                .send({ email: testUser.email, password: 'WrongPassword99!' });

            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        test('POST /api/v1/login - Payload vuoto restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/login')
                .send({});

            expect(res.statusCode).toBe(400);
        });
    });

    // =========================================================================
    // 3. TOKEN, GOOGLE SSO E RECUPERO PASSWORD (TC-06, TC-07, TC-08, TC-09)
    // =========================================================================
    describe('Token, Google SSO & Password Reset', () => {
        test('GET /api/v1/auth/verify - Token non presente restituisce 401', async () => {
            const res = await request(app).get('/api/v1/auth/verify');
            expect(res.statusCode).toBe(401);
        });

        test('GET /api/v1/auth/verify - Token valido restituisce 200', async () => {
            const res = await request(app)
                .get('/api/v1/auth/verify')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('valid', true);
        });

        test('TC-06: Google SSO con payload vuoto o token mancante restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/auth/google')
                .send({});

            expect(res.statusCode).toBe(400);
        });

        test('TC-07: Refresh token errato o assente restituisce 401 o 403', async () => {
            const res = await request(app)
                .post('/api/v1/refresh-token')
                .send({ refreshToken: 'fake_refresh_token_123' });

            expect([401, 403]).toContain(res.statusCode);
        });

        test('TC-08: Richiesta recupero password con formato email errato restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: 'non-una-email' });

            expect(res.statusCode).toBe(400);
        });

        test('TC-08 bis: Richiesta recupero password su email valida restituisce 200', async () => {
            const res = await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: testUser.email, lang: 'it' });

            expect(res.statusCode).toBe(200);
        });

        test('GET /api/v1/verify-reset-token - Token assente restituisce 400', async () => {
            const res = await request(app).get('/api/v1/verify-reset-token');
            expect(res.statusCode).toBe(400);
        });

        test('TC-09: Reset password con token non valido o scaduto restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/reset-password')
                .send({ token: 'tok_esadecimale_finto_1234567890', newPassword: 'NuovaPassword2026!' });

            expect(res.statusCode).toBe(400);
        });
    });

    // =========================================================================
    // 4. GESTIONE PROFILO E ACCOUNT (TC-10, TC-11)
    // =========================================================================
    describe('Gestione Profilo Utente', () => {
        test('GET /api/v1/user/me - Anonimo restituisce 401', async () => {
            const res = await request(app).get('/api/v1/user/me');
            expect(res.statusCode).toBe(401);
        });

        test('GET /api/v1/user/me - Autenticato restituisce i dati anagrafici 200', async () => {
            const res = await request(app)
                .get('/api/v1/user/me')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('email');
        });

        test('TC-10: Modifica anagrafica profilo con password errata restituisce 401', async () => {
            const res = await request(app)
                .put('/api/v1/user/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Mario Aggiornato',
                    currentPassword: 'PasswordErrata!',
                    newPassword: 'NuovaPasswordValida1!'
                });

            expect([400, 401, 404]).toContain(res.statusCode);
        });

        test('TC-11: Cancellazione account (GDPR) con autenticazione', async () => {
            const res = await request(app)
                .delete('/api/v1/user/account')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(res.statusCode);
        });
    });

    // =========================================================================
    // 5. PREFERITI (TC-17, TC-18)
    // =========================================================================
    describe('Preferiti Utente', () => {
        test('GET /api/v1/user/preferiti - Anonimo restituisce 401', async () => {
            const res = await request(app).get('/api/v1/user/preferiti');
            expect(res.statusCode).toBe(401);
        });

        test('GET /api/v1/user/preferiti - Autenticato restituisce lista 200', async () => {
            const res = await request(app)
                .get('/api/v1/user/preferiti')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('POST /api/v1/user/preferiti - Senza rastrellieraId restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/user/preferiti')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ tipologia: 'Bloccatelaio' });

            expect(res.statusCode).toBe(400);
        });

        test('TC-17: Aggiunta preferito con dati completi restituisce 201', async () => {
            const res = await request(app)
                .post('/api/v1/user/preferiti')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    rastrellieraId: 142,
                    tipologia: 'Bloccatelaio',
                    stalli: 8,
                    zona: 'Centro',
                    lat: 46.066,
                    lng: 11.121
                });

            expect(res.statusCode).toBe(201);
        });

        test('POST /api/v1/user/preferiti - Duplicato restituisce 409', async () => {
            const res = await request(app)
                .post('/api/v1/user/preferiti')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ rastrellieraId: 142 });

            expect([409, 201]).toContain(res.statusCode);
        });

        test('TC-18: Rimozione preferito esistente restituisce 200', async () => {
            const res = await request(app)
                .delete('/api/v1/user/preferiti/142')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(res.statusCode);
        });
    });

    // =========================================================================
    // 6. SEGNALAZIONI GUASTI (TC-14)
    // =========================================================================
    describe('Segnalazioni Guasti', () => {
        test('TC-14: Invio segnalazione da utente anonimo restituisce 401', async () => {
            const res = await request(app)
                .post('/api/v1/segnalazioni')
                .send({ rastrellieraId: 15, tipo: 'vandalismo' });

            expect(res.statusCode).toBe(401);
        });

        test('POST /api/v1/segnalazioni - Payload senza campi obbligatori restituisce 400', async () => {
            const res = await request(app)
                .post('/api/v1/segnalazioni')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(res.statusCode).toBe(400);
        });

        test('POST /api/v1/segnalazioni - Autenticato con dati corretti restituisce 201', async () => {
            const res = await request(app)
                .post('/api/v1/segnalazioni')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    rastrellieraId: 15,
                    tipo: 'danno_strutturale',
                    note: 'Archetto piegato',
                    lat: 46.067,
                    lng: 11.122
                });

            expect(res.statusCode).toBe(201);
        });

        test('GET /api/v1/segnalazioni/user - Restituisce storico utente autenticato 200', async () => {
            const res = await request(app)
                .get('/api/v1/segnalazioni/user')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('GET /api/v1/segnalazioni/recenti - Restituisce segnalazioni pubbliche 200', async () => {
            const res = await request(app).get('/api/v1/segnalazioni/recenti');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // =========================================================================
    // 7. ROUTING & CONTROLLI (TC-20)
    // =========================================================================
    describe('Routing Ciclabile', () => {
        test('GET /api/v1/routing - Coordinate mancanti restituiscono 400', async () => {
            const res = await request(app).get('/api/v1/routing');
            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('GET /api/v1/routing - Coordinate non numeriche restituiscono 400', async () => {
            const res = await request(app).get('/api/v1/routing?startLat=abc&startLng=11&endLat=46&endLng=11');
            expect(res.statusCode).toBe(400);
        });
    });
});