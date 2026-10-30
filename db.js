/**
 * db.js — Layer di Persistenza Dati Ibrido per Cycle Place
 * 
 * Supporta:
 * 1. PostgreSQL (Vercel Postgres / Neon / Supabase) se è definita POSTGRES_URL o DATABASE_URL
 * 2. File JSON locali / /tmp come fallback per sviluppo locale e test Jest
 */

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

function resolveStaticDataPath() {
    const candidates = [
        path.join(__dirname, 'data'),
        path.join(process.cwd(), 'data'),
        path.join(__dirname, '..', 'data')
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    return candidates[0];
}
const staticDataPath  = resolveStaticDataPath();
const isServerless    = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dynamicDataPath = isServerless ? path.join('/tmp', 'cycle-place-data') : staticDataPath;

const usersFile       = path.join(dynamicDataPath, 'users.json');
const preferitiFile   = path.join(dynamicDataPath, 'preferiti.json');
const segFile         = path.join(dynamicDataPath, 'segnalazioni.json');

// --- Inizializzazione File JSON Fallback ---
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

// Helper I/O asincroni per JSON
async function readJson(file, defaultVal) {
    try {
        if (!fs.existsSync(file)) return defaultVal;
        const text = await fs.promises.readFile(file, 'utf8');
        return JSON.parse(text);
    } catch {
        return defaultVal;
    }
}
async function writeJson(file, data) {
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ====================================================================
// Configurazione Database PostgreSQL
// ====================================================================
const connectionString = (process.env.NODE_ENV !== 'test') ? (process.env.POSTGRES_URL || process.env.DATABASE_URL) : null;
let pool = null;
let isPgInitialized = false;

if (connectionString) {
    pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 6000,
        ssl: { rejectUnauthorized: false }
    });
    console.log('[Database] Configurato client PostgreSQL per persistenza cloud');
} else {
    console.log('[Database] Modalità File JSON attiva (sviluppo locale/test)');
}

async function initPostgresTables() {
    if (!pool || isPgInitialized) return;
    try {
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    surname VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255),
                    google_id VARCHAR(255),
                    picture TEXT,
                    notifiche_email BOOLEAN DEFAULT TRUE,
                    reset_password_token VARCHAR(255),
                    reset_password_expires BIGINT,
                    refresh_token VARCHAR(255),
                    privacy_accepted BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS preferiti (
                    user_id VARCHAR(64) NOT NULL,
                    rack_id INTEGER NOT NULL,
                    tipologia VARCHAR(100),
                    stalli INTEGER DEFAULT 0,
                    zona VARCHAR(255),
                    lat DOUBLE PRECISION,
                    lng DOUBLE PRECISION,
                    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, rack_id)
                );

                CREATE TABLE IF NOT EXISTS segnalazioni (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64),
                    user_email VARCHAR(255),
                    rastrelliera_id INTEGER NOT NULL,
                    tipo VARCHAR(100) NOT NULL,
                    note TEXT,
                    lat DOUBLE PRECISION,
                    lng DOUBLE PRECISION,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    stato VARCHAR(50) DEFAULT 'inviata'
                );
            `);
            isPgInitialized = true;
            console.log('[Database] Tabelle PostgreSQL verificate/create con successo');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[Database] Errore inizializzazione tabelle PostgreSQL:', err.message);
    }
}

function mapUserRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        name: row.name,
        surname: row.surname,
        email: row.email,
        password: row.password || null,
        googleId: row.google_id || null,
        picture: row.picture || null,
        notifiche: { email: Boolean(row.notifiche_email ?? true) },
        resetPasswordToken: row.reset_password_token || null,
        resetPasswordExpires: row.reset_password_expires ? Number(row.reset_password_expires) : null,
        refreshToken: row.refresh_token || null,
        privacyAccepted: Boolean(row.privacy_accepted ?? true),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
    };
}

// ====================================================================
// Interfaccia DAO (Data Access Object) Unificata
// ====================================================================

const db = {
    isPostgres: () => Boolean(pool),

    // --- UTENTI ---
    async findUserByEmail(email) {
        if (!email) return null;
        const normalized = email.toLowerCase().trim();
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [normalized]);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        return users.find(u => u.email && u.email.toLowerCase() === normalized) || null;
    },

    async findUserById(id) {
        if (!id) return null;
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [String(id)]);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        return users.find(u => u.id === String(id) || u.googleId === String(id)) || null;
    },

    async findUserByGoogleId(googleId) {
        if (!googleId) return null;
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [String(googleId)]);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        return users.find(u => u.googleId === String(googleId)) || null;
    },

    async findUserByResetToken(token) {
        if (!token) return null;
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM users WHERE reset_password_token = $1 LIMIT 1', [token]);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        return users.find(u => u.resetPasswordToken === token) || null;
    },

    async createUser(userData) {
        if (pool) {
            await initPostgresTables();
            const query = `
                INSERT INTO users (
                    id, name, surname, email, password, google_id, picture, 
                    notifiche_email, reset_password_token, reset_password_expires, 
                    refresh_token, privacy_accepted, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;
            const values = [
                userData.id,
                userData.name,
                userData.surname,
                userData.email.toLowerCase().trim(),
                userData.password || null,
                userData.googleId || null,
                userData.picture || null,
                userData.notifiche?.email !== undefined ? Boolean(userData.notifiche.email) : true,
                userData.resetPasswordToken || null,
                userData.resetPasswordExpires || null,
                userData.refreshToken || null,
                userData.privacyAccepted !== undefined ? Boolean(userData.privacyAccepted) : true,
                userData.createdAt ? new Date(userData.createdAt) : new Date()
            ];
            const res = await pool.query(query, values);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        users.push(userData);
        await writeJson(usersFile, users);
        return userData;
    },

    async updateUser(id, updates) {
        if (pool) {
            await initPostgresTables();
            const fields = [];
            const values = [];
            let idx = 1;

            if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
            if (updates.surname !== undefined) { fields.push(`surname = $${idx++}`); values.push(updates.surname); }
            if (updates.email !== undefined) { fields.push(`email = $${idx++}`); values.push(updates.email.toLowerCase().trim()); }
            if (updates.password !== undefined) { fields.push(`password = $${idx++}`); values.push(updates.password); }
            if (updates.googleId !== undefined) { fields.push(`google_id = $${idx++}`); values.push(updates.googleId); }
            if (updates.picture !== undefined) { fields.push(`picture = $${idx++}`); values.push(updates.picture); }
            if (updates.notifiche !== undefined) {
                fields.push(`notifiche_email = $${idx++}`);
                values.push(Boolean(updates.notifiche.email));
            }
            if (updates.resetPasswordToken !== undefined) { fields.push(`reset_password_token = $${idx++}`); values.push(updates.resetPasswordToken); }
            if (updates.resetPasswordExpires !== undefined) { fields.push(`reset_password_expires = $${idx++}`); values.push(updates.resetPasswordExpires); }
            if (updates.refreshToken !== undefined) { fields.push(`refresh_token = $${idx++}`); values.push(updates.refreshToken); }

            if (fields.length === 0) return this.findUserById(id);

            values.push(String(id));
            const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
            const res = await pool.query(query, values);
            return mapUserRow(res.rows[0]);
        }
        const users = await readJson(usersFile, []);
        const idx = users.findIndex(u => u.id === String(id) || u.googleId === String(id) || (u.email && updates.email && u.email.toLowerCase() === updates.email.toLowerCase()));
        if (idx === -1) return null;
        Object.assign(users[idx], updates);
        await writeJson(usersFile, users);
        return users[idx];
    },

    async deleteUser(id) {
        if (pool) {
            await initPostgresTables();
            await pool.query('DELETE FROM users WHERE id = $1', [String(id)]);
            await pool.query('DELETE FROM preferiti WHERE user_id = $1', [String(id)]);
            await pool.query('UPDATE segnalazioni SET user_email = NULL WHERE user_id = $1', [String(id)]);
            return true;
        }
        let users = await readJson(usersFile, []);
        const user = users.find(u => u.id === String(id));
        users = users.filter(u => u.id !== String(id));
        await writeJson(usersFile, users);

        const prefs = await readJson(preferitiFile, {});
        delete prefs[String(id)];
        if (user && user.googleId) delete prefs[user.googleId];
        await writeJson(preferitiFile, prefs);

        let segs = await readJson(segFile, []);
        segs = segs.map(s => (s.userId === String(id) || (user && user.email && s.userEmail && s.userEmail.toLowerCase() === user.email.toLowerCase())) ? { ...s, userEmail: null } : s);
        await writeJson(segFile, segs);
        return true;
    },

    // --- PREFERITI ---
    async getPreferitiByUser(userId) {
        if (!userId) return [];
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM preferiti WHERE user_id = $1 ORDER BY saved_at DESC', [String(userId)]);
            return res.rows.map(r => ({
                id: Number(r.rack_id),
                tipologia: r.tipologia,
                stalli: Number(r.stalli || 0),
                zona: r.zona || '',
                lat: r.lat !== null ? Number(r.lat) : null,
                lng: r.lng !== null ? Number(r.lng) : null,
                savedAt: r.saved_at ? new Date(r.saved_at).toISOString() : new Date().toISOString()
            }));
        }
        const prefs = await readJson(preferitiFile, {});
        return prefs[String(userId)] || [];
    },

    async addPreferito(userId, item) {
        if (!userId || !item) return false;
        const rackId = Number(item.id || item.rastrellieraId);
        if (pool) {
            await initPostgresTables();
            const query = `
                INSERT INTO preferiti (user_id, rack_id, tipologia, stalli, zona, lat, lng, saved_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (user_id, rack_id) DO NOTHING
            `;
            const res = await pool.query(query, [
                String(userId),
                rackId,
                item.tipologia || '',
                Number(item.stalli || 0),
                item.zona || '',
                item.lat ? Number(item.lat) : null,
                item.lng ? Number(item.lng) : null,
                item.savedAt ? new Date(item.savedAt) : new Date()
            ]);
            return res.rowCount > 0;
        }
        const prefs = await readJson(preferitiFile, {});
        if (!prefs[String(userId)]) prefs[String(userId)] = [];
        if (prefs[String(userId)].some(f => Number(f.id) === rackId)) {
            return false; // Duplicato
        }
        prefs[String(userId)].push({
            id: rackId,
            tipologia: item.tipologia || '',
            stalli: Number(item.stalli || 0),
            zona: item.zona || '',
            lat: item.lat || null,
            lng: item.lng || null,
            savedAt: item.savedAt || new Date().toISOString()
        });
        await writeJson(preferitiFile, prefs);
        return true;
    },

    async removePreferito(userId, rackId) {
        if (!userId || rackId === undefined) return false;
        const numId = Number(rackId);
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('DELETE FROM preferiti WHERE user_id = $1 AND rack_id = $2', [String(userId), numId]);
            return res.rowCount > 0;
        }
        const prefs = await readJson(preferitiFile, {});
        if (!prefs[String(userId)]) return false;
        const before = prefs[String(userId)].length;
        prefs[String(userId)] = prefs[String(userId)].filter(f => Number(f.id) !== numId && f.id !== rackId);
        const removed = prefs[String(userId)].length < before;
        await writeJson(preferitiFile, prefs);
        return removed;
    },

    // --- SEGNALAZIONI ---
    async addSegnalazione(seg) {
        if (pool) {
            await initPostgresTables();
            const query = `
                INSERT INTO segnalazioni (id, user_id, user_email, rastrelliera_id, tipo, note, lat, lng, timestamp, stato)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            const values = [
                seg.id,
                seg.userId ? String(seg.userId) : null,
                seg.userEmail || null,
                Number(seg.rastrellieraId),
                seg.tipo,
                seg.note || '',
                seg.lat ? Number(seg.lat) : null,
                seg.lng ? Number(seg.lng) : null,
                seg.timestamp ? new Date(seg.timestamp) : new Date(),
                seg.stato || 'inviata'
            ];
            await pool.query(query, values);
            return seg;
        }
        const segs = await readJson(segFile, []);
        segs.push(seg);
        await writeJson(segFile, segs);
        return seg;
    },

    async getSegnalazioniByUser(userId) {
        if (!userId) return [];
        if (pool) {
            await initPostgresTables();
            const res = await pool.query('SELECT * FROM segnalazioni WHERE user_id = $1 ORDER BY timestamp DESC', [String(userId)]);
            return res.rows.map(r => ({
                id: r.id,
                userId: r.user_id,
                userEmail: r.user_email,
                rastrellieraId: Number(r.rastrelliera_id),
                tipo: r.tipo,
                note: r.note || '',
                lat: r.lat ? Number(r.lat) : null,
                lng: r.lng ? Number(r.lng) : null,
                timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
                stato: r.stato || 'inviata'
            }));
        }
        const segs = await readJson(segFile, []);
        return segs.filter(s => s.userId === String(userId));
    },

    async getSegnalazioniRecenti(hours = 48) {
        if (pool) {
            await initPostgresTables();
            const res = await pool.query(`
                SELECT rastrelliera_id AS "rastrellieraId", tipo, timestamp 
                FROM segnalazioni 
                WHERE stato != 'risolta' AND timestamp >= NOW() - ($1 || ' hours')::INTERVAL 
                ORDER BY timestamp DESC
            `, [String(hours)]);
            return res.rows.map(r => ({
                rastrellieraId: Number(r.rastrellieraId),
                tipo: r.tipo,
                timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
            }));
        }
        const segs = await readJson(segFile, []);
        const now = Date.now();
        const maxAge = hours * 60 * 60 * 1000;
        return segs
            .filter(s => s.stato !== 'risolta' && (now - new Date(s.timestamp).getTime()) < maxAge)
            .map(s => ({
                rastrellieraId: s.rastrellieraId,
                tipo: s.tipo,
                timestamp: s.timestamp
            }));
    }
};

module.exports = db;
