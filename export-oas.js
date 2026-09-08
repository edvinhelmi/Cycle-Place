const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

process.env.NODE_ENV = 'test';
const app = require('./app');

// 1. Estrazione rotte registrate da Express
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

// 2. Metadati completi allineati a app.js
const routeMetadata = {
    'GET /api/v1/rastrelliere': {
        tags: ['Dati Spaziali'],
        summary: 'Recupera tutte le rastrelliere con telemetria smart IoT in tempo reale',
        responses: {
            '200': { description: 'GeoJSON FeatureCollection con rastrelliere e telemetria' },
            '500': { description: 'Errore lettura file o trasformazione coordinate' }
        }
    },
    'GET /api/v1/parcheggi': {
        tags: ['Dati Spaziali'],
        summary: 'Recupera i parcheggi protetti per biciclette',
        responses: {
            '200': { description: 'GeoJSON FeatureCollection dei parcheggi protetti' },
            '500': { description: 'Errore lettura file o trasformazione coordinate' }
        }
    },
    'GET /api/v1/config': {
        tags: ['Configurazione'],
        summary: 'Restituisce le chiavi di configurazione pubblica per il frontend',
        responses: {
            '200': { description: 'Google Client ID per autenticazione SSO' }
        }
    },
    'POST /api/v1/register': {
        tags: ['Autenticazione'],
        summary: 'Registra un nuovo account utente con password cifrata (bcrypt)',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['name', 'surname', 'email', 'password'],
                        properties: {
                            name: { type: 'string', example: 'Mario' },
                            surname: { type: 'string', example: 'Rossi' },
                            email: { type: 'string', format: 'email', example: 'mario.rossi@example.com' },
                            password: { type: 'string', format: 'password', example: 'PasswordSicura123!' }
                        }
                    }
                }
            }
        },
        responses: {
            '201': { description: 'Registrazione completata con successo' },
            '400': { description: 'Campi obbligatori mancanti o requisiti di complessità password non rispettati' },
            '409': { description: 'Utente già registrato con questo indirizzo email' },
            '500': { description: 'Errore interno del server durante il salvataggio' }
        }
    },
    'POST /api/v1/login': {
        tags: ['Autenticazione'],
        summary: 'Autentica utente locale e rilascia Access Token (15m) e Refresh Token (30d)',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['email', 'password'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                            password: { type: 'string', format: 'password' }
                        }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Login completato con successo' },
            '400': { description: 'Email o password mancanti o non valide' },
            '401': { description: 'Credenziali errate' },
            '429': { description: 'Troppi tentativi falliti: blocco temporaneo (Rate limit)' },
            '500': { description: 'Errore interno del server' }
        }
    },
    'POST /api/v1/refresh-token': {
        tags: ['Autenticazione'],
        summary: 'Rinnova l\'Access Token scaduto tramite Refresh Token valido',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['refreshToken'],
                        properties: { refreshToken: { type: 'string' } }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Nuovo Access Token generato' },
            '401': { description: 'Token mancante' },
            '403': { description: 'Token non valido, scaduto o sessione invalidata' },
            '500': { description: 'Errore lettura database utenti' }
        }
    },
    'POST /api/v1/forgot-password': {
        tags: ['Autenticazione'],
        summary: 'Invia email con link monouso per il reset della password',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['email'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                            lang: { type: 'string', enum: ['it', 'en', 'de'], default: 'it' }
                        }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Email inviata con successo (o risposta anti-enumeration)' },
            '400': { description: 'Formato email non valido o utente registrato via Google SSO' },
            '429': { description: 'Troppi tentativi inviati (Rate limit attivo)' },
            '500': { description: 'Errore durante la generazione o salvataggio richiesta' }
        }
    },
    'GET /api/v1/verify-reset-token': {
        tags: ['Autenticazione'],
        summary: 'Verifica la validità e scadenza del token di recupero password',
        parameters: [
            { name: 'token', in: 'query', required: true, schema: { type: 'string' }, description: 'Token a 64 caratteri esadecimali' }
        ],
        responses: {
            '200': { description: 'Token valido e non scaduto' },
            '400': { description: 'Token mancante, non valido o scaduto' },
            '500': { description: 'Errore interno del server' }
        }
    },
    'POST /api/v1/reset-password': {
        tags: ['Autenticazione'],
        summary: 'Imposta una nuova password tramite il token di recupero',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['token', 'newPassword'],
                        properties: {
                            token: { type: 'string' },
                            newPassword: { type: 'string', format: 'password' },
                            lang: { type: 'string', enum: ['it', 'en', 'de'], default: 'it' }
                        }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Password aggiornata con successo' },
            '400': { description: 'Token scaduto, assente o password troppo breve' },
            '429': { description: 'Troppi tentativi (Rate limit attivo)' },
            '500': { description: 'Errore durante il salvataggio o hashing' }
        }
    },
    'POST /api/v1/auth/google': {
        tags: ['Autenticazione'],
        summary: 'Autenticazione o registrazione con Google Identity Services (OAuth2/SSO)',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['credential'],
                        properties: {
                            credential: { type: 'string', description: 'ID Token JWT firmato da Google' }
                        }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Autenticazione completata con rilascio del token applicativo' },
            '400': { description: 'Token Google mancante' },
            '401': { description: 'Verifica fallita: token non valido o scaduto' },
            '500': { description: 'Configurazione Google Client ID mancante o errore salvataggio' }
        }
    },
    'GET /api/v1/auth/verify': {
        tags: ['Autenticazione'],
        summary: 'Verifica la validità dell\'Access Token JWT corrente',
        security: [{ bearerAuth: [] }],
        responses: {
            '200': { description: 'Token valido' },
            '401': { description: 'Token non autorizzato, mancante o scaduto' }
        }
    },
    'GET /api/v1/user/me': {
        tags: ['Utente'],
        summary: 'Restituisce i dati del profilo utente autenticato',
        security: [{ bearerAuth: [] }],
        responses: {
            '200': { description: 'Dati profilo recuperati con successo' },
            '401': { description: 'Non autorizzato' }
        }
    },
    'PUT /api/v1/user/profile': {
        tags: ['Utente'],
        summary: 'Aggiorna dati anagrafici, cambio password e preferenze notifiche',
        security: [{ bearerAuth: [] }],
        requestBody: {
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            surname: { type: 'string' },
                            currentPassword: { type: 'string', format: 'password' },
                            newPassword: { type: 'string', format: 'password' },
                            notificheEmail: { type: 'boolean' }
                        }
                    }
                }
            }
        },
        responses: {
            '200': { description: 'Profilo aggiornato e nuovo JWT rigenerato' },
            '400': { description: 'Nuova password debole o account Google privo di password' },
            '401': { description: 'Password attuale errata' },
            '404': { description: 'Utente non trovato' },
            '500': { description: 'Errore interno durante il salvataggio' }
        }
    },
    'DELETE /api/v1/user/account': {
        tags: ['Utente'],
        summary: 'Cancellazione definitiva account e pulizia dati personali (GDPR)',
        security: [{ bearerAuth: [] }],
        responses: {
            '200': { description: 'Account, segnalazioni e preferiti eliminati con successo' },
            '401': { description: 'Non autorizzato' },
            '404': { description: 'Utente non trovato' },
            '500': { description: 'Errore durante l\'eliminazione dell\'account' }
        }
    },
    'GET /api/v1/user/preferiti': {
        tags: ['Preferiti'],
        summary: 'Restituisce l\'elenco delle rastrelliere e parcheggi salvati come preferiti',
        security: [{ bearerAuth: [] }],
        responses: {
            '200': { description: 'Lista preferiti recuperata' },
            '401': { description: 'Non autorizzato' }
        }
    },
    'POST /api/v1/user/preferiti': {
        tags: ['Preferiti'],
        summary: 'Aggiunge una rastrelliera o parcheggio ai preferiti dell\'utente',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['rastrellieraId'],
                        properties: {
                            rastrellieraId: { type: 'integer' },
                            tipologia: { type: 'string' },
                            stalli: { type: 'integer' },
                            zona: { type: 'string' },
                            lat: { type: 'number' },
                            lng: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            '201': { description: 'Elemento aggiunto ai preferiti' },
            '400': { description: 'rastrellieraId obbligatorio' },
            '401': { description: 'Non autorizzato' },
            '409': { description: 'Elemento già presente nei preferiti' },
            '500': { description: 'Errore nel salvataggio preferiti' }
        }
    },
    'DELETE /api/v1/user/preferiti/{id}': {
        tags: ['Preferiti'],
        summary: 'Rimuove una rastrelliera o parcheggio dai preferiti',
        security: [{ bearerAuth: [] }],
        parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID della rastrelliera o parcheggio' }
        ],
        responses: {
            '200': { description: 'Rimosso dai preferiti' },
            '401': { description: 'Non autorizzato' },
            '404': { description: 'Nessun preferito trovato' },
            '500': { description: 'Errore durante la rimozione' }
        }
    },
    'POST /api/v1/segnalazioni': {
        tags: ['Segnalazioni'],
        summary: 'Invia una segnalazione di guasto o problema su una rastrelliera',
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['rastrellieraId', 'tipo'],
                        properties: {
                            rastrellieraId: { type: 'integer' },
                            tipo: { type: 'string', example: 'danno_strutturale, vandalismo' },
                            note: { type: 'string' },
                            lat: { type: 'number' },
                            lng: { type: 'number' }
                        }
                    }
                }
            }
        },
        responses: {
            '201': { description: 'Segnalazione registrata con successo' },
            '400': { description: 'rastrellieraId e tipo obbligatori' },
            '401': { description: 'Non autorizzato' },
            '429': { description: 'Troppe segnalazioni inviate (Rate limit attivo)' },
            '500': { description: 'Errore durante il salvataggio della segnalazione' }
        }
    },
    'GET /api/v1/segnalazioni/user': {
        tags: ['Segnalazioni'],
        summary: 'Recupera lo storico segnalazioni inviate dall\'utente autenticato',
        security: [{ bearerAuth: [] }],
        responses: {
            '200': { description: 'Storico segnalazioni recuperato' },
            '401': { description: 'Non autorizzato' }
        }
    },
    'GET /api/v1/segnalazioni/recenti': {
        tags: ['Segnalazioni'],
        summary: 'Restituisce le segnalazioni aperte delle ultime 48 ore (dati personali anonimizzati)',
        responses: {
            '200': { description: 'Lista segnalazioni recenti' }
        }
    },
    'GET /api/v1/routing': {
        tags: ['Routing'],
        summary: 'Calcola itinerario ciclabile, pedonale o in auto con OpenRouteService e failover OSRM',
        parameters: [
            { name: 'startLat', in: 'query', required: true, schema: { type: 'number' }, description: 'Latitudine di partenza' },
            { name: 'startLng', in: 'query', required: true, schema: { type: 'number' }, description: 'Longitudine di partenza' },
            { name: 'endLat', in: 'query', required: true, schema: { type: 'number' }, description: 'Latitudine di arrivo' },
            { name: 'endLng', in: 'query', required: true, schema: { type: 'number' }, description: 'Longitudine di arrivo' },
            { name: 'profile', in: 'query', schema: { type: 'string', enum: ['cycling-regular', 'foot-walking', 'driving-car'], default: 'cycling-regular' } },
            { name: 'language', in: 'query', schema: { type: 'string', enum: ['it', 'en', 'de'], default: 'it' } }
        ],
        responses: {
            '200': { description: 'Tracciato GeoJSON con manovre turn-by-turn' },
            '400': { description: 'Parametri obbligatori mancanti o coordinate non numeriche' },
            '504': { description: 'Timeout superato per il calcolo del tragitto (oltre 4.5s)' }
        }
    }
};

// 3. Struttura base OpenAPI 3.0.3 con componenti
const oas = {
    openapi: '3.0.3',
    info: {
        title: 'Cycle Place API',
        version: '1.0.0',
        description: 'Backend API per la gestione di rastrelliere, parcheggi protetti, preferiti utente, segnalazioni e routing ciclabile.'
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
        },
        schemas: {
            UserSummary: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    surname: { type: 'string' },
                    email: { type: 'string', format: 'email' }
                }
            },
            Preferito: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    tipologia: { type: 'string' },
                    stalli: { type: 'integer' },
                    zona: { type: 'string' },
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    savedAt: { type: 'string', format: 'date-time' }
                }
            },
            Segnalazione: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    rastrellieraId: { type: 'integer' },
                    tipo: { type: 'string' },
                    note: { type: 'string' },
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' },
                    stato: { type: 'string', example: 'inviata' }
                }
            }
        }
    }
};

// 4. Mappatura garantita sulle rotte Express
registeredRoutes.forEach(({ method, path: expressPath }) => {
    if (expressPath === '*' || !expressPath.startsWith('/api/')) return;

    const oasPath = expressPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    if (!oas.paths[oasPath]) oas.paths[oasPath] = {};

    const key = `${method.toUpperCase()} ${oasPath}`;
    const customMeta = routeMetadata[key] || {};

    oas.paths[oasPath][method] = {
        summary: customMeta.summary || `Endpoint ${key}`,
        tags: customMeta.tags || ['API'],
        ...(customMeta.parameters ? { parameters: customMeta.parameters } : {}),
        ...(customMeta.requestBody ? { requestBody: customMeta.requestBody } : {}),
        ...(customMeta.security ? { security: customMeta.security } : {}),
        responses: customMeta.responses || { '200': { description: 'Operazione completata' } }
    };
});

// 5. Scrittura del file oas3.yaml nella root
fs.writeFileSync(path.join(__dirname, 'oas3.yaml'), YAML.stringify(oas), 'utf8');
console.log('✅ File oas3.yaml definitivo generato con successo!');