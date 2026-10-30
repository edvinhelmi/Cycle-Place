const app = require('../app');

module.exports = (req, res) => {
    // Normalizza il percorso richiesto per compatibilità con il rewrite di Vercel
    const original = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-now-route-matches'];
    if (original && original.startsWith('/api/')) {
        const queryIndex = (req.url || '').indexOf('?');
        const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
        req.url = original.includes('?') ? original : (original + queryString);
    } else if (req.url && req.url.startsWith('/v1/')) {
        req.url = '/api' + req.url;
    }

    return app(req, res);
};
