require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');
const proj4      = require('proj4');
const { OAuth2Client } = require('google-auth-library');
const jwt        = require('jsonwebtoken');
const tokenChecker = require('./middleware/tokenChecker');

// --- Configurazione ---
const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET       = process.env.SUPER_SECRET || 'segreto_universitario_trento_bike_parking';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '455956234516-62c55ghdcsl2tffohcancm7is467jgda.apps.googleusercontent.com';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Proiezione EPSG:25832 → WGS84 ---
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

function transformPoint(coords) {
    return proj4('EPSG:25832', 'WGS84', coords);
}

function computeCentroid(coords) {
    const t = coords.map(c => transformPoint(c));
    return [
        t.reduce((s, c) => s + c[0], 0) / t.length,
        t.reduce((s, c) => s + c[1], 0) / t.length
    ];
}

function transformToWGS84(geojson, addComputedFields) {
    const result = JSON.parse(JSON.stringify(geojson));
    result.features = result.features.map(feature => {
        const type = feature.geometry.type;
        if (type === 'Point') {
            feature.geometry.coordinates = transformPoint(feature.geometry.coordinates);
        } else if (type === 'LineString') {
            const centroid = computeCentroid(feature.geometry.coordinates);
            feature.geometry = { type: 'Point', coordinates: centroid };
        }
        if (addComputedFields) addComputedFields(feature);
        return feature;
    });
    result.crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } };
    return result;
}

// --- Path dati ---
const dataPath      = path.join(__dirname, 'data');
const usersFile     = path.join(dataPath, 'users.json');
const preferitiFile = path.join(dataPath, 'preferiti.json');
const segFile       = path.join(dataPath, 'segnalazioni.json');

// --- Helpers I/O ---
const readJsonFile = (filePath, callback) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) { callback(err, null); return; }
        try { callback(null, JSON.parse(data)); }
        catch (e) { callback(e, null); }
    });
};
const writeJsonFile = (filePath, data, callback) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', callback);
};

// =======================================================
// API: Dati Spaziali
// =======================================================

app.get('/api/v1/rastrelliere', (req, res) => {
    readJsonFile(path.join(dataPath, 'rastrelliere.geojson'), (err, data) => {
        if (err) {
            console.error('[API] Errore lettura rastrelliere:', err.message);
            return res.status(500).json({ error: 'Errore nella lettura delle rastrelliere: ' + err.message });
        }
        try {
            // Simulazione telemetria IoT Smart City in tempo reale per rastrelliere bloccatelaio
            const transformed = transformToWGS84(data, feature => {
                const id = feature.properties.id || 0;
                const isBlocca = (feature.properties.Tipo_generale === 'Rastr_bloccatelaio');
                const tot = parseInt(feature.properties.tot_bici || feature.properties.n_posti || 6, 10);
                feature.properties.tot_bici = tot;

                if (isBlocca) {
                    // Simulazione deterministica verosimile con distribuzione granulare continua
                    const hash = Math.abs(Math.sin(id * 12.9898 + 78.233) * 43758.5453);
                    const normalized = hash - Math.floor(hash); // Valore pseudo-casuale uniforme [0, 1)

                    let occupati;
                    if (normalized < 0.08) {
                        occupati = 0; // ~8% completamente vuote
                    } else if (normalized > 0.90) {
                        occupati = tot; // ~10% completamente piene
                    } else {
                        // Distribuzione realistica mista tra 20% e 80%
                        const fraction = 0.20 + (normalized * 0.60);
                        occupati = Math.round(fraction * tot);
                        if (tot > 1) {
                            occupati = Math.min(tot - 1, Math.max(1, occupati));
                        }
                    }

                    const liberi = Math.max(0, tot - occupati);
                    const occupPercent = Math.round((occupati / tot) * 100);

                    feature.properties.smart_iot = true;
                    feature.properties.posti_totali = tot;
                    feature.properties.posti_occupati = occupati;
                    feature.properties.posti_liberi = liberi;
                    feature.properties.percentuale_occupazione = occupPercent;
                    feature.properties.piena = (liberi === 0);
                } else {
                    // Rastrelliere tradizionali: nessun sensore IoT, sempre blu (mai piene/rosse)
                    feature.properties.smart_iot = false;
                    feature.properties.piena = false;
                }


            });
            res.status(200).json(transformed);
        } catch (e) {
            console.error('[API] Errore trasformazione rastrelliere:', e.message);
            res.status(500).json({ error: 'Errore trasformazione coordinate: ' + e.message });
        }
    });
});


app.get('/api/v1/parcheggi', (req, res) => {
    readJsonFile(path.join(dataPath, 'parcheggi.geojson'), (err, data) => {
        if (err) {
            console.error('[API] Errore lettura parcheggi:', err.message);
            return res.status(500).json({ error: 'Errore nella lettura dei parcheggi: ' + err.message });
        }
        try {
            let index = 1;
            const transformed = transformToWGS84(data, feature => {
                if (!feature.properties.id) {
                    feature.properties.id = 10000 + index;
                }
                feature.properties.Tipo_generale = 'Parcheggio_protetto';
                index++;
            });
            res.status(200).json(transformed);
        } catch (e) {
            console.error('[API] Errore trasformazione parcheggi:', e.message);
            res.status(500).json({ error: 'Errore trasformazione coordinate: ' + e.message });
        }
    });
});


// =======================================================
// API: Configurazione pubblica
// =======================================================

app.get('/api/v1/config', (req, res) => {
    res.status(200).json({ googleClientId: GOOGLE_CLIENT_ID });
});

// =======================================================
// API: Autenticazione locale
// =======================================================

app.post('/api/v1/register', (req, res) => {
    const { name, surname, email, password } = req.body;
    if (!name || !surname || !email || !password)
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });

    readJsonFile(usersFile, (err, users) => {
        if (err) users = [];
        if (users.find(u => u.email === email))
            return res.status(409).json({ error: 'Utente già registrato con questa email' });

        users.push({ id: Date.now().toString(), name, surname, email, password });
        writeJsonFile(usersFile, users, werr => {
            if (werr) return res.status(500).json({ error: 'Errore nel salvataggio utente' });
            res.status(201).json({ message: 'Registrazione completata con successo' });
        });
    });
});

app.post('/api/v1/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email e password sono obbligatorie' });

    readJsonFile(usersFile, (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore interno del server' });
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) return res.status(401).json({ error: 'Credenziali non valide. Controlla email e password.' });

        const token = jwt.sign(
            { sub: user.id, email: user.email, name: user.name, surname: user.surname, provider: 'local' },
            JWT_SECRET, { expiresIn: '24h' }
        );
        res.status(200).json({ token, user: { name: user.name, surname: user.surname, email: user.email } });
    });
});

// =======================================================
// API: Google SSO
// =======================================================

app.post('/api/v1/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token Google mancante' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google Client ID non configurato sul server' });

    try {
        const client = new OAuth2Client(GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();

        const token = jwt.sign({
            sub: payload['sub'],
            email: payload['email'],
            name: payload['given_name'] || payload['name'],
            surname: payload['family_name'] || '',
            picture: payload['picture'],
            provider: 'google'
        }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            token,
            user: {
                name: payload['given_name'] || payload['name'],
                surname: payload['family_name'] || '',
                email: payload['email'],
                picture: payload['picture']
            }
        });
    } catch (error) {
        console.error('[Google SSO] Errore verifica token:', error.message);
        res.status(401).json({ error: 'Autenticazione Google fallita: token non valido o scaduto.' });
    }
});

app.get('/api/v1/auth/verify', tokenChecker, (req, res) => {
    res.status(200).json({ valid: true, user: req.user });
});

// =======================================================
// API: Utente (protette da JWT)
// =======================================================

app.get('/api/v1/user/me', tokenChecker, (req, res) => {
    res.status(200).json({ user: req.user });
});

// --- Preferiti ---

app.get('/api/v1/user/preferiti', tokenChecker, (req, res) => {
    readJsonFile(preferitiFile, (err, data) => {
        if (err) data = {};
        res.status(200).json({ preferiti: data[req.user.sub] || [] });
    });
});

app.post('/api/v1/user/preferiti', tokenChecker, (req, res) => {
    const { rastrellieraId, tipologia, stalli, zona, lat, lng } = req.body;
    if (rastrellieraId === undefined) return res.status(400).json({ error: 'rastrellieraId obbligatorio' });

    readJsonFile(preferitiFile, (err, data) => {
        if (err) data = {};
        const uid = req.user.sub;
        if (!data[uid]) data[uid] = [];
        if (data[uid].find(f => f.id === rastrellieraId))
            return res.status(409).json({ error: 'Già nei preferiti' });

        data[uid].push({ id: rastrellieraId, tipologia, stalli, zona, lat, lng, savedAt: new Date().toISOString() });
        writeJsonFile(preferitiFile, data, werr => {
            if (werr) return res.status(500).json({ error: 'Errore salvataggio preferiti' });
            res.status(201).json({ message: 'Aggiunto ai preferiti' });
        });
    });
});

app.delete('/api/v1/user/preferiti/:id', tokenChecker, (req, res) => {
    const id = parseInt(req.params.id);
    readJsonFile(preferitiFile, (err, data) => {
        if (err) return res.status(500).json({ error: 'Errore lettura preferiti' });
        const uid = req.user.sub;
        if (!data[uid]) return res.status(404).json({ error: 'Nessun preferito trovato' });
        data[uid] = data[uid].filter(f => f.id !== id);
        writeJsonFile(preferitiFile, data, werr => {
            if (werr) return res.status(500).json({ error: 'Errore salvataggio' });
            res.status(200).json({ message: 'Rimosso dai preferiti' });
        });
    });
});

// =======================================================
// API: Segnalazioni (protette da JWT)
// =======================================================

app.post('/api/v1/segnalazioni', tokenChecker, (req, res) => {
    const { rastrellieraId, tipo, note, lat, lng } = req.body;
    if (!rastrellieraId || !tipo)
        return res.status(400).json({ error: 'rastrellieraId e tipo sono obbligatori' });

    readJsonFile(segFile, (err, data) => {
        if (err) data = [];
        const segnalazione = {
            id: `seg_${Date.now()}`,
            userId: req.user.sub,
            userEmail: req.user.email,
            rastrellieraId,
            tipo,
            note: note || '',
            lat: lat || null,
            lng: lng || null,
            timestamp: new Date().toISOString(),
            stato: 'inviata'
        };
        data.push(segnalazione);
        writeJsonFile(segFile, data, werr => {
            if (werr) return res.status(500).json({ error: 'Errore salvataggio segnalazione' });
            res.status(201).json({ message: 'Segnalazione inviata con successo', id: segnalazione.id });
        });
    });
});

app.get('/api/v1/segnalazioni/user', tokenChecker, (req, res) => {
    readJsonFile(segFile, (err, data) => {
        if (err) data = [];
        res.status(200).json({ segnalazioni: data.filter(s => s.userId === req.user.sub) });
    });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚲 Trento Bike Parking → http://localhost:${PORT}`);
    console.log(`   Google SSO: ${GOOGLE_CLIENT_ID ? '✅ Configurato' : '⚠️  Non configurato'}`);
});
