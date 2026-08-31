/**
 * script.js — Trento Bike Parking
 * Task 1: Dashboard + Preferiti (❤️)
 * Task 2: Filtri additivi per layer
 * Task 3: Segnalazioni guasti
 * Task 4: Multilingua IT / EN / DE
 * RF3: Ricerca Spaziale per Via e Nome Parcheggio
 * User Story 1: Geolocalizzazione GPS ("La mia posizione")
 */

// =======================================================
// TASK 4 — i18n: dizionario multilingua (IT / EN / DE)
// =======================================================
const TRANSLATIONS = {
    it: {
        'nav.login':     'Login',
        'nav.register':  'Registrati',
        'nav.logout':    'Logout',
        'nav.dashboard': 'Dashboard',
        'filter.title':        'Filtri',
        'filter.tradizionali': 'Rastrelliere Tradizionali',
        'filter.bloccatelaio': 'Rastrelliere Bloccatelaio',
        'filter.parcheggi':    'Parcheggi Protetti',
        'filter.nascondiPiene':'Nascondi rastrelliere piene',
        'legend.title':        'Legenda',
        'legend.button':       'Legenda',
        'legend.tradizionale': 'Rastrelliera tradizionale',
        'legend.bloccatelaio': 'Rastrelliera bloccatelaio',
        'legend.piena':        'Bloccatelaio piena (0 posti)',
        'legend.parcheggio':   'Parcheggio protetto',

        'search.placeholder':  'Cerca via o parcheggio...',
        'search.button':       'Cerca',
        'search.noResults':    'Nessun parcheggio trovato in questa zona',
        'search.found':        'Trovati {n} risultati',
        'geo.title':           'La mia posizione',
        'geo.button':          'La mia posizione',
        'geo.locating':        'Rilevamento in corso...',
        'geo.youAreHere':      'Ti trovi qui',
        'geo.accuracy':        'Precisione segnale',
        'geo.errorPermission': 'Impossibile rilevare la posizione: autorizzazione negata nel browser.',
        'geo.errorUnavailable':'Segnale GPS non disponibile al momento.',
        'geo.errorTimeout':    'Tempo scaduto per il rilevamento della posizione.',
        'geo.notSupported':    'La geolocalizzazione non è supportata dal tuo browser.',
        'modal.login.title':    'Login',
        'modal.register.title': 'Registrazione',
        'modal.segnala.title':  'Segnala un problema',
        'modal.or':             'oppure',
        'form.name':        'Nome',
        'form.surname':     'Cognome',
        'form.password':    'Password',
        'form.tipoProblem': 'Tipo di problema',
        'form.notes':       'Note aggiuntive',
        'form.sendReport':  'Invia segnalazione',
        'seg.bikeLeft':   'Bici abbandonata',
        'seg.damage':     'Danno strutturale',
        'seg.full':       'Rastrelliera piena',
        'seg.vandalism':  'Vandalismo',
        'seg.other':      'Altro',
        'popup.fav.add':    'Salva nei preferiti',
        'popup.fav.remove': 'Salvato',
        'popup.report':     'Segnala problema',
        'popup.loginToFav': 'Accedi per salvare nei preferiti',
        'popup.loginToReport': 'Accedi per segnalare un problema.',
        'popup.directions': 'Indicazioni stradali',

        'popup.gisInfo':    'Info GIS',
        'popup.gisLink':    'Sito Comune ↗',
        'popup.smartLive':  'Disponibilità in tempo reale',
        'popup.freeSlots':  'Posti liberi',
        'popup.occupiedSlots': 'Occupati',
        'popup.type':       'Tipologia',
        'popup.model':      'Modello',
        'popup.slots':      'Posti bici',
        'popup.zone':       'Zona',
        'popup.building':   'Edificio',
        'popup.address':    'Indirizzo',
        'popup.capacity':   'Capienza',
        'popup.surveillance':'Sorveglianza',
        'popup.present':    'Presente',
        'popup.access':     'Accesso',
        'popup.mittLink':   'Sito MITT ↗',
        'stats.racks':      'Rastrelliere',
        'stats.protected':  'Parcheggi protetti',
        'stats.slots':      'Stalli totali',
    },
    en: {
        'nav.login':     'Login',
        'nav.register':  'Register',
        'nav.logout':    'Logout',
        'nav.dashboard': 'Dashboard',
        'filter.title':        'Filters',
        'filter.tradizionali': 'Traditional Racks',
        'filter.bloccatelaio': 'Frame-Lock Racks',
        'filter.parcheggi':    'Protected Parking',
        'filter.nascondiPiene':'Hide full racks',
        'legend.title':        'Legend',
        'legend.button':       'Legend',
        'legend.tradizionale': 'Traditional rack',
        'legend.bloccatelaio': 'Frame-lock rack',
        'legend.piena':        'Full frame-lock rack (0 slots)',
        'legend.parcheggio':   'Protected parking',
        'search.placeholder':  'Search street or parking...',
        'search.button':       'Search',
        'search.noResults':    'No parking found in this area',
        'search.found':        'Found {n} results',
        'geo.title':           'My location',
        'geo.button':          'My location',
        'geo.locating':        'Locating...',
        'geo.youAreHere':      'You are here',
        'geo.accuracy':        'Accuracy',
        'geo.errorPermission': 'Unable to detect location: permission denied in browser.',
        'geo.errorUnavailable':'GPS position unavailable at this time.',
        'geo.errorTimeout':    'Location request timed out.',
        'geo.notSupported':    'Geolocation is not supported by your browser.',
        'modal.login.title':    'Login',
        'modal.register.title': 'Register',
        'modal.segnala.title':  'Report an issue',
        'modal.or':             'or',
        'form.name':        'First Name',
        'form.surname':     'Last Name',
        'form.password':    'Password',
        'form.tipoProblem': 'Issue type',
        'form.notes':       'Additional notes',
        'form.sendReport':  'Submit report',
        'seg.bikeLeft':   'Abandoned bike',
        'seg.damage':     'Structural damage',
        'seg.full':       'Rack is full',
        'seg.vandalism':  'Vandalism',
        'seg.other':      'Other',
        'popup.fav.add':    'Save to favourites',
        'popup.fav.remove': 'Saved',
        'popup.report':     'Report issue',
        'popup.check':      'Check real-time availability',
        'popup.loginToFav': 'Log in to save favourites',
        'popup.loginToReport': 'Log in to submit a report.',
        'popup.directions': 'Get directions',
        'popup.gisInfo':    'GIS Info',
        'popup.gisLink':    'Municipality Site ↗',
        'popup.smartLive':  'Real-time availability',
        'popup.freeSlots':  'Available slots',
        'popup.occupiedSlots': 'Occupied',
        'popup.type':       'Type',
        'popup.model':      'Model',
        'popup.slots':      'Bike slots',
        'popup.zone':       'Zone',
        'popup.building':   'Building',
        'popup.address':    'Address',
        'popup.capacity':   'Capacity',
        'popup.surveillance':'Surveillance',
        'popup.present':    'Present',
        'popup.access':     'Access',
        'popup.mittLink':   'MITT Website ↗',
        'stats.racks':      'Bike racks',
        'stats.protected':  'Protected parking',
        'stats.slots':      'Total slots',
    },
    de: {
        'nav.login':     'Anmelden',
        'nav.register':  'Registrieren',
        'nav.logout':    'Abmelden',
        'nav.dashboard': 'Dashboard',
        'filter.title':        'Filter',
        'filter.tradizionali': 'Traditionelle Fahrradständer',
        'filter.bloccatelaio': 'Rahmensichere Ständer',
        'filter.parcheggi':    'Geschützte Parkplätze',
        'filter.nascondiPiene':'Volle Ständer ausblenden',
        'legend.title':        'Legende',
        'legend.button':       'Legende',
        'legend.tradizionale': 'Traditioneller Ständer',
        'legend.bloccatelaio': 'Rahmensicherer Ständer',
        'legend.piena':        'Voller Rahmensicherer Ständer (0 Plätze)',
        'legend.parcheggio':   'Geschützter Parkplatz',

        'search.placeholder':  'Straße oder Parkplatz suchen...',
        'search.button':       'Suchen',
        'search.noResults':    'Kein Parkplatz in diesem Bereich gefunden',
        'search.found':        '{n} Ergebnisse gefunden',
        'geo.title':           'Mein Standort',
        'geo.button':          'Mein Standort',
        'geo.locating':        'Standort wird ermittelt...',
        'geo.youAreHere':      'Sie befinden sich hier',
        'geo.accuracy':        'Genauigkeit',
        'geo.errorPermission': 'Standort konnte nicht ermittelt werden: Berechtigung verweigert.',
        'geo.errorUnavailable':'GPS-Position derzeit nicht verfügbar.',
        'geo.errorTimeout':    'Zeitüberschreitung bei der Standortabfrage.',
        'geo.notSupported':    'Geolokalisierung wird von Ihrem Browser nicht unterstützt.',
        'modal.login.title':    'Anmelden',
        'modal.register.title': 'Registrierung',
        'modal.segnala.title':  'Problem melden',
        'modal.or':             'oder',
        'form.name':        'Vorname',
        'form.surname':     'Nachname',
        'form.password':    'Passwort',
        'form.tipoProblem': 'Problemart',
        'form.notes':       'Zusätzliche Anmerkungen',
        'form.sendReport':  'Meldung senden',
        'seg.bikeLeft':   'Verlassenes Fahrrad',
        'seg.damage':     'Strukturschaden',
        'seg.full':       'Ständer ist voll',
        'seg.vandalism':  'Vandalismus',
        'seg.other':      'Sonstiges',
        'popup.fav.add':    'Zu Favoriten',
        'popup.fav.remove': 'Gespeichert',
        'popup.report':     'Problem melden',
        'popup.check':      'Echtzeit-Verfügbarkeit prüfen',
        'popup.loginToFav': 'Anmelden um Favoriten zu speichern',
        'popup.loginToReport': 'Melden Sie sich an, um ein Problem zu melden.',
        'popup.directions': 'Route berechnen',
        'popup.gisInfo':    'GIS-Info',
        'popup.gisLink':    'Gemeinde-Portal ↗',
        'popup.smartLive':  'Echtzeit-Verfügbarkeit',
        'popup.freeSlots':  'Freie Plätze',
        'popup.occupiedSlots': 'Belegt',
        'popup.type':       'Typ',
        'popup.model':      'Modell',
        'popup.slots':      'Fahrradplätze',
        'popup.zone':       'Zone',
        'popup.building':   'Gebäude',
        'popup.address':    'Adresse',
        'popup.capacity':   'Kapazität',
        'popup.surveillance':'Überwachung',
        'popup.present':    'Vorhanden',
        'popup.access':     'Zugang',
        'popup.mittLink':   'MITT-Website ↗',
        'stats.racks':      'Fahrradständer',
        'stats.protected':  'Geschützte Parkplätze',
        'stats.slots':      'Stellplätze gesamt',
    }
};


const LANG_KEY  = 'tbp_lang';
const TOKEN_KEY = 'tbp_jwt';

let currentLang = localStorage.getItem(LANG_KEY) || 'it';

function tr(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || key;
}

function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = tr(key);
        el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = tr(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = tr(key);
    });
    // Sincronizza il <select> con la lingua corrente
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = currentLang;

    // Sincronizza la bandiera SVG (flag-icons)
    const flagIcon = document.getElementById('lang-flag-icon');
    if (flagIcon) {
        flagIcon.className = currentLang === 'en' ? 'fi fi-gb' : (currentLang === 'de' ? 'fi fi-de' : 'fi fi-it');
    }
}


// =======================================================
// JWT Helpers
// =======================================================
const saveToken   = t  => localStorage.setItem(TOKEN_KEY, t);
const getToken    = () => localStorage.getItem(TOKEN_KEY);
const removeToken = () => localStorage.removeItem(TOKEN_KEY);

function decodeToken(token) {
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
}

function isTokenValid(token) {
    if (!token) return false;
    const d = decodeToken(token);
    return d && d.exp && d.exp * 1000 > Date.now();
}

function authHeaders() {
    return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
}

// =======================================================
// TASK 1: Preferiti in memoria durante la sessione
// =======================================================
let userFavoritiIds = new Set();

async function loadUserPreferiti() {
    if (!isTokenValid(getToken())) return;
    try {
        const res  = await fetch('/api/v1/user/preferiti', { headers: authHeaders() });
        const data = await res.json();
        userFavoritiIds = new Set((data.preferiti || []).map(f => f.id));
    } catch (e) { console.error('Errore caricamento preferiti:', e); }
}

// Funzione globale — chiamata da onclick nel popup
window.toggleFavorito = async function(id, tipologia, stalli, zona, lat, lng) {
    if (!isTokenValid(getToken())) {
        alert(tr('popup.loginToFav'));
        const loginModal = document.getElementById('login-modal');
        if (loginModal) loginModal.classList.remove('hidden');
        return;
    }
    const isFav = userFavoritiIds.has(id);
    try {
        if (isFav) {
            await fetch(`/api/v1/user/preferiti/${id}`, { method: 'DELETE', headers: authHeaders() });
            userFavoritiIds.delete(id);
        } else {
            await fetch('/api/v1/user/preferiti', {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ rastrellieraId: id, tipologia, stalli, zona, lat, lng })
            });
            userFavoritiIds.add(id);
        }
        const btn = document.getElementById(`fav-btn-${id}`);
        if (btn) {
            const isNowFav = userFavoritiIds.has(id);
            const icon = isNowFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
            btn.innerHTML = `${icon} <span class="truncate">${isNowFav ? tr('popup.fav.remove') : tr('popup.fav.add')}</span>`;
            if (isNowFav) {
                btn.className = "popup-btn btn btn-sm btn-error text-white rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5";
            } else {
                btn.className = "popup-btn btn btn-sm btn-outline btn-error rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5";
            }
        }
    } catch (e) { console.error('Errore toggle preferito:', e); }
};

// =======================================================
// TASK 3: Apri modal segnalazione (da onclick popup)
// =======================================================
window.openSegnalazioneModal = function(id, lat, lng) {
    if (!isTokenValid(getToken())) {
        alert(tr('popup.loginToReport') || 'Accedi per segnalare un problema.');
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            loginModal.classList.add('modal-open');
        }
        return;
    }
    const rId = document.getElementById('seg-rastrelliera-id');
    const rLat = document.getElementById('seg-lat');
    const rLng = document.getElementById('seg-lng');
    if (rId) rId.value = id;
    if (rLat) rLat.value = lat;
    if (rLng) rLng.value = lng;
    const err = document.getElementById('seg-error');
    const succ = document.getElementById('seg-success');
    const note = document.getElementById('seg-note');
    if (err) err.textContent = '';
    if (succ) succ.textContent = '';
    if (note) note.value = '';
    const modal = document.getElementById('segnalazione-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('modal-open');
    }
};



// =======================================================
// RF3: Helpers Ricerca Spaziale
// =======================================================
function featureMatchesSearch(props, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    if (!q) return true;

    const fieldsToSearch = [
        props.park,
        props.via,
        props.zona,
        props.edificio,
        props.tipologia,
        props.fumetto,
        props.note,
        props.categoria,
        props.Tipo_generale,
        (props.civico !== null && props.civico !== undefined) ? String(props.civico) : '',
        (props.id !== null && props.id !== undefined) ? String(props.id) : ''
    ];

    return fieldsToSearch.some(field => field && String(field).toLowerCase().includes(q));
}

// =======================================================
// DOM Ready
// =======================================================
document.addEventListener('DOMContentLoaded', async () => {

    applyTranslations();

    // --- TASK 4: Selettore lingua (select IT/EN/DE) ---
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', () => {
            currentLang = langSelect.value;
            localStorage.setItem(LANG_KEY, currentLang);
            applyTranslations();
        });
    }

    // =========================================================
    // 1. MAPPA — inizializzazione
    // =========================================================
    const map = L.map('map').setView([46.0697, 11.1211], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);



    const STILI = {
        tradizionale: { radius: 7,  fillColor: '#2980b9', color: '#1a5276', weight: 1.5, fillOpacity: 0.9  },
        bloccatelaio: { radius: 8,  fillColor: '#e67e22', color: '#a04000', weight: 1.5, fillOpacity: 0.9  },
        piena:        { radius: 7,  fillColor: '#c0392b', color: '#7b241c', weight: 1.5, fillOpacity: 0.9  },
        parcheggio:   { radius: 10, fillColor: '#27ae60', color: '#1a7a40', weight: 2,   fillOpacity: 0.95 }
    };

    const mapErrorBanner = document.getElementById('map-error-banner');
    function showMapError(msg) {
        if (mapErrorBanner) { mapErrorBanner.textContent = '⚠️ ' + msg; mapErrorBanner.classList.remove('hidden'); }
        console.error('[Mappa]', msg);
    }

    // =========================================================
    // 2. MODEL: Stato globale dei dati e Layer Groups
    // =========================================================
    let tutteRastrelliere = null;
    let tuttiParcheggi    = null;
    let currentSearchQuery = '';
    let feedbackTimeout   = null;

    // Layer per la posizione GPS dell'utente (User Story 1)
    let userLocationMarker = null;
    let userAccuracyCircle = null;

    const groupTradizionale = L.layerGroup().addTo(map);
    const groupBloccatelaio = L.layerGroup().addTo(map);
    const groupParcheggi    = L.layerGroup().addTo(map);

    // =========================================================
    // CRUSCOTTO STATISTICHE (Pitch / Demo Video)
    // =========================================================
    let prevStats = { rastrelliere: 0, parcheggi: 0, stalli: 0 };

    /**
     * animateValue: conta da start a end in duration ms e aggiorna il DOM.
     */
    function animateValue(id, start, end, duration = 900) {
        const el = document.getElementById(id);
        if (!el) return;
        if (start === end) { el.textContent = end.toLocaleString('it-IT'); return; }
        const range    = end - start;
        const minStep  = 16; // ~60fps
        const steps    = Math.max(1, Math.round(duration / minStep));
        let   current  = start;
        let   step     = 0;
        const timer = setInterval(() => {
            step++;
            // Easing: ease-out quadratic
            const progress = step / steps;
            const eased    = 1 - (1 - progress) * (1 - progress);
            current = Math.round(start + range * eased);
            el.textContent = current.toLocaleString('it-IT');
            if (step >= steps) {
                clearInterval(timer);
                el.textContent = end.toLocaleString('it-IT');
            }
        }, minStep);
    }

    /**
     * aggiornaStatistiche: calcola le statistiche dai dati correnti e aggiorna il cruscotto.
     * @param {Object|null} visibleRastrelliere  — GeoJSON con le feature rastrelliere attualmente visibili
     * @param {Object|null} visibleParcheggi     — GeoJSON con le feature parcheggi attualmente visibili
     */
    function aggiornaStatistiche(visibleRastrelliere, visibleParcheggi) {
        const rFeatures = (visibleRastrelliere && visibleRastrelliere.features) ? visibleRastrelliere.features : [];
        const pFeatures = (visibleParcheggi    && visibleParcheggi.features)    ? visibleParcheggi.features    : [];

        const numRastrelliere = rFeatures.length;
        const numParcheggi    = pFeatures.length;

        // Somma stalli rastrelliere (n_posti o tot_bici) + capienza parcheggi (posti)
        const stalliRastrelliere = rFeatures.reduce((sum, f) => {
            const v = parseInt(f.properties?.n_posti ?? f.properties?.tot_bici ?? 0, 10);
            return sum + (isNaN(v) ? 0 : v);
        }, 0);
        const stalliParcheggi = pFeatures.reduce((sum, f) => {
            const v = parseInt(f.properties?.posti ?? 0, 10);
            return sum + (isNaN(v) ? 0 : v);
        }, 0);
        const totalStalli = stalliRastrelliere + stalliParcheggi;

        // Anima i contatori
        animateValue('stat-rastrelliere', prevStats.rastrelliere, numRastrelliere);
        animateValue('stat-parcheggi',    prevStats.parcheggi,    numParcheggi);
        animateValue('stat-stalli',       prevStats.stalli,       totalStalli);

        prevStats = { rastrelliere: numRastrelliere, parcheggi: numParcheggi, stalli: totalStalli };
    }

    // =========================================================
    // 3. CONTROLLER: Rendering, Filtri & Ricerca Spaziale (RF3)

    // =========================================================
    function showSearchFeedback(msg, isError = false) {
        const el = document.getElementById('search-feedback');
        if (!el) return;
        el.textContent = msg;
        el.className = isError ? 'search-feedback error' : 'search-feedback';
        el.classList.remove('hidden');

        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            el.classList.add('hidden');
        }, 4000);
    }

    function hideSearchFeedback() {
        const el = document.getElementById('search-feedback');
        if (el) el.classList.add('hidden');
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
    }

    function applyFiltersAndSearch(isExplicitSearch = false) {
        const showTrad   = document.getElementById('filter-tradizionali')?.checked ?? true;
        const showBlocca = document.getElementById('filter-bloccatelaio')?.checked ?? true;
        const showPark   = document.getElementById('filter-parcheggi')?.checked ?? true;
        const hidePiene  = document.getElementById('filter-piene')?.checked ?? false;

        // Pulisci i layer attuali per aggiornare la mappa
        groupTradizionale.clearLayers();
        groupBloccatelaio.clearLayers();
        groupParcheggi.clearLayers();

        const bounds = L.latLngBounds([]);
        let renderedCount = 0;

        // Feature visibili (per cruscotto statistiche)
        const visibleRastrelliere = { type: 'FeatureCollection', features: [] };
        const visibleParcheggi    = { type: 'FeatureCollection', features: [] };

        // 1. Elabora Rastrelliere
        if (tutteRastrelliere && tutteRastrelliere.features) {
            tutteRastrelliere.features.forEach(feature => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates; // [lng, lat]
                const latlng = L.latLng(coords[1], coords[0]);
                const isBlocca = props.Tipo_generale === 'Rastr_bloccatelaio';

                // Controllo ricerca testuale
                if (!featureMatchesSearch(props, currentSearchQuery)) return;

                // Solo le rastrelliere bloccatelaio possono essere piene (se posti_liberi === 0)
                const isPiena = isBlocca && ((props.posti_liberi === 0) || (props.piena === true));
                const typeVisible = isBlocca ? showBlocca : showTrad;
                const pienaVisible = hidePiene ? !isPiena : true;
                if (!typeVisible || !pienaVisible) return;

                // Stile marker:
                // - Bloccatelaio piena (0 posti) -> STILI.piena (ROSSO)
                // - Bloccatelaio con posti liberi -> STILI.bloccatelaio (ARANCIONE)
                // - Tradizionale -> SEMPRE STILI.tradizionale (BLU)
                const stile = isBlocca ? (isPiena ? STILI.piena : STILI.bloccatelaio) : STILI.tradizionale;
                const layer = L.circleMarker(latlng, stile);
                layer.bindPopup(() => buildRastrellieraPopup(props, coords[1], coords[0]), {
                    maxWidth: 320,
                    minWidth: 260,
                    autoPan: true,
                    autoPanPaddingTopLeft: [20, 85],
                    autoPanPaddingBottomRight: [20, 65],
                    className: 'custom-tbp-popup'
                });
                layer.on('click', () => centerOnMarker(latlng, isBlocca));



                (isBlocca ? groupBloccatelaio : groupTradizionale).addLayer(layer);
                visibleRastrelliere.features.push(feature);
                bounds.extend(latlng);
                renderedCount++;
            });
        }

        // 2. Elabora Parcheggi Protetti
        if (tuttiParcheggi && tuttiParcheggi.features) {
            tuttiParcheggi.features.forEach(feature => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;
                const latlng = L.latLng(coords[1], coords[0]);

                if (!featureMatchesSearch(props, currentSearchQuery)) return;
                if (!showPark) return;

                const layer = L.circleMarker(latlng, STILI.parcheggio);
                layer.bindPopup(() => buildParcheggioPopup(props, coords[1], coords[0]), {
                    maxWidth: 320,
                    minWidth: 260,
                    autoPan: true,
                    autoPanPaddingTopLeft: [20, 85],
                    autoPanPaddingBottomRight: [20, 65],
                    className: 'custom-tbp-popup'
                });
                layer.on('click', () => centerOnMarker(latlng, false));

                groupParcheggi.addLayer(layer);
                visibleParcheggi.features.push(feature);
                bounds.extend(latlng);
                renderedCount++;
            });
        }


        // 3. Gestione feedback utente e zoom automatico (fitBounds)
        const clearBtn = document.getElementById('btn-clear-search');
        if (clearBtn) clearBtn.classList.toggle('hidden', !currentSearchQuery);

        if (isExplicitSearch && currentSearchQuery.trim()) {
            if (renderedCount > 0) {
                if (renderedCount === 1) {
                    map.setView(bounds.getCenter(), 17);
                } else if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
                }
                showSearchFeedback(tr('search.found').replace('{n}', renderedCount), false);
            } else {
                showSearchFeedback(tr('search.noResults'), true);
            }
        } else if (!currentSearchQuery.trim()) {
            hideSearchFeedback();
        }

        // 4. Aggiorna indicatore badge filtri su mobile
        updateFilterBadge();

        // 5. Aggiorna cruscotto statistiche
        aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
    }


    function updateFilterBadge() {
        const showTrad   = document.getElementById('filter-tradizionali')?.checked ?? true;
        const showBlocca = document.getElementById('filter-bloccatelaio')?.checked ?? true;
        const showPark   = document.getElementById('filter-parcheggi')?.checked ?? true;
        const hidePiene  = document.getElementById('filter-piene')?.checked ?? false;
        const badge      = document.getElementById('filter-badge');

        const isCustomized = (!showTrad || !showBlocca || !showPark || hidePiene);
        if (badge) {
            badge.classList.toggle('hidden', !isCustomized);
        }
    }

    // =========================================================
    // 4. USER STORY 1: Geolocalizzazione GPS ("La mia posizione")
    // =========================================================
    function handleGeolocation() {
        const btnGeo = document.getElementById('btn-geolocation');

        if (!navigator.geolocation) {
            showSearchFeedback(tr('geo.notSupported'), true);
            return;
        }

        // Feedback visivo sul pulsante durante l'attesa
        if (btnGeo) {
            btnGeo.classList.add('locating');
            const textEl = btnGeo.querySelector('.geo-text');
            if (textEl) textEl.textContent = tr('geo.locating');
        }

        const restoreButton = () => {
            if (btnGeo) {
                btnGeo.classList.remove('locating');
                const textEl = btnGeo.querySelector('.geo-text');
                if (textEl) textEl.textContent = tr('geo.button');
            }
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                restoreButton();
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy || 30; // raggio in metri

                // Rimuovi eventuali indicatori precedenti
                if (userLocationMarker) map.removeLayer(userLocationMarker);
                if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);

                // Cerchio di precisione GPS
                userAccuracyCircle = L.circle([lat, lng], {
                    radius: Math.min(accuracy, 400),
                    color: '#1a73e8',
                    fillColor: '#1a73e8',
                    fillOpacity: 0.15,
                    weight: 1.5
                }).addTo(map);

                // Marker utente dedicato (cerchio blu brillante con bordo bianco)
                userLocationMarker = L.circleMarker([lat, lng], {
                    radius: 9,
                    fillColor: '#1a73e8',
                    color: '#ffffff',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);

                userLocationMarker.bindPopup(`
                    <div class="popup-content" style="text-align:center;">
                        <h3 class="popup-title">📍 ${tr('geo.youAreHere')}</h3>
                        <p><small>${tr('geo.accuracy')}: ±${Math.round(accuracy)}m</small></p>
                    </div>
                `).openPopup();

                // Spostamento fluido verso la posizione dell'utente
                map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
            },
            (error) => {
                restoreButton();
                let errorMsg = tr('geo.errorUnavailable');
                if (error.code === error.PERMISSION_DENIED) {
                    errorMsg = tr('geo.errorPermission');
                } else if (error.code === error.TIMEOUT) {
                    errorMsg = tr('geo.errorTimeout');
                }
                showSearchFeedback(errorMsg, true);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    const btnGeo = document.getElementById('btn-geolocation');
    if (btnGeo) btnGeo.addEventListener('click', handleGeolocation);

    // =========================================================
    // 5. FETCH DATI DAL BACKEND (Salvataggio nel Model)
    // =========================================================
    async function loadMapData() {
        try {
            const res = await fetch('/api/v1/rastrelliere');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            tutteRastrelliere = await res.json();

            // Normalizzazione e sincronizzazione deterministica
            if (tutteRastrelliere && tutteRastrelliere.features) {
                tutteRastrelliere.features.forEach(feature => {
                    const props = feature.properties;
                    const id = props.id || 0;
                    const isBlocca = (props.Tipo_generale === 'Rastr_bloccatelaio');
                    const tot = parseInt(props.tot_bici || props.n_posti || 6, 10);
                    props.tot_bici = tot;
                    props.n_posti = tot;

                    if (props.posti_liberi === undefined || props.posti_occupati === undefined) {
                        if (isBlocca) {
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
                            props.smart_iot = true;
                            props.posti_totali = tot;
                            props.posti_occupati = occupati;
                            props.posti_liberi = liberi;
                            props.percentuale_occupazione = Math.round((occupati / tot) * 100);
                            props.piena = (liberi === 0);
                        } else {
                            // Rastrelliere tradizionali: nessun sensore elettronico, sempre blu (mai piene/rosse)
                            props.smart_iot = false;
                            props.posti_totali = tot;
                            props.posti_occupati = undefined;
                            props.posti_liberi = undefined;
                            props.percentuale_occupazione = undefined;
                            props.piena = false;
                        }
                    } else {
                        props.piena = isBlocca ? (props.posti_liberi === 0) : false;
                    }

                });
            }
            console.log('[API] Rastrelliere caricate e normalizzate:', tutteRastrelliere.features.length);
        } catch (err) { showMapError('Impossibile caricare le rastrelliere: ' + err.message); }

        try {
            const res = await fetch('/api/v1/parcheggi');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            tuttiParcheggi = await res.json();
            console.log('[API] Parcheggi caricati:', tuttiParcheggi.features.length);
        } catch (err) { showMapError('Impossibile caricare i parcheggi: ' + err.message); }

        applyFiltersAndSearch(false);
    }


    // Listener checkbox filtri
    ['filter-tradizionali', 'filter-bloccatelaio', 'filter-parcheggi', 'filter-piene'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => applyFiltersAndSearch(false));
    });

    // Listener Ricerca Spaziale (RF3)
    const searchInput = document.getElementById('search-input');
    const btnSearch   = document.getElementById('btn-search');
    const btnClear    = document.getElementById('btn-clear-search');

    const executeSearch = () => {
        currentSearchQuery = searchInput.value.trim();
        applyFiltersAndSearch(true);
    };

    if (btnSearch) btnSearch.addEventListener('click', executeSearch);

    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch();
            }
        });
        searchInput.addEventListener('input', () => {
            if (btnClear) btnClear.classList.toggle('hidden', !searchInput.value);
            // Se l'utente svuota il campo, ripristina tutti i marker
            if (!searchInput.value.trim() && currentSearchQuery) {
                currentSearchQuery = '';
                applyFiltersAndSearch(false);
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentSearchQuery = '';
            btnClear.classList.add('hidden');
            hideSearchFeedback();
            applyFiltersAndSearch(false);
        });
    }

    // Listener Toggle Filtri per Mobile (RNF1, RNF6)
    const btnFilterToggle = document.getElementById('btn-filter-toggle');
    const filterPanel     = document.getElementById('filter-panel');
    const btnLegendToggle = document.getElementById('btn-legend-toggle');
    const mapLegend       = document.getElementById('map-legend');

    if (btnFilterToggle && filterPanel) {
        btnFilterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof closeMobileMenu === 'function') closeMobileMenu();
            // Chiudi la legenda se aperta
            if (mapLegend && mapLegend.classList.contains('open-mobile')) {
                mapLegend.classList.remove('open-mobile');
                if (btnLegendToggle) btnLegendToggle.classList.remove('active');
            }
            const isOpen = filterPanel.classList.toggle('open-mobile');
            btnFilterToggle.classList.toggle('active', isOpen);
        });

        // Chiudi il menu a discesa dei filtri se si tocca altrove sulla mappa
        document.addEventListener('click', (e) => {
            const searchPanel = document.getElementById('search-panel');
            if (filterPanel.classList.contains('open-mobile')) {
                if (searchPanel && !searchPanel.contains(e.target)) {
                    filterPanel.classList.remove('open-mobile');
                    btnFilterToggle.classList.remove('active');
                }
            }
        });
    }

    // Listener Toggle Legenda per Mobile (RNF1, RNF6)
    if (btnLegendToggle && mapLegend) {
        btnLegendToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof closeMobileMenu === 'function') closeMobileMenu();
            // Chiudi il menu filtri se aperto
            if (filterPanel && filterPanel.classList.contains('open-mobile')) {
                filterPanel.classList.remove('open-mobile');
                if (btnFilterToggle) btnFilterToggle.classList.remove('active');
            }
            const isOpen = mapLegend.classList.toggle('open-mobile');
            btnLegendToggle.classList.toggle('active', isOpen);
        });


        // Chiudi la legenda se si clicca altrove
        document.addEventListener('click', (e) => {
            if (mapLegend.classList.contains('open-mobile')) {
                if (!mapLegend.contains(e.target) && !btnLegendToggle.contains(e.target)) {
                    mapLegend.classList.remove('open-mobile');
                    btnLegendToggle.classList.remove('active');
                }
            }
        });
    }

    // =========================================================
    // Centratura Intelligente con Offset Verticale Adattivo
    // =========================================================

    function centerOnMarker(latlng, isBlocca = false) {
        const targetZoom = Math.max(map.getZoom(), 16);
        const point = map.project(latlng, targetZoom);
        // Offset verticale proporzionato all'altezza della scheda:
        // le bloccatelaio (con telemetria live) richiedono un offset maggiore per non finire sotto la barra di ricerca
        const offsetPixels = isBlocca
            ? (window.innerWidth <= 768 ? 200 : 180)
            : (window.innerWidth <= 768 ? 130 : 110);
        const offsetPoint = point.subtract([0, offsetPixels]);
        const targetLatLng = map.unproject(offsetPoint, targetZoom);

        map.flyTo(targetLatLng, targetZoom, {
            animate: true,
            duration: 0.75
        });
    }

    // =========================================================
    // Popup Builders (Design ad Alto Contrasto e Strutturato)
    // =========================================================
    function buildRastrellieraPopup(props, lat, lng) {
        const isBlocca = props.Tipo_generale === 'Rastr_bloccatelaio';
        const stalli   = props.n_posti ?? props.tot_bici ?? 'N/D';
        const isFav    = userFavoritiIds.has(props.id);

        // Calcolo e risoluzione telemetria IoT realistica
        let freeSlots = props.posti_liberi;
        let occSlots  = props.posti_occupati;
        let occPerc   = props.percentuale_occupazione;

        if (isBlocca && (freeSlots === undefined || occSlots === undefined)) {
            const totNum = parseInt(stalli, 10) || 6;
            const hash = Math.abs(Math.sin((props.id || 1) * 12.9898 + 78.233) * 43758.5453);
            const norm = hash - Math.floor(hash);
            if (norm < 0.08) {
                occSlots = 0;
            } else if (norm > 0.90) {
                occSlots = totNum;
            } else {
                occSlots = Math.round((0.20 + norm * 0.60) * totNum);
                if (totNum > 1) occSlots = Math.min(totNum - 1, Math.max(1, occSlots));
            }
            freeSlots = Math.max(0, totNum - occSlots);
            occPerc   = Math.round((occSlots / totNum) * 100);
        }

        const isPiena = isBlocca && ((props.piena === true) || (freeSlots === 0));

        let themeClass = 'theme-ok';
        let progressColor = 'progress-success';
        if (isPiena || (isBlocca && freeSlots === 0)) {
            themeClass = 'theme-full';
            progressColor = 'progress-error';
        } else if ((occPerc ?? 0) >= 75) {
            themeClass = 'theme-warn';
            progressColor = 'progress-warning';
        }

        const badgeHTML = isBlocca ? '<span class="badge badge-sm badge-accent text-white font-extrabold tracking-wider">BLOCCATELAIO</span>' : '';

        const favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        const favBtn = `<button id="fav-btn-${props.id}" class="popup-btn btn btn-sm ${isFav ? 'btn-error text-white' : 'btn-outline btn-error'} rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="toggleFavorito(${props.id},'${props.Tipo_generale}',${stalli},'${props.zona || ''}',${lat},${lng})">
            ${favIcon} <span class="truncate">${isFav ? tr('popup.fav.remove') : tr('popup.fav.add')}</span>
        </button>`;

        const segBtn = `<button class="popup-btn btn btn-sm btn-warning text-slate-900 font-extrabold rounded-xl flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="openSegnalazioneModal(${props.id},${lat},${lng})">
            <i class="fa-solid fa-triangle-exclamation text-slate-900"></i> <span class="truncate">${tr('popup.report')}</span>
        </button>`;


        // Link Google Maps - Indicazioni stradali in bici
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
        const dirBtn = `
            <a class="popup-btn btn btn-sm btn-primary text-white font-extrabold rounded-xl w-full gap-2 shadow-md mt-2 flex items-center justify-center text-xs py-2 h-auto min-h-[2.4rem] tracking-wide"
                href="${gmapsUrl}"
                target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-diamond-turn-right text-white"></i> <span class="text-white">${tr('popup.directions')}</span>
            </a>`;

        return `
            <div class="popup-content card glass-popup rounded-2xl p-4 text-slate-800 space-y-3">
                <div class="popup-header flex items-center justify-between border-b border-base-200/80 pb-2 pr-7">
                    <h3 class="popup-title font-bold text-base text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-bicycle text-primary"></i> <span>${tr('stats.racks')}</span>
                    </h3>
                    ${badgeHTML}
                </div>
                ${isBlocca ? `
                <div class="popup-iot-card ${themeClass} bg-base-100/90 border border-base-200/90 rounded-2xl p-3 shadow-xs space-y-2">
                    <div class="popup-iot-header flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                            <span class="iot-pulse-dot"></span>
                            <strong class="iot-title font-bold">${tr('popup.smartLive')}</strong>
                        </div>
                        <span class="iot-chip badge badge-sm font-extrabold">${occPerc ?? 0}%</span>
                    </div>
                    <div class="iot-progress-bar w-full">
                        <progress class="progress ${progressColor} w-full h-2.5 rounded-full" value="${occPerc ?? 0}" max="100"></progress>
                    </div>
                    <div class="iot-stats-row flex items-center justify-around rounded-xl p-2 bg-base-200/50">
                        <div class="iot-stat-item free text-center flex-1">
                            <span class="iot-stat-num font-extrabold text-base text-success">${freeSlots ?? 0}</span>
                            <div class="iot-stat-lbl text-[10px] font-bold text-slate-500 uppercase">${tr('popup.freeSlots')}</div>
                        </div>
                        <div class="iot-stat-divider w-[1px] h-6 bg-base-300"></div>
                        <div class="iot-stat-item occupied text-center flex-1">
                            <span class="iot-stat-num font-extrabold text-base text-error">${occSlots ?? 0}</span>
                            <div class="iot-stat-lbl text-[10px] font-bold text-slate-500 uppercase">${tr('popup.occupiedSlots')}</div>
                        </div>
                    </div>
                </div>` : ''}

                <div class="popup-body bg-base-100/80 border border-base-200/80 rounded-2xl p-3 space-y-1.5 text-xs">
                    ${!isBlocca ? `
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-bicycle"></i> ${tr('popup.type')}</span>
                        <span class="popup-val font-bold text-slate-800">Tradizionale</span>
                    </div>` : ''}
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-tag"></i> ${tr('popup.model')}</span>
                        <span class="popup-val font-bold text-slate-800">${props.tipologia || 'Standard'}</span>
                    </div>
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-hashtag"></i> ${tr('popup.slots')}</span>
                        <span class="popup-val font-extrabold text-primary">${stalli} ${tr('dash.stalli')}</span>
                    </div>
                    ${props.zona ? `
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-location-dot"></i> ${tr('popup.zone')}</span>
                        <span class="popup-val font-bold text-slate-800">${props.zona}</span>
                    </div>` : ''}
                    ${props.edificio ? `
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-building"></i> ${tr('popup.building')}</span>
                        <span class="popup-val font-bold text-slate-800">${props.edificio}</span>
                    </div>` : ''}
                    ${isBlocca ? `
                    <div class="popup-row flex items-center justify-between py-1">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-globe"></i> ${tr('popup.gisInfo')}</span>
                        <span class="popup-val">
                            <a href="https://gis.comune.trento.it/it/map/mobilita-sostenibile/"
                               target="_blank" rel="noopener noreferrer" class="link link-primary font-bold">${tr('popup.gisLink')}</a>
                        </span>
                    </div>` : ''}
                </div>
                <div class="popup-actions flex gap-2">
                    ${favBtn}
                    ${segBtn}
                </div>
                ${dirBtn}
            </div>`;
    }

    function buildParcheggioPopup(props, lat, lng) {
        const parkId = props.id || 10001;
        const isFav = userFavoritiIds.has(parkId);
        const stalli = props.posti ?? 0;
        const parkName = (props.park || 'Parcheggio Protetto').replace(/'/g, "\\'");
        const viaName = (props.via || '').replace(/'/g, "\\'");

        const favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        const favBtn = `<button id="fav-btn-${parkId}" class="popup-btn btn btn-sm ${isFav ? 'btn-error text-white' : 'btn-outline btn-error'} rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="toggleFavorito(${parkId},'Parcheggio_protetto',${stalli},'${viaName || parkName}',${lat},${lng})">
            ${favIcon} <span class="truncate">${isFav ? tr('popup.fav.remove') : tr('popup.fav.add')}</span>
        </button>`;

        const segBtn = `<button class="popup-btn btn btn-sm btn-warning text-slate-900 font-extrabold rounded-xl flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="openSegnalazioneModal(${parkId},${lat},${lng})">
            <i class="fa-solid fa-triangle-exclamation text-slate-900"></i> <span class="truncate">${tr('popup.report')}</span>
        </button>`;

        const note = props.note ? `<div class="popup-note alert bg-info/10 border border-info/20 text-info font-medium text-xs rounded-xl p-2.5 flex items-center gap-2 mb-2"><i class="fa-solid fa-circle-info"></i> <span>${props.note}</span></div>` : '';

        // Link Google Maps - Indicazioni stradali in bici
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
        const dirBtn = `
            <a class="popup-btn btn btn-sm btn-primary text-white font-extrabold rounded-xl w-full gap-2 shadow-md mt-2 flex items-center justify-center text-xs py-2 h-auto min-h-[2.4rem] tracking-wide"
                href="${gmapsUrl}"
                target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-diamond-turn-right text-white"></i> <span class="text-white">${tr('popup.directions')}</span>
            </a>`;

        return `
            <div class="popup-content card glass-popup rounded-2xl p-4 text-slate-800 space-y-3">
                <div class="popup-header border-b border-base-200/80 pb-2 pr-7">
                    <h3 class="popup-title font-bold text-base text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-shield-halved text-secondary"></i> <span>${props.park || tr('stats.protected')}</span>
                    </h3>
                </div>
                <div class="popup-body bg-base-100/80 border border-base-200/80 rounded-2xl p-3 space-y-1.5 text-xs">
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-location-dot"></i> ${tr('popup.address')}</span>
                        <span class="popup-val font-bold text-slate-800">${props.via || 'N/D'}</span>
                    </div>
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-hashtag"></i> ${tr('popup.capacity')}</span>
                        <span class="popup-val font-extrabold text-secondary">${props.posti ?? 'N/D'} ${tr('dash.stalli')}</span>
                    </div>
                    <div class="popup-row flex items-center justify-between py-1 border-b border-base-200/60">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-video"></i> ${tr('popup.surveillance')}</span>
                        <span class="popup-val font-bold text-success flex items-center gap-1"><i class="fa-solid fa-check"></i> ${tr('popup.present')}</span>
                    </div>
                    <div class="popup-row flex items-center justify-between py-1">
                        <span class="popup-label text-slate-500 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-key"></i> ${tr('popup.access')}</span>
                        <span class="popup-val">
                            <a href="https://mitt.provincia.tn.it/home/MittOnLineHome.rails"
                               target="_blank" rel="noopener noreferrer" class="link link-primary font-bold">${tr('popup.mittLink')}</a>
                        </span>
                    </div>
                </div>
                ${note}
                <div class="popup-actions flex gap-2">
                    ${favBtn}
                    ${segBtn}
                </div>
                ${dirBtn}
            </div>`;
    }




    await loadMapData();

    // =========================================================
    // UI — Riferimenti DOM (PRIMA di loginSuccess)
    // =========================================================
    const btnLoginModal    = document.getElementById('btn-login-modal');
    const btnRegisterModal = document.getElementById('btn-register-modal');
    const btnDashboard     = document.getElementById('btn-dashboard');
    const btnLogout        = document.getElementById('btn-logout');
    const userGreeting     = document.getElementById('user-greeting');
    const loginModal       = document.getElementById('login-modal');
    const registerModal    = document.getElementById('register-modal');
    const segnalazioneModal= document.getElementById('segnalazione-modal');
    const btnHamburger     = document.getElementById('btn-hamburger');
    const userControls     = document.getElementById('user-controls');

    // =========================================================
    // Mobile Hamburger Menu (RNF1, RNF6)
    // =========================================================
    function toggleMobileMenu() {
        if (!userControls || !btnHamburger) return;
        const isActive = userControls.classList.toggle('active');
        btnHamburger.setAttribute('aria-expanded', String(isActive));
        const iconSpan = btnHamburger.querySelector('.hamburger-icon');
        if (iconSpan) {
            iconSpan.innerHTML = isActive ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        }
        if (isActive) {
            // Chiudi filtri e legenda per evitare sovrapposizioni
            if (filterPanel && filterPanel.classList.contains('open-mobile')) {
                filterPanel.classList.remove('open-mobile');
                if (btnFilterToggle) btnFilterToggle.classList.remove('active');
            }
            if (mapLegend && mapLegend.classList.contains('open-mobile')) {
                mapLegend.classList.remove('open-mobile');
                if (btnLegendToggle) btnLegendToggle.classList.remove('active');
            }
        }
    }

    function closeMobileMenu() {
        if (!userControls || !btnHamburger) return;
        userControls.classList.remove('active');
        btnHamburger.setAttribute('aria-expanded', 'false');
        const iconSpan = btnHamburger.querySelector('.hamburger-icon');
        if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }


    if (btnHamburger) {
        btnHamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });
    }

    // Chiudi il menu mobile quando si clicca su un pulsante di azione
    [btnLoginModal, btnRegisterModal, btnDashboard, btnLogout].forEach(btn => {
        if (btn) btn.addEventListener('click', closeMobileMenu);
    });

    // Chiudi se si clicca fuori dalla navbar
    document.addEventListener('click', (e) => {
        if (userControls && userControls.classList.contains('active')) {
            if (!userControls.contains(e.target) && !btnHamburger.contains(e.target)) {
                closeMobileMenu();
            }
        }
    });

    // =========================================================
    // TASK 1: Stato utente — login / logout
    // =========================================================
    function loginSuccess(user) {
        btnLoginModal.classList.add('hidden');
        btnRegisterModal.classList.add('hidden');
        btnDashboard.classList.remove('hidden');
        btnLogout.classList.remove('hidden');
        userGreeting.classList.remove('hidden');
        userGreeting.innerHTML = `<i class="fa-solid fa-circle-user"></i> <span>Ciao, <strong>${user.name}</strong>!</span>`;
        loadUserPreferiti();
    }

    function logoutUser() {
        removeToken();
        userFavoritiIds.clear();
        if (window.google?.accounts) google.accounts.id.disableAutoSelect();
        btnLoginModal.classList.remove('hidden');
        btnRegisterModal.classList.remove('hidden');
        btnDashboard.classList.add('hidden');
        btnLogout.classList.add('hidden');
        userGreeting.classList.add('hidden');
        userGreeting.textContent = '';
        closeMobileMenu();
    }

    // Ripristino sessione da localStorage
    const storedToken = getToken();
    if (isTokenValid(storedToken)) {
        const d = decodeToken(storedToken);
        loginSuccess({ name: d.name, surname: d.surname, email: d.email });
    }

    btnLogout.addEventListener('click', logoutUser);

    // =========================================================
    // UI — Modali (apri / chiudi)
    // =========================================================
    const openModal = m => {
        if (!m) return;
        m.classList.remove('hidden');
        m.classList.add('modal-open');
    };
    const closeModal = m => {
        if (!m) return;
        m.classList.remove('modal-open');
        m.classList.add('hidden');
        clearForms();
    };

    btnLoginModal.addEventListener('click',    () => openModal(loginModal));
    btnRegisterModal.addEventListener('click', () => openModal(registerModal));

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', e => {
            const id = e.currentTarget.getAttribute('data-modal');
            closeModal(document.getElementById(id));
        });
    });

    [loginModal, registerModal, segnalazioneModal].forEach(m => {
        if (m) {
            m.addEventListener('click', e => {
                if (e.target === m) closeModal(m);
            });
        }
    });



    function clearForms() {
        ['register-form', 'login-form'].forEach(id => {
            const f = document.getElementById(id); if (f) f.reset();
        });
        ['reg-error', 'reg-success', 'login-error', 'google-error'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '';
        });
    }

    // =========================================================
    // Auth locale
    // =========================================================
    document.getElementById('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl   = document.getElementById('reg-error');
        const successEl = document.getElementById('reg-success');
        errorEl.textContent = successEl.textContent = '';
        try {
            const res  = await fetch('/api/v1/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name:     document.getElementById('reg-name').value.trim(),
                    surname:  document.getElementById('reg-surname').value.trim(),
                    email:    document.getElementById('reg-email').value.trim(),
                    password: document.getElementById('reg-password').value
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            successEl.textContent = '✅ Registrazione completata! Puoi effettuare il login.';
            document.getElementById('register-form').reset();
        } catch (err) {
            errorEl.textContent = '❌ ' + (err.message || 'Errore di registrazione');
        }
    });

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';
        try {
            const res  = await fetch('/api/v1/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email:    document.getElementById('login-email').value.trim(),
                    password: document.getElementById('login-password').value
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            saveToken(data.token);
            closeModal(loginModal);
            loginSuccess(data.user);
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
        } catch (err) {
            errorEl.textContent = '❌ Credenziali errate: ' + (err.message || 'email o password non validi');
        }
    });

    // =========================================================
    // Google SSO
    // =========================================================
    async function handleGoogleCredential(response) {
        const googleErrorEl = document.getElementById('google-error');
        googleErrorEl.textContent = '';
        try {
            const res  = await fetch('/api/v1/auth/google', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            saveToken(data.token);
            closeModal(loginModal);
            loginSuccess(data.user);
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
        } catch (err) {
            googleErrorEl.textContent = '❌ Errore Google SSO: ' + (err.message || 'Autenticazione Google fallita');
        }
    }

    async function initGoogleSSO() {
        try {
            const res = await fetch('/api/v1/config');
            const { googleClientId } = await res.json();
            const container = document.getElementById('google-btn-container');
            if (!googleClientId || googleClientId.includes('IL_TUO')) {
                container.innerHTML = '<small style="color:#888">Google Login: aggiungi GOOGLE_CLIENT_ID nel file .env</small>';
                return;
            }
            await new Promise(resolve => {
                if (window.google?.accounts) return resolve();
                const t = setInterval(() => { if (window.google?.accounts) { clearInterval(t); resolve(); } }, 100);
            });
            google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential, ux_mode: 'popup' });
            google.accounts.id.renderButton(container, {
                type: 'standard', shape: 'rectangular', theme: 'outline',
                text: 'signin_with', size: 'large', width: 340,
                locale: currentLang === 'de' ? 'de' : (currentLang === 'en' ? 'en' : 'it')
            });
        } catch (err) { console.error('Errore Google SSO:', err); }
    }

    initGoogleSSO();

    // =========================================================
    // TASK 3: Segnalazione — submit
    // =========================================================
    document.getElementById('seg-submit').addEventListener('click', async () => {
        const errorEl   = document.getElementById('seg-error');
        const successEl = document.getElementById('seg-success');
        errorEl.textContent = successEl.textContent = '';

        const id   = document.getElementById('seg-rastrelliera-id').value;
        const lat  = parseFloat(document.getElementById('seg-lat').value);
        const lng  = parseFloat(document.getElementById('seg-lng').value);
        const tipo = document.getElementById('seg-tipo').value;
        const note = document.getElementById('seg-note').value.trim();

        try {
            const res  = await fetch('/api/v1/segnalazioni', {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ rastrellieraId: parseInt(id), tipo, note, lat, lng })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            successEl.textContent = '✅ Segnalazione inviata! Grazie per il tuo contributo.';
            document.getElementById('seg-note').value = '';
            setTimeout(() => closeModal(segnalazioneModal), 2000);
        } catch (err) {
            errorEl.textContent = '❌ ' + (err.message || 'Errore invio segnalazione');
        }
    });

}); // fine DOMContentLoaded
