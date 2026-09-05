require('dotenv').config({ path: './mondodb.env' });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const tokenChecker = require('./middleware/tokenChecker');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const dataPath = path.join(__dirname, 'data');

const readJsonFile = (filePath, callback) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) { callback(err, null); return; }
        try { callback(null, JSON.parse(data)); }
        catch (e) { callback(e, null); }
    });
};

// Connessione a MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cycle-place')
    .then(() => console.log('✅ Connesso a MongoDB'))
    .catch(err => console.error('❌ Errore connessione MongoDB:', err));

const favoriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rastrellieraId: { type: Number, required: true },
    tipologia: String,
    stalli: Number,
    zona: String,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now }
});
const Favorite = mongoose.model('Favorite', favoriteSchema);

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Può essere vuoto se l'utente accede con Google SSO
    googleId: { type: String, sparse: true },
    refreshToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
});
const User = mongoose.model('User', userSchema);

const segnalazioneSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rastrellieraId: { type: Number, required: true },
    tipo: { type: String, required: true },
    note: String,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now }
});
const Segnalazione = mongoose.model('Segnalazione', segnalazioneSchema);


// --- Configurazione ---
const app  = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =======================================================
// RATE LIMITERS (RNF 2.5)
// =======================================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
    const mins = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 60000));
    res.status(options.statusCode).json({ error: `Troppi tentativi di accesso. Riprova tra ${mins} ${mins === 1 ? 'minuto' : 'minuti'}.` });
    }
});

const segnalazioniLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
    const mins = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 60000));
    res.status(options.statusCode).json({ error: `Hai inviato troppe segnalazioni. Riprova tra ${mins} ${mins === 1 ? 'minuto' : 'minuti'}.` });
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET       = process.env.SUPER_SECRET || 'segreto_universitario_cycle_place';
const SALT_ROUNDS = 10;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '455956234516-62c55ghdcsl2tffohcancm7is467jgda.apps.googleusercontent.com';
const ORS_API_KEY      = (process.env.ORS_API_KEY ? process.env.ORS_API_KEY.trim() : '') || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjBkZmY3MGY1NjJiYTQ0OTE5NWQwNWNmOTQ3ODU3NmE2IiwiaCI6Im11cm11cjY0In0=';

function generateAccessToken(user) {
    return jwt.sign(
        { sub: user._id, email: user.email, name: user.name, surname: user.surname, provider: user.password ? 'local' : 'google' },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
}

function generateRefreshToken(user) {
    const token = jwt.sign(
        { sub: user._id },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
    );
    user.refreshToken = token;
    user.save();
    return token;
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

// --- Servizio Email per Recupero Password (RF 1.4 / US 3) ---
let mailTransporter = null;
async function getMailTransporter() {
    if (mailTransporter) return mailTransporter;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Regex: Minimo 8 caratteri, almeno una maiuscola, almeno un numero e almeno un carattere speciale
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

app.post('/api/v1/register', async (req, res) => {
    try {
        const { name, surname, email, password } = req.body;
        const trimmedEmail = String(email).trim().toLowerCase();

        const existingUser = await User.findOne({ email: trimmedEmail });
        if (existingUser) {
            return res.status(400).json({ error: 'Email già registrata' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = new User({
            name: String(name).trim(),
            surname: String(surname).trim(),
            email: trimmedEmail,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'Registrazione completata con successo' });
    } catch (err) {
        res.status(500).json({ error: 'Errore durante la registrazione: ' + err.message });
    }
});

app.post('/api/v1/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const trimmedEmail = String(email).trim().toLowerCase();

        const user = await User.findOne({ email: trimmedEmail });
        if (!user || !user.password) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                surname: user.surname,
                email: user.email
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Errore durante il login: ' + err.message });
    }
});

app.post('/api/v1/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Token mancante" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token non valido o scaduto" });

        try {
            const user = await User.findById(decoded.sub || decoded.id);
            if (!user || user.refreshToken !== refreshToken) {
                return res.status(403).json({ error: "Sessione invalidata da un nuovo login" });
            }

            const newAccessToken = jwt.sign(
                { sub: user._id, email: user.email, name: user.name, surname: user.surname, provider: 'local' }, 
                JWT_SECRET, 
                { expiresIn: '15m' }
            );
            res.status(200).json({ accessToken: newAccessToken, token: newAccessToken });
        } catch (dbErr) {
            res.status(500).json({ error: "Errore database utenti" });
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
        const user = await User.findOne({ email: trimmedEmail });
    
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
    
        user.resetPasswordToken = token;
        user.resetPasswordExpires = expires;
        await user.save();
        
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
            res.status(200).json({
                message: tpl.apiMsg,
                previewUrl: null
            });
        }
      } catch (err) {
          console.error('[Forgot Password] Errore:', err.message);
          res.status(500).json({ error: 'Errore interno del server' });
      }
});


app.get('/api/v1/verify-reset-token', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ valid: false, error: 'Token mancante' });
    }

    try {
        const now = Date.now();
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: now }
        });

        if (!user) {
            return res.status(400).json({ valid: false, error: 'Link di recupero non valido o scaduto.' });
        }

        res.status(200).json({ valid: true, email: user.email });
    } catch (err) {
        res.status(500).json({ valid: false, error: 'Errore interno del server' });
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
        const now = Date.now();
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: now }
        });

        if (!user) {
            return res.status(400).json({ error: rMsg.invalid });
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.refreshToken = undefined;
        await user.save();

        res.status(200).json({
            message: rMsg.success
        });
    } catch (err) {
        console.error('[Reset Password] Errore:', err);
        res.status(500).json({ error: 'Errore durante l\'aggiornamento della password: ' + err.message });
    }
});

// =======================================================
// API: Google SSO
// =======================================================

app.post('/api/v1/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        // Decodifica il token di Google (o usa la libreria google-auth-library)
        // ... estrai email, name, surname, sub (googleId) dal token ...

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, surname, email, googleId });
            await user.save();
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        res.json({
            accessToken,
            refreshToken,
            user: { id: user._id, name: user.name, surname: user.surname, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ error: 'Errore autenticazione Google: ' + err.message });
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
        const userId = req.user.sub || req.user.userId;
        const preferiti = await Favorite.find({ userId });
        const formatted = preferiti.map(f => ({
            id: f.rastrellieraId,
            tipologia: f.tipologia,
            stalli: f.stalli,
            zona: f.zona,
            lat: f.lat,
            lng: f.lng,
            savedAt: f.createdAt || f.date || new Date()
        }));
        res.json({ preferiti: formatted });
    } catch (err) {
        res.status(500).json({ error: 'Errore recupero preferiti: ' + err.message });
    }
});

app.post('/api/v1/user/preferiti', tokenChecker, async (req, res) => {
    try {
        const { rastrellieraId, tipologia, stalli, zona, lat, lng } = req.body;
        const userId = req.user.sub || req.user.userId;

        let fav = await Favorite.findOne({ userId, rastrellieraId });
        if (!fav) {
            fav = new Favorite({ userId, rastrellieraId, tipologia, stalli, zona, lat, lng });
            await fav.save();
        }
        res.status(201).json({ message: 'Preferito salvato con successo', favorite: fav });
    } catch (err) {
        res.status(500).json({ error: 'Errore salvataggio preferito: ' + err.message });
    }
});

app.delete('/api/v1/user/preferiti/:id', tokenChecker, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.userId;
        const rastrellieraId = Number(req.params.id);

        await Favorite.findOneAndDelete({ userId, rastrellieraId });
        res.json({ message: 'Preferito rimosso con successo' });
    } catch (err) {
        res.status(500).json({ error: 'Errore rimozione preferito: ' + err.message });
    }
});

// =======================================================
// API: Aggiornamento Profilo, Password e Notifiche (RF 3.2, RF 3.3)
// =======================================================
app.put('/api/v1/user/profile', tokenChecker, async (req, res) => {
    try {
        const { name, surname, currentPassword, newPassword, notificheEmail } = req.body;
        const userId = req.user.sub;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Utente non trovato' });

        if (name && String(name).trim().length >= 2) user.name = String(name).trim();
        if (surname && String(surname).trim().length >= 2) user.surname = String(surname).trim();

        if (notificheEmail !== undefined) {
            user.notifiche = { email: Boolean(notificheEmail) };
        }

        if (newPassword) {
            if (!user.password) {
                return res.status(400).json({ error: 'Gli account registrati con Google non possono modificare la password locale' });
            }
            if (!currentPassword) {
                return res.status(400).json({ error: 'Inserisci la password attuale per confermare la modifica' });
            }

            const isMatch = await bcrypt.compare(String(currentPassword), user.password);
            if (!isMatch) return res.status(401).json({ error: 'La password attuale non è corretta' });

            if (!PASSWORD_REGEX.test(String(newPassword))) {
                return res.status(400).json({ error: 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un carattere speciale' });
            }

            user.password = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
        }

        await user.save();

        const newToken = jwt.sign(
            { sub: user._id, email: user.email, name: user.name, surname: user.surname, provider: user.password ? 'local' : 'google' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Profilo aggiornato con successo',
            token: newToken,
            user: {
                name: user.name,
                surname: user.surname,
                email: user.email,
                notifiche: user.notifiche || { email: true }
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Errore durante l\'aggiornamento del profilo: ' + err.message });
    }
});

/**
 * DELETE /api/v1/user/account — RF 3.4 (Cancellazione definitiva Account GDPR)
 * Elimina l'utente dal database users.json e cancella tutte le sue segnalazioni e preferiti associati
 */
app.delete('/api/v1/user/account', tokenChecker, async (req, res) => {
    try {
        const userId = req.user.sub;

        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) return res.status(404).json({ error: 'Utente non trovato' });

        // Pulizia dati associati su MongoDB
        await Favorite.deleteMany({ userId });
        await Segnalazione.deleteMany({ userId }); // Se in Segnalazioni salvi il riferimento allo userId

        res.json({ success: true, message: 'Account e dati personali eliminati definitivamente con successo.' });
    } catch (err) {
        res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'account: ' + err.message });
    }
});

// =======================================================
// API: Segnalazioni (protette da JWT)
// =======================================================

app.post('/api/v1/segnalazioni', tokenChecker, async (req, res) => {
    try {
        const { rastrellieraId, tipo, note, lat, lng } = req.body;
        const userId = req.user.sub || req.user.userId; // <-- Fondamentale

        const nuovaSegnalazione = new Segnalazione({ 
            userId, // <-- Deve essere salvato qui dentro
            rastrellieraId, 
            tipo, 
            note, 
            lat, 
            lng 
        });
        
        await nuovaSegnalazione.save();
        res.status(201).json({ message: 'Segnalazione salvata' });
    } catch (err) {
        res.status(500).json({ error: 'Errore salvataggio segnalazione: ' + err.message });
    }
});

app.get('/api/v1/segnalazioni/user', tokenChecker, async (req, res) => {
    try {
        const userId = req.user.sub || req.user.userId;
        const items = await Segnalazione.find({ userId }).sort({ createdAt: -1 });
        
        const segnalazioni = items.map(s => ({
            id: s._id,
            rastrellieraId: s.rastrellieraId,
            tipo: s.tipo,
            note: s.note,
            lat: s.lat,
            lng: s.lng,
            timestamp: s.createdAt,
            stato: s.stato || 'inviata'
        }));

        res.json({ segnalazioni });
    } catch (err) {
        res.status(500).json({ error: 'Errore recupero segnalazioni utente: ' + err.message });
    }
});

app.get('/api/v1/segnalazioni/recenti', async (req, res) => {
    try {
        const segnalazioni = await Segnalazione.find().sort({ createdAt: -1 }).limit(50);
        res.json({ segnalazioni });
    } catch (err) {
        res.status(500).json({ error: 'Errore recupero segnalazioni: ' + err.message });
    }
});

// =======================================================
// API: Routing In-App con OpenRouteService (RF 3.4)
// =======================================================
app.get('/api/v1/routing', async (req, res) => {
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

    // Profili consentiti: cycling-regular (default) o foot-walking
    const validProfiles = ['cycling-regular', 'foot-walking', 'driving-car'];
    const chosenProfile = validProfiles.includes(profile) ? profile : 'cycling-regular';

    const apiKey = (process.env.ORS_API_KEY ? process.env.ORS_API_KEY.trim() : '') || ORS_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            error: 'OpenRouteService API key non configurata sul server. Aggiungere ORS_API_KEY nel file .env.'
        });
    }

    try {
        const lang = ['it', 'en', 'de'].includes(req.query.language) ? req.query.language : 'it';
        const orsUrl = `https://api.openrouteservice.org/v2/directions/${chosenProfile}/geojson`;
        const response = await fetch(orsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify({
                coordinates: [
                    [sLng, sLat],
                    [eLng, eLat]
                ],
                language: lang,
                instructions: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Routing Error ORS]', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Errore durante il calcolo del percorso da OpenRouteService'
            });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('[Routing Server Exception]', err);
        res.status(500).json({ error: 'Errore interno durante la richiesta di percorso' });
    }
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚲 Cycle Place → http://localhost:${PORT}`);
    console.log(`   Google SSO: ${GOOGLE_CLIENT_ID ? '✅ Configurato' : '⚠️  Non configurato'}`);
});
