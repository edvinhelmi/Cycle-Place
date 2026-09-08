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
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const SALT_ROUNDS = 10;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key';

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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '455956234516-62c55ghdcsl2tffohcancm7is467jgda.apps.googleusercontent.com';
const ORS_API_KEY      = (process.env.ORS_API_KEY ? process.env.ORS_API_KEY.trim() : '') || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjBkZmY3MGY1NjJiYTQ0OTE5NWQwNWNmOTQ3ODU3NmE2IiwiaCI6Im11cm11cjY0In0=';

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

app.post('/api/v1/register', (req, res) => {
    const { name, surname, email, password } = req.body;
    if (!name || !surname || !email || !password) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    const trimmedName = String(name).trim();
    const trimmedSurname = String(surname).trim();
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

    readJsonFile(usersFile, async (err, users) => {
        if (err) users = [];
        if (users.find(u => u.email && u.email.toLowerCase() === trimmedEmail)) {
            return res.status(409).json({ error: 'Utente già registrato con questa email' });
        }

        try {
            // Hashing sicuro della password prima di salvarla
            const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);

            users.push({
                id: Date.now().toString(),
                name: trimmedName,
                surname: trimmedSurname,
                email: trimmedEmail,
                password: hashedPassword
            });

            writeJsonFile(usersFile, users, werr => {
                if (werr) return res.status(500).json({ error: 'Errore nel salvataggio utente' });
                res.status(201).json({ message: 'Registrazione completata con successo' });
            });
        } catch (hashErr) {
            console.error('[Bcrypt] Errore hashing:', hashErr);
            return res.status(500).json({ error: 'Errore interno durante la registrazione' });
        }
    });
});

app.post('/api/v1/login', authLimiter, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password sono obbligatorie' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);

    if (!EMAIL_REGEX.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Formato email non valido' });
    }

    readJsonFile(usersFile, async (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore interno del server' });
        
        // 1. Cerca l'utente tramite email
        const user = users.find(u => u.email && u.email.toLowerCase() === trimmedEmail);
        if (!user) {
            return res.status(401).json({ error: 'Credenziali non valide. Controlla email e password.' });
        }

        try {
            // 2. Confronta la password con l'hash memorizzato
            const isMatch = await bcrypt.compare(cleanPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Credenziali non valide. Controlla email e password.' });
            }

            // 3. Genera Access Token (15m) e Refresh Token (30d)
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
            
            // 4. Salva il refresh token su file formattato come hash SHA-256 (FIX)
            const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
            user.refreshToken = hashedRefreshToken;
            writeJsonFile(usersFile, users, (werr) => {
                if (werr) return res.status(500).json({ error: 'Errore nel salvataggio della sessione' });
            
                res.status(200).json({ 
                    message: "Login effettuato",
                    accessToken,
                    token: accessToken,
                    refreshToken,
                    user: { name: user.name, surname: user.surname, email: user.email } 
                });
            });
        } catch (compareErr) {
            console.error('[Bcrypt] Errore verifica password:', compareErr);
            return res.status(500).json({ error: 'Errore durante la verifica delle credenziali' });
        }
    });
});

app.post('/api/v1/refresh-token', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Token mancante" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token non valido o scaduto" });

        readJsonFile(usersFile, (uErr, users) => {
            if (uErr) return res.status(500).json({ error: "Errore lettura database utenti" });

            const user = users.find(u => u.id === decoded.id);
            if (!user || !user.refreshToken) {
                return res.status(403).json({ error: "Nessuna sessione attiva o sessione invalidata" });
            }

            // Applica l'hashing al token in ingresso e confrontalo con quello salvato
            const hashedInput = crypto.createHash('sha256').update(refreshToken).digest('hex');
            if (user.refreshToken !== hashedInput) {
                return res.status(403).json({ error: "Sessione invalidata da un nuovo login" });
            }

            // Genera nuovo Access Token a 15 minuti
            const newAccessToken = jwt.sign(
                { sub: user.id, email: user.email, name: user.name, surname: user.surname, provider: 'local' }, 
                JWT_SECRET, 
                { expiresIn: '15m' }
            );
            res.status(200).json({ accessToken: newAccessToken, token: newAccessToken });
        });
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

app.post('/api/v1/forgot-password', authLimiter, (req, res) => {
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

    readJsonFile(usersFile, async (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore interno del server' });

        const user = users.find(u => u.email && u.email.toLowerCase() === trimmedEmail);

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

        writeJsonFile(usersFile, users, async (werr) => {
            if (werr) return res.status(500).json({ error: 'Errore durante il salvataggio della richiesta' });

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
        });
    });
});

app.get('/api/v1/verify-reset-token', (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ valid: false, error: 'Token mancante' });
    }

    readJsonFile(usersFile, (err, users) => {
        if (err) return res.status(500).json({ valid: false, error: 'Errore interno del server' });

        const now = Date.now();
        const user = users.find(u => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > now);

        if (!user) {
            return res.status(400).json({ valid: false, error: 'Link di recupero non valido o scaduto.' });
        }

        res.status(200).json({ valid: true, email: user.email });
    });
});

app.post('/api/v1/reset-password', authLimiter, (req, res) => {
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

    readJsonFile(usersFile, async (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore interno del server' });

        const now = Date.now();
        const user = users.find(u => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > now);

        if (!user) {
            return res.status(400).json({ error: rMsg.invalid });
        }

        try {
            const hashedPassword = await bcrypt.hash(cleanPassword, SALT_ROUNDS);
            user.password = hashedPassword;
            delete user.resetPasswordToken;
            delete user.resetPasswordExpires;
            delete user.refreshToken;

            writeJsonFile(usersFile, users, (werr) => {
                if (werr) return res.status(500).json({ error: 'Errore durante il salvataggio della password' });

                res.status(200).json({
                    message: rMsg.success
                });
            });
        } catch (hashErr) {
            console.error('[Bcrypt] Errore hashing password:', hashErr);
            return res.status(500).json({ error: 'Errore durante l\'aggiornamento della password' });
        }
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

        const googleId = payload['sub'];
        const email = (payload['email'] || '').toLowerCase().trim();
        const name = payload['given_name'] || payload['name'] || '';
        const surname = payload['family_name'] || '';
        const picture = payload['picture'] || '';

        readJsonFile(usersFile, (err, users) => {
            if (err) users = [];

            // Cerca utente esistente per googleId o email
            let user = users.find(u => (u.googleId && u.googleId === googleId) || (u.email && u.email.toLowerCase() === email));

            if (user) {
                // Collega googleId se non presente e aggiorna informazioni profilo
                user.googleId = googleId;
                if (!user.name && name) user.name = name;
                if (!user.surname && surname) user.surname = surname;
                if (picture) user.picture = picture;
            } else {
                // Crea nuovo profilo utente federato Google
                user = {
                    id: Date.now().toString(),
                    googleId: googleId,
                    name: name,
                    surname: surname,
                    email: email,
                    picture: picture
                };
                users.push(user);
            }

            writeJsonFile(usersFile, users, (werr) => {
                if (werr) {
                    console.error('[Google SSO] Errore salvataggio utente:', werr);
                    return res.status(500).json({ error: 'Errore durante il salvataggio dei dati utente' });
                }

                const token = jwt.sign({
                    sub: user.id,
                    googleId: googleId,
                    email: user.email,
                    name: user.name,
                    surname: user.surname,
                    picture: user.picture || picture,
                    provider: 'google'
                }, JWT_SECRET, { expiresIn: '24h' });

                res.status(200).json({
                    token,
                    user: {
                        name: user.name,
                        surname: user.surname,
                        email: user.email,
                        picture: user.picture || picture
                    }
                });
            });
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
        const preferiti = data[req.user.sub] || (req.user.googleId && data[req.user.googleId]) || [];
        res.status(200).json({ preferiti });
    });
});

app.post('/api/v1/user/preferiti', tokenChecker, (req, res) => {
    const { rastrellieraId, tipologia, stalli, zona, lat, lng } = req.body;
    if (rastrellieraId === undefined) return res.status(400).json({ error: 'rastrellieraId obbligatorio' });

    readJsonFile(preferitiFile, (err, data) => {
        if (err) data = {};
        const uid = req.user.sub;
        if (!data[uid]) data[uid] = [];
        const numId = Number(rastrellieraId);
        if (data[uid].find(f => Number(f.id) === numId || f.id === rastrellieraId))
            return res.status(409).json({ error: 'Già nei preferiti' });

        data[uid].push({ id: numId, tipologia, stalli, zona, lat, lng, savedAt: new Date().toISOString() });
        writeJsonFile(preferitiFile, data, werr => {
            if (werr) return res.status(500).json({ error: 'Errore salvataggio preferiti' });
            res.status(201).json({ message: 'Aggiunto ai preferiti' });
        });
    });
});

app.delete('/api/v1/user/preferiti/:id', tokenChecker, (req, res) => {
    const id = parseInt(req.params.id, 10);
    readJsonFile(preferitiFile, (err, data) => {
        if (err) return res.status(500).json({ error: 'Errore lettura preferiti' });
        const uid = req.user.sub;
        if (!data[uid]) return res.status(404).json({ error: 'Nessun preferito trovato' });
        data[uid] = data[uid].filter(f => Number(f.id) !== id && f.id !== req.params.id);
        writeJsonFile(preferitiFile, data, werr => {
            if (werr) return res.status(500).json({ error: 'Errore salvataggio' });
            res.status(200).json({ message: 'Rimosso dai preferiti' });
        });
    });
});

// =======================================================
// API: Aggiornamento Profilo, Password e Notifiche (RF 3.2, RF 3.3)
// =======================================================
app.put('/api/v1/user/profile', tokenChecker, (req, res) => {
    const { name, surname, currentPassword, newPassword, notificheEmail} = req.body;
    const userId = req.user.sub;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;
    const userGoogleId = req.user.googleId || (req.user.provider === 'google' ? req.user.sub : null);

    readJsonFile(usersFile, async (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore nella lettura del database utenti' });
        
        const userIndex = users.findIndex(u => 
            u.id === userId || 
            (u.googleId && (u.googleId === userId || (userGoogleId && u.googleId === userGoogleId))) ||
            (userEmail && u.email && u.email.toLowerCase() === userEmail)
        );
        if (userIndex === -1) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const user = users[userIndex];

        // 1. Aggiornamento Anagrafica di base
        if (name && String(name).trim().length >= 2) {
            user.name = String(name).trim();
        }
        if (surname && String(surname).trim().length >= 2) {
            user.surname = String(surname).trim();
        }

        // 2. Aggiornamento Preferenze Notifiche
        if (notificheEmail !== undefined) {
            user.notifiche = {
                email: notificheEmail !== undefined ? Boolean(notificheEmail) : (user.notifiche?.email ?? true),
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

            try {
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

                user.password = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
            } catch (pErr) {
                console.error('[Profile Update] Errore cambio password:', pErr);
                return res.status(500).json({ error: 'Errore durante la modifica della password' });
            }
        }

        users[userIndex] = user;

        writeJsonFile(usersFile, users, werr => {
            if (werr) return res.status(500).json({ error: 'Errore nel salvataggio del profilo' });

            // Genera nuovo JWT aggiornato con i nuovi dati anagrafici
            const newToken = jwt.sign(
                { sub: user.id, email: user.email, name: user.name, surname: user.surname, provider: user.password ? 'local' : 'google' },
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
        });
    });
});

/**
 * DELETE /api/v1/user/account — RF 3.4 (Cancellazione definitiva Account GDPR)
 * Elimina l'utente dal database users.json e cancella tutte le sue segnalazioni e preferiti associati
 */
app.delete('/api/v1/user/account', tokenChecker, (req, res) => {
    const userId = req.user.sub;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : null;
    const userGoogleId = req.user.googleId || (req.user.provider === 'google' ? req.user.sub : null);

    readJsonFile(usersFile, (err, users) => {
        if (err) return res.status(500).json({ error: 'Errore durante la lettura del database utenti' });

        // Cerca l'utente per id primario, googleId, o email
        const userIndex = users.findIndex(u => 
            u.id === userId || 
            (u.googleId && (u.googleId === userId || (userGoogleId && u.googleId === userGoogleId))) ||
            (userEmail && u.email && u.email.toLowerCase() === userEmail)
        );

        if (userIndex === -1) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const targetUser = users[userIndex];
        const associatedIds = new Set([
            userId,
            targetUser.id,
            targetUser.googleId,
            userGoogleId
        ].filter(Boolean));

        // Rimuovi l'utente dall'array
        users.splice(userIndex, 1);

        writeJsonFile(usersFile, users, (writeErr) => {
            if (writeErr) return res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'account' });

            // GDPR Cleanup 1: Rimuovi le segnalazioni associate all'utente (per id, googleId ed email)
            const segnalazioniFile = path.join(__dirname, 'data', 'segnalazioni.json');
            readJsonFile(segnalazioniFile, (segErr, segnalazioni) => {
                if (!segErr && Array.isArray(segnalazioni)) {
                    const cleanSegnalazioni = segnalazioni.filter(s => {
                        const matchesId = associatedIds.has(s.userId);
                        const matchesEmail = targetUser.email && s.userEmail && s.userEmail.toLowerCase() === targetUser.email.toLowerCase();
                        return !matchesId && !matchesEmail;
                    });
                    writeJsonFile(segnalazioniFile, cleanSegnalazioni, () => {});
                }
            });

            // GDPR Cleanup 2: Rimuovi le posizioni preferite associate all'utente (per tutti gli ID associati)
            const preferitiFile = path.join(__dirname, 'data', 'preferiti.json');
            readJsonFile(preferitiFile, (prefErr, preferitiData) => {
                if (!prefErr && preferitiData) {
                    associatedIds.forEach(id => {
                        delete preferitiData[id];
                    });
                    writeJsonFile(preferitiFile, preferitiData, () => {});
                }
            });

            return res.json({ success: true, message: 'Account e dati personali eliminati definitivamente con successo.' });
        });
    });
});

// =======================================================
// API: Segnalazioni (protette da JWT)
// =======================================================

app.post('/api/v1/segnalazioni', segnalazioniLimiter, tokenChecker, (req, res) => {
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
        res.status(200).json({ segnalazioni: data.filter(s => s.userId === req.user.sub || (req.user.googleId && s.userId === req.user.googleId)) });
    });
});

// GET /api/v1/segnalazioni/recenti — Segnalazioni recenti pubbliche (ultime 48h)
app.get('/api/v1/segnalazioni/recenti', (req, res) => {
    readJsonFile(segFile, (err, data) => {
        if (err || !Array.isArray(data)) return res.status(200).json({ segnalazioni: [] });
        
        const now = Date.now();
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

        // Filtra quelle recenti e non risolte, omettendo dati privati (userId, userEmail)
        const recenti = data
            .filter(s => s.stato !== 'risolta' && (now - new Date(s.timestamp).getTime()) < FORTY_EIGHT_HOURS)
            .map(s => ({
                rastrellieraId: s.rastrellieraId,
                tipo: s.tipo,
                timestamp: s.timestamp
            }));

        res.status(200).json({ segnalazioni: recenti });
    });
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

app.listen(PORT, () => {
    console.log(`\n🚲 Cycle Place → http://localhost:${PORT}`);
    console.log(`   Google SSO: ${GOOGLE_CLIENT_ID ? '✅ Configurato' : '⚠️  Non configurato'}`);
});
