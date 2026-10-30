const rateLimit = require('express-rate-limit');

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
const { securityHeaders, sanitizeString } = require('./middleware/security');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const db         = require('./db');
const SALT_ROUNDS = 10;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key';

// --- Configurazione Server & Sicurezza ---
const app = express();

// Rimuove l'header X-Powered-By per sicurezza
app.disable('x-powered-by');

// Abilita trust proxy per reverse proxy (Render, Railway, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Applica gli header di sicurezza HTTP difensivi (CSP, X-Frame, Nosniff, Referrer, Permissions)
app.use(securityHeaders);

// Configurazione CORS sicura e flessibile
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : null;

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origine non consentita dalle policy CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Pagine HTML standalone (compatibilità routing senza estensione .html)
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));

// Normalizzazione URL per compatibilità sia serverless Vercel che standalone locale
app.use((req, res, next) => {
    const original = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
    if (original && original.startsWith('/api/')) {
        const queryIndex = (req.url || '').indexOf('?');
        const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
        req.url = original.includes('?') ? original : (original + queryString);
    } else if (req.url && req.url.startsWith('/v1/')) {
        req.url = '/api' + req.url;
    }
    next();
});

// =======================================================
// RATE LIMITERS (RNF 2.5 & Protezione DDoS / Brute-force)
// =======================================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        const mins = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 60000));
        res.status(options.statusCode).json({ error: `Troppi tentativi di autenticazione. Riprova tra ${mins} ${mins === 1 ? 'minuto' : 'minuti'}.` });
    }
});

const segnalazioniLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        const mins = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 60000));
        res.status(options.statusCode).json({ error: `Hai inviato troppe segnalazioni. Riprova tra ${mins} ${mins === 1 ? 'minuto' : 'minuti'}.` });
    }
});

const routingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30, // Massimo 30 calcoli percorso al minuto per IP
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({ error: 'Troppe richieste di calcolo percorso. Attendi qualche istante.' });
    }
});

const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400, // Limite generale per chiamate API
    skip: () => process.env.NODE_ENV === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({ error: 'Frequenza delle richieste troppo elevata. Riprova tra qualche minuto.' });
    }
});

app.use('/api/', generalApiLimiter);

const PORT = process.env.PORT || 3000;
const JWT_SECRET       = process.env.SUPER_SECRET || 'segreto_universitario_cycle_place';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '455956234516-62c55ghdcsl2tffohcancm7is467jgda.apps.googleusercontent.com';
const ORS_API_KEY      = process.env.ORS_API_KEY ? process.env.ORS_API_KEY.trim() : '';

// Controllo sicurezza in produzione per segreto JWT
if (process.env.NODE_ENV === 'production' && (!process.env.SUPER_SECRET || process.env.SUPER_SECRET === 'segreto_universitario_cycle_place')) {
    console.warn('⚠️  [SICUREZZA] SUPER_SECRET non configurato o su valore di default. Configura una chiave casuale a 256 bit in produzione.');
}

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
function resolveStaticDataPath() {
    const candidates = [
        path.join(__dirname, 'data'),
        path.join(process.cwd(), 'data'),
        path.join(__dirname, '..', 'data')
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'rastrelliere.geojson'))) {
            return c;
        }
    }
    return candidates[0];
}
const staticDataPath  = resolveStaticDataPath();
const isServerless    = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
// Su Vercel (serverless) il filesystem del bundle è in sola lettura: usiamo /tmp per le modifiche
const dynamicDataPath = isServerless ? path.join('/tmp', 'cycle-place-data') : staticDataPath;

const usersFile     = path.join(dynamicDataPath, 'users.json');
const preferitiFile = path.join(dynamicDataPath, 'preferiti.json');
const segFile       = path.join(dynamicDataPath, 'segnalazioni.json');

// Inizializzazione automatica per prevenire errori su installazioni pulite, deploy cloud o serverless
function ensureDataFiles() {
    try {
        if (!fs.existsSync(dynamicDataPath)) {
            fs.mkdirSync(dynamicDataPath, { recursive: true });
        }
        if (!fs.existsSync(usersFile)) {
            const seed = path.join(staticDataPath, 'users.json');
            if (fs.existsSync(seed)) fs.copyFileSync(seed, usersFile);
            else fs.writeFileSync(usersFile, '[]', 'utf8');
        }
        if (!fs.existsSync(preferitiFile)) {
            const seed = path.join(staticDataPath, 'preferiti.json');
            if (fs.existsSync(seed)) fs.copyFileSync(seed, preferitiFile);
            else fs.writeFileSync(preferitiFile, '{}', 'utf8');
        }
        if (!fs.existsSync(segFile)) {
            const seed = path.join(staticDataPath, 'segnalazioni.json');
            if (fs.existsSync(seed)) fs.copyFileSync(seed, segFile);
            else fs.writeFileSync(segFile, '[]', 'utf8');
        }
    } catch (e) {
        console.warn('[Data Init] Impossibile inizializzare file data:', e.message);
    }
}
ensureDataFiles();

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

// --- Servizio Email per Recupero Password (RF 1.4 / US 3) ---
let mailTransporter = null;
async function getMailTransporter() {
    if (mailTransporter) return mailTransporter;
    // In ambiente di test usiamo jsonTransport per evitare chiamate SMTP esterne e blocchi
    if (process.env.NODE_ENV === 'test') {
        mailTransporter = nodemailer.createTransport({
            jsonTransport: true
        });
        return mailTransporter;
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log('[Email] Configurato transporter SMTP con utente:', process.env.SMTP_USER);
    } else {
        try {
            const testAccount = await nodemailer.createTestAccount();
            mailTransporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('[Email] Account Ethereal generato per sviluppo locale:', testAccount.user);
        } catch (e) {
            console.warn('[Email] Fallback su transporter locale JSON:', e.message);
            mailTransporter = nodemailer.createTransport({
                jsonTransport: true
            });
        }
    }
    return mailTransporter;
}

// =======================================================
// API: Dati Spaziali
// =======================================================

app.get('/api/v1/rastrelliere', (req, res) => {
    readJsonFile(path.join(staticDataPath, 'rastrelliere.geojson'), (err, data) => {
        if (err) {
            console.error('[API] Errore lettura rastrelliere:', err.message);
            return res.status(500).json({ error: 'Errore nella lettura delle rastrelliere: ' + err.message });
        }
        try {
            // Rastrelliere: nessuna simulazione IoT (la simulazione è sui parcheggi protetti)
            const transformed = transformToWGS84(data, feature => {
                const tot = parseInt(feature.properties.tot_bici || feature.properties.n_posti || 6, 10);
                feature.properties.tot_bici = tot;
                // Nessun sensore IoT sulle rastrelliere: sempre senza simulazione capienza
                feature.properties.smart_iot = false;
                feature.properties.piena = false;


            });
            res.status(200).json(transformed);
        } catch (e) {
            console.error('[API] Errore trasformazione rastrelliere:', e.message);
            res.status(500).json({ error: 'Errore trasformazione coordinate: ' + e.message });
        }
    });
});


app.get('/api/v1/parcheggi', (req, res) => {
    readJsonFile(path.join(staticDataPath, 'parcheggi.geojson'), (err, data) => {
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

                // Simulazione telemetria IoT Smart City per parcheggi protetti (Ciclobox)
                const id = feature.properties.id || 0;
                const tot = parseInt(feature.properties.posti || 10, 10);
                const hash = Math.abs(Math.sin(id * 12.9898 + 78.233) * 43758.5453);
                const normalized = hash - Math.floor(hash);

                let occupati;
                if (normalized < 0.08) {
                    occupati = 0;
                } else if (normalized > 0.90) {
                    occupati = tot;
                } else {
                    const fraction = 0.20 + (normalized * 0.60);
                    occupati = Math.round(fraction * tot);
                    if (tot > 1) occupati = Math.min(tot - 1, Math.max(1, occupati));
                }

                const liberi = Math.max(0, tot - occupati);
                const occupPercent = Math.round((occupati / tot) * 100);

                feature.properties.smart_iot = true;
                feature.properties.posti_totali = tot;
                feature.properties.posti_occupati = occupati;
                feature.properties.posti_liberi = liberi;
                feature.properties.percentuale_occupazione = occupPercent;
                feature.properties.piena = (liberi === 0);

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Regex: Minimo 8 caratteri, almeno una maiuscola, almeno un numero e almeno un carattere speciale
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

app.post('/api/v1/register', authLimiter, async (req, res) => {
    const { name, surname, email, password, privacyAccepted } = req.body;
    if (!name || !surname || !email || !password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    if (privacyAccepted === false) {
        return res.status(400).json({ error: 'È necessario accettare i Termini e l\'Informativa sulla Privacy' });
    }

    const trimmedName = sanitizeString(String(name).trim());
    const trimmedSurname = sanitizeString(String(surname).trim());
    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (trimmedName.length < 2) {
        return res.status(400).json({ error: 'Il nome deve contenere almeno 2 caratteri' });
    }
    if (trimmedSurname.length < 2) {
        return res.status(400).json({ error: 'Il cognome deve contenere almeno 2 caratteri' });
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Inserisci un indirizzo email valido (es. nome@dominio.it)' });
    }
    if (!PASSWORD_REGEX.test(cleanPassword)) {
        return res.status(400).json({ 
            error: 'La password deve contenere almeno 8 caratteri, una lettera maiuscola, un numero e un carattere speciale' 
        });
    }

    try {
        const existing = await db.findUserByEmail(trimmedEmail);
        if (existing) {
            return res.status(409).json({ error: 'Utente già registrato con questa email' });
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);
        await db.createUser({
            id: Date.now().toString(),
            name: trimmedName,
            surname: trimmedSurname,
            email: trimmedEmail,
            password: hashedPassword,
            privacyAccepted: privacyAccepted !== undefined ? Boolean(privacyAccepted) : true,
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ message: 'Registrazione completata con successo' });
    } catch (hashErr) {
        console.error('[Register] Errore registrazione:', hashErr);
        return res.status(500).json({ error: 'Errore interno durante la registrazione' });
    }
});

app.post('/api/v1/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password sono obbligatorie' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (!EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Formato email non valido' });
    }

    try {
        const user = await db.findUserByEmail(trimmedEmail);
        if (!user) {
            return res.status(401).json({ error: 'Credenziali non valide. Controlla email e password.' });
        }

        const isMatch = await bcrypt.compare(cleanPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenziali non valide. Controlla email e password.' });
        }

        // Genera Access Token (15m) e Refresh Token (30d)
        const accessToken = jwt.sign(
            { sub: user.id, email: user.email, name: user.name, surname: user.surname, provider: 'local' }, 
            JWT_SECRET, 
            { expiresIn: '15m' }
        );
        const refreshToken = jwt.sign(
            { id: user.id }, 
            JWT_REFRESH_SECRET, 
            { expiresIn: '30d' }
        );
        
        const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await db.updateUser(user.id, { refreshToken: hashedRefreshToken });

        res.status(200).json({ 
            message: "Login effettuato",
            accessToken,
            token: accessToken,
            refreshToken,
            user: { name: user.name, surname: user.surname, email: user.email } 
        });
    } catch (err) {
        console.error('[Login] Errore login:', err);
        return res.status(500).json({ error: 'Errore durante la verifica delle credenziali' });
    }
});

app.post('/api/v1/refresh-token', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Token mancante" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token non valido o scaduto" });

        try {
            const user = await db.findUserById(decoded.id);
            if (!user || !user.refreshToken) {
                return res.status(403).json({ error: "Nessuna sessione attiva o sessione invalidata" });
            }

            const hashedInput = crypto.createHash('sha256').update(refreshToken).digest('hex');
            if (user.refreshToken !== hashedInput) {
                return res.status(403).json({ error: "Sessione invalidata da un nuovo login" });
            }

            const newAccessToken = jwt.sign(
                { sub: user.id, email: user.email, name: user.name, surname: user.surname, provider: 'local' }, 
                JWT_SECRET, 
                { expiresIn: '15m' }
            );
            res.status(200).json({ accessToken: newAccessToken, token: newAccessToken });
        } catch (e) {
            return res.status(500).json({ error: "Errore lettura database utenti" });
        }
    });
});

// =======================================================
// =======================================================
// API: Recupero Password Multilingua (RF 1.4 / US 3)
// Supporto per IT, EN, DE
// =======================================================

const EMAIL_TEMPLATES = {
    it: {
        subject: 'Recupero Password — Cycle Place',
        title: 'Cycle Place',
        subtitle: 'Mappa rastrelliere e parcheggi protetti',
        heading: 'Reimposta la tua password',
        greeting: (name) => `Ciao <strong>${name || 'Utente'}</strong>,`,
        body: 'Abbiamo ricevuto una richiesta di ripristino password per il tuo account. Clicca sul pulsante sottostante per impostare una nuova password:',
        button: 'Reimposta Password',
        expiry: 'Il link è valido per <strong>1 ora</strong>. Se il pulsante non funziona, copia questo link nel browser:',
        disclaimer: 'Se non hai richiesto il reset, puoi ignorare questo messaggio in tutta sicurezza: il tuo account rimane protetto.',
        textMsg: (name, link) => `Ciao ${name || ''},\n\nHai richiesto di reimpostare la tua password per Cycle Place.\nClicca sul seguente link entro 1 ora per procedere:\n\n${link}\n\nSe non hai effettuato tu questa richiesta, ignora questa email.\n\nIl team di Cycle Place`,
        apiMsg: "Se l'indirizzo email è registrato, riceverai a breve un link per reimpostare la password.",
        googleErr: "Questo account utilizza l'accesso tramite Google e non dispone di una password da reimpostare."
    },
    en: {
        subject: 'Password Recovery — Cycle Place',
        title: 'Cycle Place',
        subtitle: 'Bike racks and secure parking map',
        heading: 'Reset your password',
        greeting: (name) => `Hello <strong>${name || 'User'}</strong>,`,
        body: 'We received a request to reset the password for your account. Click the button below to set a new password:',
        button: 'Reset Password',
        expiry: 'This link is valid for <strong>1 hour</strong>. If the button does not work, copy this link into your browser:',
        disclaimer: 'If you did not request a password reset, you can safely ignore this email: your account remains secure.',
        textMsg: (name, link) => `Hello ${name || ''},\n\nYou requested to reset your password for Cycle Place.\nClick the following link within 1 hour to proceed:\n\n${link}\n\nIf you did not request this, please ignore this email.\n\nThe Cycle Place Team`,
        apiMsg: "If the email address is registered, you will shortly receive a link to reset your password.",
        googleErr: "This account uses Google Sign-In and does not have a standard password to reset."
    },
    de: {
        subject: 'Passwort wiederherstellen — Cycle Place',
        title: 'Cycle Place',
        subtitle: 'Karte der Fahrradabstellplätze und Parkhäuser',
        heading: 'Setzen Sie Ihr Passwort zurück',
        greeting: (name) => `Hallo <strong>${name || 'Benutzer'}</strong>,`,
        body: 'Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr Konto erhalten. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort festzulegen:',
        button: 'Passwort zurücksetzen',
        expiry: 'Dieser Link ist <strong>1 Stunde</strong> lang gültig. Wenn die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
        disclaimer: 'Wenn Sie das Zurücksetzen nicht angefordert haben, können Sie diese E-Mail ignorieren: Ihr Konto bleibt geschützt.',
        textMsg: (name, link) => `Hallo ${name || ''},\n\nSie haben das Zurücksetzen Ihres Passworts für Cycle Place beantragt.\nKlicken Sie innerhalb von 1 Stunde auf den folgenden Link:\n\n${link}\n\nWenn Sie dies nicht angefordert haben, ignorieren Sie bitte diese E-Mail.\n\nDas Team von Cycle Place`,
        apiMsg: "Wenn die E-Mail-Adresse registriert ist, erhalten Sie in Kürze einen Link zum Zurücksetzen des Passworts.",
        googleErr: "Dieses Konto verwendet die Google-Anmeldung und verfügt über kein herkömmliches Passwort zum Zurücksetzen."
    }
};

const RESET_RESPONSES = {
    it: {
        success: 'Password aggiornata con successo! Ora puoi accedere con le nuove credenziali.',
        invalid: 'Link di recupero non valido o scaduto. Richiedine uno nuovo.',
        tooShort: 'La password deve contenere almeno 4 caratteri'
    },
    en: {
        success: 'Password updated successfully! You can now log in with your new credentials.',
        invalid: 'Recovery link is invalid or has expired. Please request a new one.',
        tooShort: 'Password must be at least 4 characters long'
    },
    de: {
        success: 'Passwort erfolgreich aktualisiert! Sie können sich jetzt mit Ihren neuen Zugangsdaten anmelden.',
        invalid: 'Wiederherstellungslink ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.',
        tooShort: 'Das Passwort muss mindestens 4 Zeichen lang sein'
    }
};

app.post('/api/v1/forgot-password', authLimiter, async (req, res) => {
    const { email, lang } = req.body;
    const userLang = ['it', 'en', 'de'].includes(lang) ? lang : 'it';
    const tpl = EMAIL_TEMPLATES[userLang];

    if (!email) {
        return res.status(400).json({ error: userLang === 'en' ? 'Email is required' : (userLang === 'de' ? 'E-Mail ist erforderlich' : 'L\'indirizzo email è obbligatorio') });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ error: userLang === 'en' ? 'Invalid email format' : (userLang === 'de' ? 'Ungültiges E-Mail-Format' : 'Formato email non valido') });
    }

    try {
        const user = await db.findUserByEmail(trimmedEmail);

        // Anti-enumeration
        if (!user) {
            return res.status(200).json({ message: tpl.apiMsg });
        }

        // Se l'utente usa Google SSO
        if (user.googleId && !user.password) {
            return res.status(400).json({ error: tpl.googleErr });
        }

        // Genera token monouso sicuro a 64 caratteri esadecimali
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 ora di validità

        await db.updateUser(user.id, {
            resetPasswordToken: token,
            resetPasswordExpires: expires
        });

        const host = req.get('host');
        const protocol = req.protocol;
        const resetLink = `${protocol}://${host}/?action=reset-password&token=${token}&lang=${userLang}`;

        try {
            const transporter = await getMailTransporter();
            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || '"Cycle Place" <noreply@cycleplace.it>',
                to: trimmedEmail,
                subject: tpl.subject,
                text: tpl.textMsg(user.name, resetLink),
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border-radius: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #0284c7; margin: 0; font-size: 22px;">${tpl.title}</h1>
                            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">${tpl.subtitle}</p>
                        </div>
                        <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <h2 style="color: #1e293b; font-size: 17px; margin-top: 0;">${tpl.heading}</h2>
                            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                                ${tpl.greeting(user.name)}<br>
                                ${tpl.body}
                            </p>
                            <div style="text-align: center; margin: 28px 0;">
                                <a href="${resetLink}" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                                    ${tpl.button}
                                </a>
                            </div>
                            <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
                                ${tpl.expiry}<br>
                                <a href="${resetLink}" style="color: #0284c7; word-break: break-all;">${resetLink}</a>
                            </p>
                            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
                            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                                ${tpl.disclaimer}
                            </p>
                        </div>
                    </div>
                `
            });

            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`[Email - ${userLang.toUpperCase()}] ✉️ Anteprima Ethereal per`, trimmedEmail, ':', previewUrl);
            }
            console.log(`[Email - ${userLang.toUpperCase()}] Link di reset per ${trimmedEmail}: ${resetLink}`);

            res.status(200).json({
                message: tpl.apiMsg,
                previewUrl: previewUrl || null
            });
        } catch (mailErr) {
            console.error('[Email] Errore invio:', mailErr.message);
            console.log(`[Email] Link diretto di emergenza (per sviluppo locale): ${resetLink}`);
            res.status(200).json({
                message: tpl.apiMsg,
                previewUrl: null
            });
        }
    } catch (err) {
        console.error('[Forgot Password] Errore:', err);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
});

app.get('/api/v1/verify-reset-token', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ valid: false, error: 'Token mancante' });
    }

    try {
        const user = await db.findUserByResetToken(token);
        const now = Date.now();
        if (!user || !user.resetPasswordExpires || user.resetPasswordExpires <= now) {
            return res.status(400).json({ valid: false, error: 'Link di recupero non valido o scaduto.' });
        }

        res.status(200).json({ valid: true, email: user.email });
    } catch (err) {
        return res.status(500).json({ valid: false, error: 'Errore interno del server' });
    }
});

app.post('/api/v1/reset-password', authLimiter, async (req, res) => {
    const { token, newPassword, lang } = req.body;
    const userLang = ['it', 'en', 'de'].includes(lang) ? lang : 'it';
    const rMsg = RESET_RESPONSES[userLang];

    if (!token || !newPassword) {
        return res.status(400).json({ error: userLang === 'en' ? 'Token and password are required' : (userLang === 'de' ? 'Token und Passwort sind erforderlich' : 'Token e nuova password sono obbligatori') });
    }

    const cleanPassword = String(newPassword);
    if (cleanPassword.length < 4) {
        return res.status(400).json({ error: rMsg.tooShort });
    }

    try {
        const user = await db.findUserByResetToken(token);
        const now = Date.now();
        if (!user || !user.resetPasswordExpires || user.resetPasswordExpires <= now) {
            return res.status(400).json({ error: rMsg.invalid });
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);
        await db.updateUser(user.id, {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            refreshToken: null
        });

        res.status(200).json({ message: rMsg.success });
    } catch (hashErr) {
        console.error('[Bcrypt] Errore hashing password:', hashErr);
        return res.status(500).json({ error: 'Errore durante l\'aggiornamento della password' });
    }
});

// =======================================================
// API: Google SSO
// =======================================================

app.post('/api/v1/auth/google', authLimiter, async (req, res) => {
    const { credential, accessToken: gAccessToken } = req.body;
    if (!credential && !gAccessToken) return res.status(400).json({ error: 'Token Google mancante' });
    if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google Client ID non configurato sul server' });

    try {
        let googleId, email, name, surname, picture;

        if (credential) {
            const client = new OAuth2Client(GOOGLE_CLIENT_ID);
            const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
            const payload = ticket.getPayload();
            googleId = payload['sub'];
            email = (payload['email'] || '').toLowerCase().trim();
            name = payload['given_name'] || payload['name'] || 'Utente';
            surname = payload['family_name'] || 'Google';
            picture = payload['picture'] || '';
        } else if (gAccessToken) {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${gAccessToken}` }
            });
            if (!userInfoRes.ok) throw new Error('Verifica token Google fallita');
            const payload = await userInfoRes.json();
            googleId = payload.sub;
            email = (payload.email || '').toLowerCase().trim();
            name = payload.given_name || payload.name || 'Utente';
            surname = payload.family_name || 'Google';
            picture = payload.picture || '';
        }

        let user = await db.findUserByGoogleId(googleId);
        if (!user && email) {
            user = await db.findUserByEmail(email);
        }

        if (user) {
            const updates = { googleId };
            if (!user.name && name) updates.name = name;
            if (!user.surname && surname) updates.surname = surname;
            if (picture) updates.picture = picture;
            user = await db.updateUser(user.id, updates);
        } else {
            user = await db.createUser({
                id: Date.now().toString(),
                googleId: googleId,
                name: name,
                surname: surname,
                email: email,
                picture: picture,
                privacyAccepted: true,
                createdAt: new Date().toISOString()
            });
        }

        const accessToken = jwt.sign({
            sub: user.id,
            googleId: googleId,
            email: user.email,
            name: user.name,
            surname: user.surname,
            picture: user.picture || picture,
            provider: 'google'
        }, JWT_SECRET, { expiresIn: '15m' });

        const refreshToken = jwt.sign(
            { id: user.id }, 
            JWT_REFRESH_SECRET, 
            { expiresIn: '30d' }
        );
        const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await db.updateUser(user.id, { refreshToken: hashedRefreshToken });

        res.status(200).json({
            message: "Login con Google effettuato",
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                name: user.name,
                surname: user.surname,
                email: user.email,
                picture: user.picture || picture
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

app.get('/api/v1/user/preferiti', tokenChecker, async (req, res) => {
    try {
        let preferiti = await db.getPreferitiByUser(req.user.sub);
        if (preferiti.length === 0 && req.user.googleId) {
            const googlePrefs = await db.getPreferitiByUser(req.user.googleId);
            if (googlePrefs.length > 0) preferiti = googlePrefs;
        }
        res.status(200).json({ preferiti });
    } catch (e) {
        console.error('[Preferiti] Errore lettura preferiti:', e);
        res.status(500).json({ error: 'Errore lettura preferiti' });
    }
});

app.post('/api/v1/user/preferiti', tokenChecker, async (req, res) => {
    const { rastrellieraId, tipologia, stalli, zona, lat, lng } = req.body;
    if (rastrellieraId === undefined) return res.status(400).json({ error: 'rastrellieraId obbligatorio' });

    try {
        const added = await db.addPreferito(req.user.sub, {
            id: Number(rastrellieraId),
            tipologia,
            stalli,
            zona,
            lat,
            lng,
            savedAt: new Date().toISOString()
        });

        if (!added) {
            return res.status(409).json({ error: 'Già nei preferiti' });
        }
        res.status(201).json({ message: 'Aggiunto ai preferiti' });
    } catch (e) {
        console.error('[Preferiti] Errore salvataggio:', e);
        res.status(500).json({ error: 'Errore salvataggio preferiti' });
    }
});

app.delete('/api/v1/user/preferiti/:id', tokenChecker, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const removed = await db.removePreferito(req.user.sub, id);
        if (!removed && req.user.googleId) {
            const removedG = await db.removePreferito(req.user.googleId, id);
            if (removedG) return res.status(200).json({ message: 'Rimosso dai preferiti' });
        }
        if (!removed) {
            const current = await db.getPreferitiByUser(req.user.sub);
            if (!current || current.length === 0) {
                return res.status(404).json({ error: 'Nessun preferito trovato' });
            }
        }
        res.status(200).json({ message: 'Rimosso dai preferiti' });
    } catch (e) {
        console.error('[Preferiti] Errore rimozione:', e);
        res.status(500).json({ error: 'Errore salvataggio' });
    }
});

// =======================================================
// API: Aggiornamento Profilo, Password e Notifiche (RF 3.2, RF 3.3)
// =======================================================
app.put('/api/v1/user/profile', tokenChecker, async (req, res) => {
    const { name, surname, currentPassword, newPassword, notificheEmail } = req.body;
    const userId = req.user.sub;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;
    const userGoogleId = req.user.googleId || (req.user.provider === 'google' ? req.user.sub : null);

    try {
        let user = await db.findUserById(userId);
        if (!user && userGoogleId) user = await db.findUserByGoogleId(userGoogleId);
        if (!user && userEmail) user = await db.findUserByEmail(userEmail);

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const updates = {};

        // 1. Aggiornamento Anagrafica di base
        if (name && String(name).trim().length >= 2) {
            updates.name = String(name).trim();
        }
        if (surname && String(surname).trim().length >= 2) {
            updates.surname = String(surname).trim();
        }

        // 2. Aggiornamento Preferenze Notifiche
        if (notificheEmail !== undefined) {
            updates.notifiche = {
                email: Boolean(notificheEmail)
            };
        }

        // 3. Cambio Password (solo se richiesto)
        if (newPassword) {
            // Se l'utente è registrato via Google SSO non ha una password locale
            if (!user.password) {
                return res.status(400).json({ error: 'Gli account registrati con Google non possono modificare la password locale' });
            }
            if (!currentPassword) {
                return res.status(400).json({ error: 'Inserisci la password attuale per confermare la modifica' });
            }

            const isMatch = await bcrypt.compare(String(currentPassword), user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'La password attuale non è corretta' });
            }

            const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
            if (!PASSWORD_REGEX.test(String(newPassword))) {
                return res.status(400).json({ 
                    error: 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un carattere speciale' 
                });
            }

            updates.password = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
        }

        const updatedUser = await db.updateUser(user.id, updates);

        // Genera nuovo JWT aggiornato con i nuovi dati anagrafici
        const newToken = jwt.sign(
            { sub: updatedUser.id, email: updatedUser.email, name: updatedUser.name, surname: updatedUser.surname, provider: updatedUser.password ? 'local' : 'google' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Profilo aggiornato con successo',
            token: newToken,
            user: {
                name: updatedUser.name,
                surname: updatedUser.surname,
                email: updatedUser.email,
                notifiche: updatedUser.notifiche || { email: true }
            }
        });
    } catch (pErr) {
        console.error('[Profile Update] Errore modifica profilo:', pErr);
        return res.status(500).json({ error: 'Errore durante la modifica del profilo' });
    }
});

/**
 * DELETE /api/v1/user/account — RF 3.4 (Cancellazione definitiva Account GDPR)
 * Elimina l'utente dal database e cancella tutte le sue segnalazioni e preferiti associati
 */
app.delete('/api/v1/user/account', tokenChecker, async (req, res) => {
    const userId = req.user.sub;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;
    const userGoogleId = req.user.googleId || (req.user.provider === 'google' ? req.user.sub : null);

    try {
        let user = await db.findUserById(userId);
        if (!user && userGoogleId) user = await db.findUserByGoogleId(userGoogleId);
        if (!user && userEmail) user = await db.findUserByEmail(userEmail);

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        await db.deleteUser(user.id);
        return res.json({ success: true, message: 'Account e dati personali eliminati definitivamente con successo.' });
    } catch (e) {
        console.error('[Account Delete] Errore eliminazione account:', e);
        return res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'account' });
    }
});

// =======================================================
// API: Segnalazioni (protette da JWT)
// =======================================================

app.post('/api/v1/segnalazioni', segnalazioniLimiter, tokenChecker, async (req, res) => {
    const { rastrellieraId, tipo, note, lat, lng } = req.body;
    if (!rastrellieraId || !tipo)
        return res.status(400).json({ error: 'rastrellieraId e tipo sono obbligatori' });

    try {
        const segnalazione = {
            id: `seg_${Date.now()}`,
            userId: req.user.sub,
            userEmail: req.user.email,
            rastrellieraId: Number(rastrellieraId),
            tipo,
            note: sanitizeString(note || '').slice(0, 500),
            lat: lat ? Number(lat) : null,
            lng: lng ? Number(lng) : null,
            timestamp: new Date().toISOString(),
            stato: 'inviata'
        };
        await db.addSegnalazione(segnalazione);
        res.status(201).json({ message: 'Segnalazione inviata con successo', id: segnalazione.id });
    } catch (e) {
        console.error('[Segnalazioni] Errore salvataggio:', e);
        res.status(500).json({ error: 'Errore salvataggio segnalazione' });
    }
});

app.get('/api/v1/segnalazioni/user', tokenChecker, async (req, res) => {
    try {
        let userSegs = await db.getSegnalazioniByUser(req.user.sub);
        if (userSegs.length === 0 && req.user.googleId) {
            const gSegs = await db.getSegnalazioniByUser(req.user.googleId);
            if (gSegs.length > 0) userSegs = gSegs;
        }
        res.status(200).json({ segnalazioni: userSegs });
    } catch (e) {
        console.error('[Segnalazioni] Errore recupero utente:', e);
        res.status(500).json({ error: 'Errore recupero segnalazioni' });
    }
});

// GET /api/v1/segnalazioni/recenti — Segnalazioni recenti pubbliche (ultime 48h)
app.get('/api/v1/segnalazioni/recenti', async (req, res) => {
    try {
        const recenti = await db.getSegnalazioniRecenti(48);
        res.status(200).json({ segnalazioni: recenti });
    } catch (e) {
        console.error('[Segnalazioni] Errore recupero recenti:', e);
        res.status(200).json({ segnalazioni: [] });
    }
});

// Helper per tradurre le manovre OSRM nei vari linguaggi supportati
function translateOsrmManeuver(type, modifier, name, lang) {
    const isIt = lang === 'it';
    const isDe = lang === 'de';

    let action = '';
    switch (modifier) {
        case 'uturn': action = isIt ? 'Fai inversione a U' : (isDe ? 'Bitte wenden' : 'Make a U-turn'); break;
        case 'sharp right': action = isIt ? 'Svolta a destra decisa' : (isDe ? 'Scharf rechts abbiegen' : 'Turn sharp right'); break;
        case 'right': action = isIt ? 'Svolta a destra' : (isDe ? 'Rechts abbiegen' : 'Turn right'); break;
        case 'slight right': action = isIt ? 'Tieni la destra' : (isDe ? 'Halb rechts halten' : 'Keep right'); break;
        case 'straight': action = isIt ? 'Prosegui dritto' : (isDe ? 'Geradeaus weiter' : 'Continue straight'); break;
        case 'slight left': action = isIt ? 'Tieni la sinistra' : (isDe ? 'Halb links halten' : 'Keep left'); break;
        case 'left': action = isIt ? 'Svolta a sinistra' : (isDe ? 'Links abbiegen' : 'Turn left'); break;
        case 'sharp left': action = isIt ? 'Svolta a sinistra decisa' : (isDe ? 'Scharf links abbiegen' : 'Turn sharp left'); break;
        default:
            if (type === 'depart') action = isIt ? 'Parti' : (isDe ? 'Starten' : 'Head out');
            else if (type === 'arrive') action = isIt ? 'Sei arrivato a destinazione' : (isDe ? 'Ziel erreicht' : 'Arrive at destination');
            else action = isIt ? 'Continua' : (isDe ? 'Weiter' : 'Continue');
    }

    if (type === 'arrive') return action;
    if (name && name !== '-') {
        return isIt ? `${action} su ${name}` : (isDe ? `${action} auf ${name}` : `${action} onto ${name}`);
    }
    return action;
}

// =======================================================
// API: Routing In-App con OpenRouteService e Failover OSRM (RF 3.4)
// =======================================================
async function fetchOsrmRoute(osrmMode, sLng, sLat, eLng, eLat, lang) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmMode}/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const osrmData = await response.json();

    if (!osrmData.routes || osrmData.routes.length === 0) {
        throw new Error('Nessun percorso calcolabile');
    }

    const route = osrmData.routes[0];
    const coordinates = route.geometry?.coordinates || [];

    let currentCoordIdx = 0;
    const steps = (route.legs?.[0]?.steps || []).map(s => {
        const stepCoordCount = s.geometry?.coordinates?.length || 0;
        const startIdx = currentCoordIdx;
        const endIdx = Math.min(coordinates.length - 1, startIdx + Math.max(0, stepCoordCount - 1));
        currentCoordIdx = endIdx;

        const name = s.name || '';
        const instruction = translateOsrmManeuver(s.maneuver?.type, s.maneuver?.modifier, name, lang);

        return {
            distance: s.distance || 0,
            duration: s.duration || 0,
            name: name,
            instruction: instruction,
            type: s.maneuver?.type || '',
            way_points: [startIdx, endIdx]
        };
    });

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {
                summary: {
                    distance: route.distance || 0,
                    duration: route.duration || 0
                },
                segments: [{
                    distance: route.distance || 0,
                    duration: route.duration || 0,
                    steps: steps
                }]
            },
            geometry: route.geometry
        }],
        metadata: {
            source: 'OSRM-Fallback'
        }
    };
}

app.get('/api/v1/routing', routingLimiter, async (req, res) => {
    const { startLat, startLng, endLat, endLng, profile } = req.query;

    if (!startLat || !startLng || !endLat || !endLng) {
        return res.status(400).json({ error: 'Parametri startLat, startLng, endLat, endLng sono obbligatori' });
    }

    const sLat = parseFloat(startLat);
    const sLng = parseFloat(startLng);
    const eLat = parseFloat(endLat);
    const eLng = parseFloat(endLng);

    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
        return res.status(400).json({ error: 'Coordinate fornite non valide' });
    }

    const lang = ['it', 'en', 'de'].includes(req.query.language) ? req.query.language : 'it';
    const apiKey = (process.env.ORS_API_KEY ? process.env.ORS_API_KEY.trim() : '') || ORS_API_KEY;

    const isFoot = (profile === 'foot-walking');
    const isCar = (profile === 'driving-car');
    // Per le biciclette usiamo cycling-road come profilo primario: è ultra-veloce (~200ms)
    // mentre cycling-regular su ORS soffre di frequenti blocchi/timeout lato cluster
    const orsProfile = isFoot ? 'foot-walking' : (isCar ? 'driving-car' : 'cycling-road');
    const osrmMode = isFoot ? 'foot' : (isCar ? 'driving' : 'cycling');

    let isHandled = false;
    const orsController = new AbortController();

    const sendResponse = (data) => {
        if (isHandled) return;
        isHandled = true;
        try { orsController.abort(); } catch (e) {}
        res.status(200).json(data);
    };

    // 1. Chiamata a OpenRouteService
    if (apiKey) {
        fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify({
                coordinates: [[sLng, sLat], [eLng, eLat]],
                language: lang,
                instructions: true
            }),
            signal: orsController.signal
        })
        .then(async response => {
            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    sendResponse(data);
                }
            } else {
                // Se ORS risponde con errore o quota esaurita, attiva subito il fallback OSRM
                if (!isHandled) {
                    try {
                        const osrmData = await fetchOsrmRoute(osrmMode, sLng, sLat, eLng, eLat, lang);
                        sendResponse(osrmData);
                    } catch (e) {}
                }
            }
        })
        .catch(() => {});
    }

    // 2. Se ORS non risponde entro 1200ms (latenza anomala o blocco server), avvia OSRM in parallelo
    setTimeout(async () => {
        if (isHandled) return;
        try {
            const osrmData = await fetchOsrmRoute(osrmMode, sLng, sLat, eLng, eLat, lang);
            sendResponse(osrmData);
        } catch (e) {
            console.warn('[Routing OSRM fallback error]:', e.message);
        }
    }, apiKey ? 1200 : 0);

    // 3. Timeout finale di sicurezza (4.5 secondi)
    setTimeout(() => {
        if (!isHandled) {
            isHandled = true;
            try { orsController.abort(); } catch (e) {}
            res.status(504).json({ error: 'Tempo scaduto per il calcolo del percorso' });
        }
    }, 4500);
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let server = null;
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    server = app.listen(PORT, () => {
        console.log(`\n🚲 Cycle Place → http://localhost:${PORT}`);
        console.log(`   Google SSO: ${GOOGLE_CLIENT_ID ? '✅ Configurato' : '⚠️  Non configurato'}`);
    });
}

module.exports = app;
