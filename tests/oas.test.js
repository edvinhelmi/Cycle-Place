const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const app = require('../app');

function getRegisteredRoutes(expressApp) {
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

describe('OpenAPI Specification Coverage Test', () => {
    const oasPath = path.join(__dirname, '../oas3.yaml');
    let oas;

    beforeAll(() => {
        expect(fs.existsSync(oasPath)).toBe(true);
        const fileContent = fs.readFileSync(oasPath, 'utf8');
        oas = YAML.parse(fileContent);

        console.log('\n--- DIAGNOSTICA OAS3 ---');
        console.log('Percorso letto:', oasPath);
        console.log('Numero chiavi paths trovate nello YAML:', oas && oas.paths ? Object.keys(oas.paths).length : 'NESSUNA (undefined)');
        if (oas && oas.paths) {
            console.log('Primi 3 path nello YAML:', Object.keys(oas.paths).slice(0, 3));
        }
        console.log('------------------------\n');
    });

    test('oas3.yaml ha una struttura valida', () => {
        expect(oas).toBeDefined();
        expect(oas.openapi).toMatch(/^3\./);
        expect(oas.info).toBeDefined();
        expect(oas.paths).toBeDefined();
    });

    test('Tutte le rotte di Express sono mappate in oas3.yaml', () => {
        const expressRoutes = getRegisteredRoutes(app);
        const documentedPaths = oas.paths || {};
        const missingRoutes = [];

        expressRoutes.forEach((route) => {
            if (route.path === '*' || !route.path.startsWith('/api/')) return;

            // Express usa :id, OpenAPI usa {id}
            const oasFormattedPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

            const pathItem = documentedPaths[oasFormattedPath] || documentedPaths[route.path];
            if (!pathItem || !pathItem[route.method]) {
                missingRoutes.push(`${route.method.toUpperCase()} ${route.path}`);
            }
        });

        if (missingRoutes.length > 0) {
            console.error('Rotte mancanti in oas3.yaml:\n', missingRoutes.join('\n'));
        }

        expect(missingRoutes).toEqual([]);
    });
});