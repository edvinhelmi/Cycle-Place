const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Imposta l'ambiente di test così app.js non blocca la porta con app.listen
process.env.NODE_ENV = 'test';
const app = require('./app');

// 1. Estrae tutte le rotte registrate da Express
function extractRoutes(expressApp) {
    const routes = [];
    if (!expressApp._router || !expressApp._router.stack) return routes;

    expressApp._router.stack.forEach((middleware) => {
        if (middleware.route) {
            const routePath = middleware.route.path;
            const methods = Object.keys(middleware.route.methods);
            methods.forEach((m) => {
                routes.push({ method: m.toLowerCase(), path: routePath });
            });
        }
    });
    return routes;
}

const registeredRoutes = extractRoutes(app);

// 2. Struttura base OpenAPI 3.0
const oas = {
    openapi: '3.0.3',
    info: {
        title: 'Cycle Place API',
        version: '1.0.0',
        description: 'Documentazione OpenAPI estratta automaticamente dalle rotte Express'
    },
    servers: [
        { url: 'http://localhost:3000', description: 'Server locale di sviluppo' }
    ],
    paths: {},
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    }
};

// 3. Compila la sezione paths convertendo le rotte di Express
registeredRoutes.forEach(({ method, path: expressPath }) => {
    // Escludi fallback SPA (*) o rotte non-API
    if (expressPath === '*' || !expressPath.startsWith('/api/')) return;

    // Converte parametri Express (:id) in parametri OpenAPI ({id})
    const oasPath = expressPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

    if (!oas.paths[oasPath]) {
        oas.paths[oasPath] = {};
    }

    // Estrae eventuali parametri di percorso ({id})
    const pathParams = [];
    const matches = expressPath.match(/:([a-zA-Z0-9_]+)/g);
    if (matches) {
        matches.forEach(param => {
            pathParams.push({
                name: param.substring(1),
                in: 'path',
                required: true,
                schema: { type: 'string' }
            });
        });
    }

    // Identifica se l'endpoint è sotto middleware di autenticazione
    const isProtected = expressPath.includes('/user/') || 
                        (expressPath === '/api/v1/segnalazioni' && method === 'post');

    oas.paths[oasPath][method] = {
        summary: `Endpoint ${method.toUpperCase()} ${expressPath}`,
        responses: {
            '200': { description: 'Operazione completata con successo' }
        }
    };

    if (pathParams.length > 0) {
        oas.paths[oasPath][method].parameters = pathParams;
    }

    if (isProtected) {
        oas.paths[oasPath][method].security = [{ bearerAuth: [] }];
        oas.paths[oasPath][method].responses['401'] = { description: 'Non autorizzato' };
    }

    if (['post', 'put', 'patch'].includes(method)) {
        oas.paths[oasPath][method].requestBody = {
            required: true,
            content: {
                'application/json': {
                    schema: { type: 'object' }
                }
            }
        };
    }
});

// 4. Scrivi il file oas3.yaml
const targetPath = path.join(__dirname, 'oas3.yaml');
fs.writeFileSync(targetPath, YAML.stringify(oas), 'utf8');

console.log(`✅ File oas3.yaml generato con successo a partire da ${registeredRoutes.length} rotte registrate!`);