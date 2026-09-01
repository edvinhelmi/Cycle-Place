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
// TASK 4 — JWT Helpers (i18n gestito da /js/i18n.js)
// =======================================================


// =======================================================
// JWT Helpers
// =======================================================
const TOKEN_KEY   = 'tbp_jwt';
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
// CUSTOM ALERTS (Toasts)
// =======================================================
window.alert = function(message, type = 'warning') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container-custom';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    let alertClass = 'alert-warning';
    let iconClass = 'fa-triangle-exclamation';
    let bgClass = 'bg-amber-500 text-slate-950 border-amber-400';
    
    if (type === 'error') {
        alertClass = 'alert-error';
        iconClass = 'fa-circle-xmark';
        bgClass = 'bg-red-500 text-white border-red-400';
    } else if (type === 'success') {
        alertClass = 'alert-success';
        iconClass = 'fa-circle-check';
        bgClass = 'bg-emerald-500 text-white border-emerald-400';
    } else if (type === 'info') {
        alertClass = 'alert-info';
        iconClass = 'fa-circle-info';
        bgClass = 'bg-sky-500 text-white border-sky-400';
    }

    toast.className = `custom-toast alert ${alertClass} ${bgClass} font-bold flex flex-row items-center gap-3 px-4 py-3 rounded-2xl border`;
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} text-xl shrink-0"></i>
        <span class="text-xs sm:text-sm font-bold leading-tight">${message}</span>
    `;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3800);
};

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
        alert(tr('popup.loginToFav') || 'Accedi per salvare i tuoi preferiti.');
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            loginModal.classList.add('modal-open');
        }
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
        applyFiltersAndSearch(false);
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

    await I18n.init();

    // =========================================================
    // UI — Riferimenti DOM & Modali (Inizializzazione Immediata)
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

    function clearForms() {
        ['register-form', 'login-form'].forEach(id => {
            const f = document.getElementById(id); 
            if (f) {
                f.reset();
                f.querySelectorAll('input').forEach(inp => {
                    inp.classList.remove('input-error');
                    if (inp.type === 'text' && (inp.id.includes('password') || inp.id.includes('pass'))) {
                        inp.type = 'password';
                    }
                });
            }
        });
        document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-eye text-sm"></i>';
        });
        ['reg-error', 'reg-success', 'login-error', 'google-error'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '';
        });
    }

    // Toggle visibilità password (eye icon)
    document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash text-sm"></i>' : '<i class="fa-solid fa-eye text-sm"></i>';
        });
    });

    // Rimuovi input-error in tempo reale alla digitazione
    document.querySelectorAll('#register-form input, #login-form input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            const form = input.closest('form');
            if (form) {
                const errEl = form.querySelector('.error-msg');
                if (errEl) errEl.textContent = '';
            }
        });
    });

    if (btnLoginModal)    btnLoginModal.addEventListener('click',    () => openModal(loginModal));
    if (btnRegisterModal) btnRegisterModal.addEventListener('click', () => openModal(registerModal));

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

    // Mobile Hamburger Menu (RNF1, RNF6)
    function toggleMobileMenu() {
        if (!userControls || !btnHamburger) return;
        const isActive = userControls.classList.toggle('active');
        btnHamburger.setAttribute('aria-expanded', String(isActive));
        const iconSpan = btnHamburger.querySelector('.hamburger-icon');
        if (iconSpan) {
            iconSpan.innerHTML = isActive ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        }
        if (isActive) {
            const filterPanel = document.getElementById('filter-panel');
            const mapLegend = document.getElementById('map-legend');
            const btnFilterToggle = document.getElementById('btn-filter-toggle');
            const btnLegendToggle = document.getElementById('btn-legend-toggle');
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

    [btnLoginModal, btnRegisterModal, btnDashboard, btnLogout].forEach(btn => {
        if (btn) btn.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('click', (e) => {
        if (userControls && userControls.classList.contains('active')) {
            if (!userControls.contains(e.target) && !btnHamburger.contains(e.target)) {
                closeMobileMenu();
            }
        }
    });

    // Stato utente — login / logout
    async function loginSuccess(user) {
        if (btnLoginModal)    btnLoginModal.classList.add('hidden');
        if (btnRegisterModal) btnRegisterModal.classList.add('hidden');
        if (btnDashboard)     btnDashboard.classList.remove('hidden');
        if (btnLogout)        btnLogout.classList.remove('hidden');
        if (userGreeting) {
            userGreeting.classList.remove('hidden');
            userGreeting.innerHTML = `<i class="fa-solid fa-circle-user"></i> <span>Ciao, <strong>${user.name}</strong>!</span>`;
        }
        await loadUserPreferiti();
        applyFiltersAndSearch(false);
    }

    function logoutUser() {
        removeToken();
        userFavoritiIds.clear();
        if (window.google?.accounts) google.accounts.id.disableAutoSelect();
        if (btnLoginModal)    btnLoginModal.classList.remove('hidden');
        if (btnRegisterModal) btnRegisterModal.classList.remove('hidden');
        if (btnDashboard)     btnDashboard.classList.add('hidden');
        if (btnLogout)        btnLogout.classList.add('hidden');
        if (userGreeting) {
            userGreeting.classList.add('hidden');
            userGreeting.textContent = '';
        }
        closeMobileMenu();
        applyFiltersAndSearch(false);
    }

    // Ripristino sessione da localStorage
    const storedToken = getToken();
    if (isTokenValid(storedToken)) {
        const d = decodeToken(storedToken);
        loginSuccess({ name: d.name, surname: d.surname, email: d.email });
    }

    if (btnLogout) btnLogout.addEventListener('click', logoutUser);

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

    // Registrazione
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async e => {
            e.preventDefault();
            const errorEl   = document.getElementById('reg-error');
            const successEl = document.getElementById('reg-success');
            const btnSubmit = document.getElementById('btn-reg-submit');
            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';

            const nameInput    = document.getElementById('reg-name');
            const surnameInput = document.getElementById('reg-surname');
            const emailInput   = document.getElementById('reg-email');
            const passInput    = document.getElementById('reg-password');
            const passConfInput= document.getElementById('reg-password-confirm');

            const name     = nameInput ? nameInput.value.trim() : '';
            const surname  = surnameInput ? surnameInput.value.trim() : '';
            const email    = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const password = passInput ? passInput.value : '';
            const passConf = passConfInput ? passConfInput.value : password;

            [nameInput, surnameInput, emailInput, passInput, passConfInput].forEach(inp => inp && inp.classList.remove('input-error'));

            if (!name || !surname || !email || !password || !passConf) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errEmptyFields');
                if (!name && nameInput) nameInput.classList.add('input-error');
                if (!surname && surnameInput) surnameInput.classList.add('input-error');
                if (!email && emailInput) emailInput.classList.add('input-error');
                if (!password && passInput) passInput.classList.add('input-error');
                if (!passConf && passConfInput) passConfInput.classList.add('input-error');
                return;
            }

            if (name.length < 2) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errName');
                if (nameInput) { nameInput.classList.add('input-error'); nameInput.focus(); }
                return;
            }

            if (surname.length < 2) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errSurname');
                if (surnameInput) { surnameInput.classList.add('input-error'); surnameInput.focus(); }
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errEmail');
                if (emailInput) { emailInput.classList.add('input-error'); emailInput.focus(); }
                return;
            }

            // Controllo complessità password (min 8 car., 1 maiuscola, 1 numero, 1 speciale)
            if (!PASSWORD_REGEX.test(password)) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errPasswordRequirements') || 'La password deve contenere almeno 8 caratteri, una maiuscola, un numero e un carattere speciale');
                if (passInput) { passInput.classList.add('input-error'); passInput.focus(); }
                return;
            }

            if (password !== passConf) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errPasswordMismatch');
                if (passConfInput) { passConfInput.classList.add('input-error'); passConfInput.focus(); }
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span class="loading loading-spinner loading-xs"></span> ' + tr('nav.register');
            }

            try {
                const res  = await fetch('/api/v1/register', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, surname, email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                if (successEl) successEl.textContent = '✅ ' + tr('auth.successRegister');
                registerForm.reset();
                
                setTimeout(() => {
                    closeModal(registerModal);
                    openModal(loginModal);
                    const loginEmailInput = document.getElementById('login-email');
                    if (loginEmailInput) {
                        loginEmailInput.value = email;
                        document.getElementById('login-password')?.focus();
                    }
                }, 1600);
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Errore di registrazione');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = tr('nav.register');
                }
            }
        });
    }

    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const errorEl   = document.getElementById('login-error');
            const btnSubmit = document.getElementById('btn-login-submit');
            if (errorEl) errorEl.textContent = '';

            const emailInput = document.getElementById('login-email');
            const passInput  = document.getElementById('login-password');

            const email    = emailInput ? emailInput.value.trim().toLowerCase() : '';
            const password = passInput ? passInput.value : '';

            [emailInput, passInput].forEach(inp => inp && inp.classList.remove('input-error'));

            if (!email || !password) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errEmptyFields');
                if (!email && emailInput) emailInput.classList.add('input-error');
                if (!password && passInput) passInput.classList.add('input-error');
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                if (errorEl) errorEl.textContent = '❌ ' + tr('auth.errEmail');
                if (emailInput) { emailInput.classList.add('input-error'); emailInput.focus(); }
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span class="loading loading-spinner loading-xs"></span> ' + tr('nav.login');
            }

            try {
                const res  = await fetch('/api/v1/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                saveToken(data.token);
                closeModal(loginModal);
                loginSuccess(data.user);
                setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Credenziali non valide');
                if (emailInput) emailInput.classList.add('input-error');
                if (passInput) passInput.classList.add('input-error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = tr('nav.login');
                }
            }
        });
    }

    // Google SSO
    async function handleGoogleCredential(response) {
        const googleErrorEl = document.getElementById('google-error');
        if (googleErrorEl) googleErrorEl.textContent = '';
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
            if (googleErrorEl) googleErrorEl.textContent = '❌ Errore Google SSO: ' + (err.message || 'Autenticazione Google fallita');
        }
    }

    async function initGoogleSSO() {
        try {
            const res = await fetch('/api/v1/config');
            const { googleClientId } = await res.json();
            const container = document.getElementById('google-btn-container');
            if (!container) return;
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
                locale: I18n.getLanguage() === 'de' ? 'de' : (I18n.getLanguage() === 'en' ? 'en' : 'it')
            });
        } catch (err) { console.error('Errore Google SSO:', err); }
    }

    initGoogleSSO();

    // Segnalazione Submit Handler
    const segSubmitBtn = document.getElementById('seg-submit');
    if (segSubmitBtn) {
        segSubmitBtn.addEventListener('click', async () => {
            const errorEl   = document.getElementById('seg-error');
            const successEl = document.getElementById('seg-success');
            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';

            const id   = document.getElementById('seg-rastrelliera-id')?.value;
            const lat  = parseFloat(document.getElementById('seg-lat')?.value);
            const lng  = parseFloat(document.getElementById('seg-lng')?.value);
            const tipo = document.getElementById('seg-tipo')?.value;
            const note = document.getElementById('seg-note')?.value?.trim();

            try {
                const res  = await fetch('/api/v1/segnalazioni', {
                    method: 'POST', headers: authHeaders(),
                    body: JSON.stringify({ rastrellieraId: parseInt(id), tipo, note, lat, lng })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                if (successEl) successEl.textContent = '✅ Segnalazione inviata! Grazie per il tuo contributo.';
                const noteEl = document.getElementById('seg-note');
                if (noteEl) noteEl.value = '';
                setTimeout(() => closeModal(segnalazioneModal), 2000);
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Errore invio segnalazione');
            }
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
        parcheggio:   { radius: 10, fillColor: '#27ae60', color: '#1a7a40', weight: 2,   fillOpacity: 0.95 },
        preferito:    { radius: 9,  fillColor: '#e11d48', color: '#ffffff', weight: 2.5, fillOpacity: 1.0  }
    };

    const favMarkerIcon = L.divIcon({
        className: 'custom-fav-heart-icon',
        html: `<div style="display:flex; align-items:center; justify-content:center; width:28px; height:28px;">
                 <i class="fa-solid fa-heart" style="color: #e11d48; font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));"></i>
               </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

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
    let currentSearchQuery    = '';
    let currentSearchLocation = null;
    let feedbackTimeout       = null;

    // Layer per la posizione GPS dell'utente (User Story 1)
    let userLocationMarker = null;
    let userAccuracyCircle = null;

    const groupSearchRadius = L.layerGroup().addTo(map);
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
    function showSearchFeedback(msg, isError = false, duration = 4000) {
        const el = document.getElementById('search-feedback');
        if (!el) return;
        el.textContent = msg;
        el.className = isError ? 'search-feedback error' : 'search-feedback';
        el.classList.remove('hidden');

        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => {
            el.classList.add('hidden');
        }, duration);
    }

    function hideSearchFeedback() {
        const el = document.getElementById('search-feedback');
        if (el) el.classList.add('hidden');
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
    }

    function renderRadialSearch(searchLatLng, placeName, showTrad, showBlocca, showPark, hidePiene) {
        groupTradizionale.clearLayers();
        groupBloccatelaio.clearLayers();
        groupParcheggi.clearLayers();
        groupSearchRadius.clearLayers();

        const radialBounds = L.latLngBounds([searchLatLng]);
        let radialCount = 0;
        const visibleRastrelliere = { type: 'FeatureCollection', features: [] };
        const visibleParcheggi    = { type: 'FeatureCollection', features: [] };

        // 1. Rastrelliere entro 200m
        if (tutteRastrelliere && tutteRastrelliere.features) {
            tutteRastrelliere.features.forEach(feature => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;
                const latlng = L.latLng(coords[1], coords[0]);
                const dist = latlng.distanceTo(searchLatLng);
                if (dist > 200) return;

                const isBlocca = props.Tipo_generale === 'Rastr_bloccatelaio';
                const isPiena = isBlocca && ((props.posti_liberi === 0) || (props.piena === true));
                const typeVisible = isBlocca ? showBlocca : showTrad;
                const pienaVisible = hidePiene ? !isPiena : true;
                if (!typeVisible || !pienaVisible) return;

                const isFav = userFavoritiIds.has(props.id);
                const baseStile = isBlocca ? (isPiena ? STILI.piena : STILI.bloccatelaio) : STILI.tradizionale;
                const stile = isFav ? STILI.preferito : baseStile;
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
                radialBounds.extend(latlng);
                radialCount++;
            });
        }

        // 2. Parcheggi Protetti entro 200m
        if (tuttiParcheggi && tuttiParcheggi.features) {
            tuttiParcheggi.features.forEach(feature => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;
                const latlng = L.latLng(coords[1], coords[0]);
                const dist = latlng.distanceTo(searchLatLng);
                if (dist > 200) return;
                if (!showPark) return;

                const parkId = feature.properties.id || 10001;
                const isFav = userFavoritiIds.has(parkId);
                const stile = isFav ? STILI.preferito : STILI.parcheggio;
                const layer = L.circleMarker(latlng, stile);
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
                radialBounds.extend(latlng);
                radialCount++;
            });
        }

        // 3. Aggiungi Pin e Cerchio di raggio 200m
        const searchPin = L.marker(searchLatLng, {
            icon: L.divIcon({
                className: 'custom-search-pin-wrapper',
                html: `<div class="w-8 h-8 rounded-full bg-error text-white flex items-center justify-center shadow-xl border-2 border-white text-base"><i class="fa-solid fa-location-dot"></i></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        }).bindPopup(`<div class="font-bold text-slate-800 text-sm mb-1">${placeName}</div><div class="text-xs text-slate-500 font-medium">Punto cercato (raggio 200m)</div>`, {
            className: 'custom-tbp-popup'
        });

        const searchCircle = L.circle(searchLatLng, {
            radius: 200,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '6, 6',
            interactive: false
        });

        groupSearchRadius.addLayer(searchCircle);
        groupSearchRadius.addLayer(searchPin);

        // 4. Centratura e Messaggio Feedback
        if (radialCount === 0) {
            map.setView(searchLatLng, 16);
            showSearchFeedback(tr('search.noResultsRadius').replace('{place}', placeName), true, 5000);
        } else {
            radialBounds.extend(searchCircle.getBounds());
            map.fitBounds(radialBounds, { padding: [50, 50], maxZoom: 17 });
            showSearchFeedback(tr('search.radiusFound').replace('{place}', placeName).replace('{n}', radialCount), false, 5500);
        }

        updateFilterBadge();
        aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
    }

    async function applyFiltersAndSearch(isExplicitSearch = false) {
        const showTrad   = document.getElementById('filter-tradizionali')?.checked ?? true;
        const showBlocca = document.getElementById('filter-bloccatelaio')?.checked ?? true;
        const showPark   = document.getElementById('filter-parcheggi')?.checked ?? true;
        const hidePiene  = document.getElementById('filter-piene')?.checked ?? false;

        // Pulisci i layer attuali per aggiornare la mappa
        groupTradizionale.clearLayers();
        groupBloccatelaio.clearLayers();
        groupParcheggi.clearLayers();
        groupSearchRadius.clearLayers();

        const bounds = L.latLngBounds([]);
        let renderedCount = 0;

        // Feature visibili (per cruscotto statistiche)
        const visibleRastrelliere = { type: 'FeatureCollection', features: [] };
        const visibleParcheggi    = { type: 'FeatureCollection', features: [] };

        const trimmedQuery = currentSearchQuery.trim();

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
                const isFav = userFavoritiIds.has(props.id);
                const baseStile = isBlocca ? (isPiena ? STILI.piena : STILI.bloccatelaio) : STILI.tradizionale;
                
                // Se è nei preferiti crea il marker con il cuore, altrimenti il solito cerchietto
                const layer = isFav 
                    ? L.marker(latlng, { icon: favMarkerIcon }) 
                    : L.circleMarker(latlng, baseStile);
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

                const parkId = props.id || 10001;
                const isFav = userFavoritiIds.has(parkId);
                
                // Se è nei preferiti crea il marker con il cuore, altrimenti il solito cerchietto
                const layer = isFav 
                    ? L.marker(latlng, { icon: favMarkerIcon }) 
                    : L.circleMarker(latlng, STILI.parcheggio);
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

        // 3. Gestione feedback utente e zoom automatico (fitBounds) / Fallback Geocoding
        const clearBtn = document.getElementById('btn-clear-search');
        if (clearBtn) clearBtn.classList.toggle('hidden', !trimmedQuery);

        if (trimmedQuery) {
            if (renderedCount > 0) {
                currentSearchLocation = null;
                if (isExplicitSearch) {
                    if (renderedCount === 1) {
                        map.setView(bounds.getCenter(), 17);
                    } else if (bounds.isValid()) {
                        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
                    }
                    showSearchFeedback(tr('search.found').replace('{n}', renderedCount), false);
                }
                updateFilterBadge();
                aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
            } else if (isExplicitSearch) {
                // Nessun parcheggio trovato nel testo -> Tenta geocoding e ricerca nel raggio di 200m
                showSearchFeedback(tr('search.searching'), false, 6000);

                let queryForGeo = trimmedQuery;
                if (!/trento/i.test(queryForGeo)) {
                    queryForGeo += ', Trento, Italia';
                }
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryForGeo)}&limit=1`;

                try {
                    const geoRes = await fetch(url, {
                        headers: { 'Accept-Language': I18n.getLanguage() || 'it' }
                    });
                    const geoData = await geoRes.json();

                    if (!geoData || geoData.length === 0) {
                        currentSearchLocation = null;
                        showSearchFeedback(tr('search.locationNotFound'), true, 4500);
                        updateFilterBadge();
                        aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
                        return;
                    }

                    const searchLat = parseFloat(geoData[0].lat);
                    const searchLon = parseFloat(geoData[0].lon);
                    const searchLatLng = L.latLng(searchLat, searchLon);
                    const placeName = geoData[0].display_name ? geoData[0].display_name.split(',')[0].trim() : trimmedQuery;

                    currentSearchLocation = { latLng: searchLatLng, displayName: placeName, query: currentSearchQuery };

                    renderRadialSearch(searchLatLng, placeName, showTrad, showBlocca, showPark, hidePiene);
                } catch (err) {
                    console.error('[Nominatim error]', err);
                    showSearchFeedback(tr('search.noResults'), true);
                    updateFilterBadge();
                    aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
                }
            } else if (currentSearchLocation && currentSearchLocation.query === currentSearchQuery) {
                renderRadialSearch(currentSearchLocation.latLng, currentSearchLocation.displayName, showTrad, showBlocca, showPark, hidePiene);
            } else {
                updateFilterBadge();
                aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
            }
        } else {
            currentSearchLocation = null;
            hideSearchFeedback();
            updateFilterBadge();
            aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
        }
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
                    weight: 1.5,
                    interactive: false
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
    I18n.onLanguageChange(() => {
        applyFiltersAndSearch(false);
    });

}); // fine DOMContentLoaded
