const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.SUPER_SECRET || 'segreto_universitario_trento_bike_parking';

/**
 * Middleware che verifica il token JWT nell'header Authorization.
 * Se valido, aggiunge req.user con il payload decodificato e chiama next().
 */
module.exports = function tokenChecker(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Accesso non autorizzato: token JWT mancante. Effettua il login.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Sessione scaduta. Effettua nuovamente il login.'
            : 'Token non valido. Effettua nuovamente il login.';
        return res.status(401).json({ error: msg });
    }
};
