/**
 * security.js — Middleware di sicurezza per Cycle Place
 * Configura gli header HTTP difensivi (CSP, HSTS, X-Frame, Nosniff, Referrer, Permissions)
 * e la gestione sicura del CORS per la messa online.
 */

function securityHeaders(req, res, next) {
    // Rimuove l'header che identifica Express per evitare fingerprinting
    res.removeHeader('X-Powered-By');

    // Previene il MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Protegge contro attacchi di Clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Limita l'esposizione dei referrer
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Disabilita API hardware non necessarie, consente la geolocalizzazione per la mappa
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');

    // Necessario per consentire il corretto funzionamento del popup di Google SSO (OAuth)
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    // Content Security Policy calibrata per Cycle Place
    const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://unpkg.com https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com",
        "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://lh3.googleusercontent.com https://cdn.jsdelivr.net",
        "connect-src 'self' https://accounts.google.com https://api.open-meteo.com https://router.project-osrm.org",
        "frame-src 'self' https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ];

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // Se la richiesta è su HTTPS (o segnalata come HTTPS dal proxy), abilita HSTS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
}

/**
 * Validazione e sanitizzazione stringhe contro XSS (server-side)
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    securityHeaders,
    sanitizeString
};
