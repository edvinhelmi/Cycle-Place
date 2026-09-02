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
const TOKEN_KEY         = 'tbp_jwt';
const REFRESH_TOKEN_KEY = 'tbp_refresh_jwt';

const saveToken = (accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};
const getToken        = () => localStorage.getItem(TOKEN_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const removeToken     = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};

function decodeToken(token) {
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
}

function isTokenValid(token) {
    const refreshToken = getRefreshToken();
    // Se c'è un refresh token non scaduto, la sessione è ancora valida fino a 30 giorni
    if (refreshToken) {
        const dRefresh = decodeToken(refreshToken);
        if (dRefresh && dRefresh.exp && dRefresh.exp * 1000 > Date.now()) {
            return true;
        }
    }
    // Fallback: controllo dell'access token
    if (!token) return false;
    const d = decodeToken(token);
    return d && d.exp && d.exp * 1000 > Date.now();
}

function authHeaders() {
    const t = getToken();
    return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Wrapper automatico: rinnova l'access token scaduto con il refresh token (RF 1.6)
async function authFetch(url, options = {}) {
    let token = getToken();
    const refreshToken = getRefreshToken();

    options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    };

    let response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
        if (!refreshToken) {
            removeToken();
            return response;
        }

        try {
            const refreshRes = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (refreshRes.ok) {
                const data = await refreshRes.json();
                const newAccessToken = data.accessToken || data.token;
                saveToken(newAccessToken);
                options.headers = {
                    ...options.headers,
                    'Authorization': 'Bearer ' + newAccessToken
                };
                return fetch(url, options);
            
            } else {
                removeToken();
                userFavoritiIds.clear();
                return response;
            }
        } catch (e) {
            if (e.name === 'AbortError') return response;
            console.error('[authFetch] Errore:', e);
            removeToken();
            return response;
        }
    }

    return response;
}

// =======================================================
// CUSTOM ALERTS (Glassmorphism Toasts)
// =======================================================
window.alert = function(message, type = 'warning') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    let iconClass = 'fa-triangle-exclamation';
    let iconColor = 'text-amber-500';
    let borderColor = 'border-amber-400/60';
    
    if (type === 'error') { 
        iconClass = 'fa-circle-xmark'; 
        iconColor = 'text-rose-500';
        borderColor = 'border-rose-400/60';
    } else if (type === 'success') { 
        iconClass = 'fa-circle-check'; 
        iconColor = 'text-emerald-500';
        borderColor = 'border-emerald-400/60';
    } else if (type === 'info') { 
        iconClass = 'fa-circle-info'; 
        iconColor = 'text-sky-500';
        borderColor = 'border-sky-400/60';
    }

    toast.className = `custom-toast font-bold flex flex-row items-center gap-3 px-4 py-3 text-xs sm:text-sm text-slate-800 ${borderColor}`;
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} ${iconColor} text-lg shrink-0"></i>
        <span class="font-bold leading-snug">${message}</span>
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
        const res  = await authFetch('/api/v1/user/preferiti');
        const data = await res.json();
        userFavoritiIds = new Set((data.preferiti || []).map(f => Number(f.id)));
    } catch (e) { console.error('Errore caricamento preferiti:', e); }
}



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
    document.querySelectorAll('input[name="seg-opzioni"]').forEach(cb => cb.checked = false);
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
    const btnLoginModal       = document.getElementById('btn-login-modal');
    const btnRegisterModal    = document.getElementById('btn-register-modal');
    const btnDashboard        = document.getElementById('btn-dashboard');
    const btnLogout           = document.getElementById('btn-logout');
    const userGreeting        = document.getElementById('user-greeting');
    const loginModal          = document.getElementById('login-modal');
    const registerModal       = document.getElementById('register-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const resetPasswordModal  = document.getElementById('reset-password-modal');
    const btnOpenForgotModal  = document.getElementById('btn-open-forgot-modal');
    const btnBackToLogin      = document.getElementById('btn-back-to-login');
    const segnalazioneModal   = document.getElementById('segnalazione-modal');
    const btnHamburger        = document.getElementById('btn-hamburger');
    const userControls        = document.getElementById('user-controls');

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
        ['register-form', 'login-form', 'forgot-password-form', 'reset-password-form'].forEach(id => {
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
        ['reg-error', 'reg-success', 'login-error', 'google-error', 'forgot-error', 'forgot-success', 'reset-error', 'reset-success'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '';
        });
        const etherealPreview = document.getElementById('forgot-ethereal-preview');
        if (etherealPreview) {
            etherealPreview.classList.add('hidden');
            etherealPreview.innerHTML = '';
        }
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

    if (btnOpenForgotModal) {
        btnOpenForgotModal.addEventListener('click', () => {
            closeModal(loginModal);
            openModal(forgotPasswordModal);
        });
    }

    if (btnBackToLogin) {
        btnBackToLogin.addEventListener('click', () => {
            closeModal(forgotPasswordModal);
            openModal(loginModal);
        });
    }

    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', e => {
            const id = e.currentTarget.getAttribute('data-modal');
            closeModal(document.getElementById(id));
        });
    });

    [loginModal, registerModal, segnalazioneModal, forgotPasswordModal, resetPasswordModal].forEach(m => {
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
            userGreeting.innerHTML = `<i class="fa-solid fa-circle-user text-sm"></i><span class="whitespace-nowrap leading-none">Ciao, <strong>${user.name}</strong>!</span>`;
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
    const storedRefresh = getRefreshToken();
    if (isTokenValid(storedToken)) {
        const d = decodeToken(storedToken) || decodeToken(storedRefresh);
        if (d) {
        loginSuccess({ name: d.name || 'Utente', surname: d.surname || '', email: d.email || '' });
        }
    } else {
        // Se non autenticato, togliamo hidden dai bottoni login
        if (btnLoginModal) btnLoginModal.classList.remove('hidden');
        if (btnRegisterModal) btnRegisterModal.classList.remove('hidden');
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
                saveToken(data.accessToken || data.token, data.refreshToken);
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

    // =========================================================
    // Recupero Password — Richiesta Link (RF 1.4 / US 3)
    // =========================================================
    const forgotForm = document.getElementById('forgot-password-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async e => {
            e.preventDefault();
            const errorEl   = document.getElementById('forgot-error');
            const successEl = document.getElementById('forgot-success');
            const previewEl = document.getElementById('forgot-ethereal-preview');
            const btnSubmit = document.getElementById('btn-forgot-submit');
            const emailInput= document.getElementById('forgot-email');

            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';
            if (previewEl) { previewEl.classList.add('hidden'); previewEl.innerHTML = ''; }
            if (emailInput) emailInput.classList.remove('input-error');

            const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

            if (!email) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errEmptyFields') || 'Inserisci un indirizzo email');
                if (emailInput) emailInput.classList.add('input-error');
                return;
            }

            if (!EMAIL_REGEX.test(email)) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errEmail') || 'Formato email non valido');
                if (emailInput) emailInput.classList.add('input-error');
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span class="loading loading-spinner loading-xs"></span> ${tr('auth.sending') || 'Invio in corso...'}`;
            }

            const currentLang = (window.I18n ? window.I18n.getLanguage() : localStorage.getItem('tbp_lang')) || 'it';

            try {
                const res = await fetch('/api/v1/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, lang: currentLang })
                });
                let data;
                try {
                    data = await res.json();
                } catch {
                    throw new Error(`Endpoint non attivo (HTTP ${res.status}). Riavvia il server nel terminale (Ctrl+C e node app.js) per caricare i nuovi endpoint`);
                }
                if (!res.ok) throw new Error(data.error || `Errore del server (HTTP ${res.status})`);

                const successMessage = tr('auth.recoveryEmailSent') || data.message;
                if (successEl) {
                    successEl.textContent = '✅ ' + successMessage;
                }
                window.alert(successMessage, 'success');

                if (data.previewUrl && previewEl) {
                    previewEl.classList.remove('hidden');
                    previewEl.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-envelope-open-text text-sky-600 text-base"></i>
                            <div>
                                <span class="font-bold">Test Email (Ethereal):</span> 
                                <a href="${data.previewUrl}" target="_blank" rel="noopener noreferrer" class="underline text-sky-700 hover:text-sky-900 font-semibold block mt-0.5">Apri email ricevuta &rarr;</a>
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Errore durante la richiesta di recupero');
                if (emailInput) emailInput.classList.add('input-error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = tr('auth.sendRecoveryLink') || 'Invia link di recupero';
                }
            }
        });
    }

    // =========================================================
    // Recupero Password — Imposta Nuova Password (RF 1.4 / US 3)
    // =========================================================
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async e => {
            e.preventDefault();
            const errorEl       = document.getElementById('reset-error');
            const successEl     = document.getElementById('reset-success');
            const btnSubmit     = document.getElementById('btn-reset-submit');
            const tokenInput    = document.getElementById('reset-token');
            const newPassInput  = document.getElementById('reset-new-password');
            const confirmPassInput = document.getElementById('reset-confirm-password');

            if (errorEl) errorEl.textContent = '';
            if (successEl) successEl.textContent = '';
            [newPassInput, confirmPassInput].forEach(inp => inp && inp.classList.remove('input-error'));

            const token = tokenInput ? tokenInput.value.trim() : '';
            const newPassword = newPassInput ? newPassInput.value : '';
            const confirmPassword = confirmPassInput ? confirmPassInput.value : '';

            if (!newPassword || !confirmPassword) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errEmptyFields') || 'Compila tutti i campi obbligatori');
                if (!newPassword && newPassInput) newPassInput.classList.add('input-error');
                if (!confirmPassword && confirmPassInput) confirmPassInput.classList.add('input-error');
                return;
            }

            if (newPassword.length < 4) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errPasswordShort') || 'La password deve contenere almeno 4 caratteri');
                if (newPassInput) newPassInput.classList.add('input-error');
                return;
            }

            if (newPassword !== confirmPassword) {
                if (errorEl) errorEl.textContent = '❌ ' + (tr('auth.errPasswordMismatch') || 'Le password non coincidono');
                if (confirmPassInput) confirmPassInput.classList.add('input-error');
                return;
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = `<span class="loading loading-spinner loading-xs"></span> ${tr('auth.updating') || 'Aggiornamento...'}`;
            }

            const currentLang = (window.I18n ? window.I18n.getLanguage() : localStorage.getItem('tbp_lang')) || 'it';

            try {
                const res = await fetch('/api/v1/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword, lang: currentLang })
                });
                let data;
                try {
                    data = await res.json();
                } catch {
                    throw new Error(`Endpoint non attivo (HTTP ${res.status}). Riavvia il server nel terminale (Ctrl+C e node app.js) per caricare i nuovi endpoint`);
                }
                if (!res.ok) throw new Error(data.error || `Errore del server (HTTP ${res.status})`);

                const successMsg = tr('auth.resetSuccess') || data.message;
                if (successEl) successEl.textContent = '✅ ' + successMsg;
                window.alert(successMsg, 'success');

                // Pulisce l'URL rimuovendo action e token
                window.history.replaceState({}, document.title, window.location.pathname);

                setTimeout(() => {
                    closeModal(resetPasswordModal);
                    openModal(loginModal);
                }, 1400);
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Errore durante il reset della password');
                if (newPassInput) newPassInput.classList.add('input-error');
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = tr('auth.updatePassword') || 'Aggiorna Password';
                }
            }
        });
    }

    // Controlla se la pagina è aperta con ?action=reset-password&token=XYZ
    async function checkResetPasswordFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const token = urlParams.get('token');
        const langParam = urlParams.get('lang');

        if (langParam && ['it', 'en', 'de'].includes(langParam) && window.I18n) {
            window.I18n.setLanguage(langParam);
        }

        if (action === 'reset-password' && token) {
            const tokenInput = document.getElementById('reset-token');
            if (tokenInput) tokenInput.value = token;
            openModal(resetPasswordModal);

            try {
                const res = await fetch(`/api/v1/verify-reset-token?token=${encodeURIComponent(token)}`);
                let data;
                try { data = await res.json(); } catch { data = { error: 'Server non aggiornato' }; }
                if (!res.ok) {
                    const errorEl = document.getElementById('reset-error');
                    if (errorEl) errorEl.textContent = '⚠️ ' + (tr('auth.resetTokenInvalid') || data.error || 'Questo link di recupero è scaduto o non è più valido.');
                    const btnSubmit = document.getElementById('btn-reset-submit');
                    if (btnSubmit) btnSubmit.disabled = true;
                }
            } catch (e) {
                console.warn('[Reset Password] Verifica token non riuscita:', e);
            }
        }
    }
    checkResetPasswordFromUrl();

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
            saveToken(data.accessToken || data.token, data.refreshToken);
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
            const note = document.getElementById('seg-note')?.value?.trim();

            // Legge tutte le caselle spuntate (checkbox)
            const checkedBoxes = Array.from(document.querySelectorAll('input[name="seg-opzioni"]:checked')).map(cb => cb.value);
            if (checkedBoxes.length === 0) {
                if (errorEl) errorEl.textContent = '❌ Seleziona almeno una problematica.';
                return;
            }
            const tipo = checkedBoxes.join(', ');

            try {
                const res = await authFetch('/api/v1/segnalazioni', {
                    method: 'POST',
                    body: JSON.stringify({ rastrellieraId: parseInt(id), tipo, note, lat, lng })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                if (successEl) successEl.textContent = '✅ Segnalazione inviata! Grazie per il tuo contributo.';
                
                // Pulisce note e caselle
                const noteEl = document.getElementById('seg-note');
                if (noteEl) noteEl.value = '';
                document.querySelectorAll('input[name="seg-opzioni"]').forEach(cb => cb.checked = false);

                // Ricarica subito la cache delle segnalazioni per aggiornare i popup all'istante
                await loadSegnalazioniRecenti();

                setTimeout(() => closeModal(segnalazioneModal), 2000);
            } catch (err) {
                if (errorEl) errorEl.textContent = '❌ ' + (err.message || 'Errore invio segnalazione');
            }
        });
    }

    // =========================================================
    // 1. MAPPA — inizializzazione (preferCanvas per ridurre il carico DOM di cerchi e percorsi)
    // =========================================================
    const map = L.map('map', {
        preferCanvas: true
    }).setView([46.0697, 11.1211], 14);

    // Disattiva hit-test ed eventi mouse sui 500 marker durante lo scorrimento per fluidità a 60fps (RNF6)
    const mapContainer = map.getContainer();
    map.on('movestart', () => mapContainer.classList.add('map-moving'));
    map.on('moveend',   () => mapContainer.classList.remove('map-moving'));

    // Tile Layer: OpenStreetMap Standard (100% gratuito, affidabile e senza alcuna API key)
    // In Dark Mode viene convertito istantaneamente e senza watermark tramite filtro CSS hardware-accelerated
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    let currentTheme = document.documentElement.getAttribute('data-theme') || 'trento';

    // =========================================================
    // THEME SWITCHER (Toggle Switch)
    // =========================================================
    const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
    const themeSunIcon        = document.getElementById('theme-sun-icon');
    const themeMoonIcon       = document.getElementById('theme-moon-icon');

    function updateThemeUI(theme) {
        const isDark = (theme === 'dark');
        if (themeToggleCheckbox) {
            themeToggleCheckbox.checked = isDark;
        }
        if (themeSunIcon) {
            themeSunIcon.className = isDark ? 'fa-solid fa-sun text-slate-500 text-xs transition-colors' : 'fa-solid fa-sun text-amber-500 text-xs transition-colors';
        }
        if (themeMoonIcon) {
            themeMoonIcon.className = isDark ? 'fa-solid fa-moon text-indigo-400 text-xs transition-colors' : 'fa-solid fa-moon text-slate-400 text-xs transition-colors';
        }
    }

    function applyTheme(newTheme) {
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('tbp_theme', newTheme);
        currentTheme = newTheme;
        updateThemeUI(newTheme);
    }

    if (themeToggleCheckbox) {
        themeToggleCheckbox.addEventListener('change', () => {
            applyTheme(themeToggleCheckbox.checked ? 'dark' : 'trento');
        });
    }

    updateThemeUI(currentTheme);



    const markerIconTradizionale = L.divIcon({
        className: 'custom-marker-icon-wrapper',
        html: `<div class="custom-marker-pin pin-tradizionale" title="Rastrelliera Tradizionale"><i class="fa-solid fa-bicycle"></i></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });

    const markerIconBloccatelaio = L.divIcon({
        className: 'custom-marker-icon-wrapper',
        html: `<div class="custom-marker-pin pin-bloccatelaio" title="Rastrelliera Bloccatelaio"><i class="fa-solid fa-lock"></i></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });

    const markerIconPiena = L.divIcon({
        className: 'custom-marker-icon-wrapper',
        html: `<div class="custom-marker-pin pin-piena" title="Rastrelliera Piena (0 posti)"><i class="fa-solid fa-ban"></i></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });

    const markerIconParcheggio = L.divIcon({
        className: 'custom-marker-icon-wrapper',
        html: `<div class="custom-marker-pin pin-parcheggio" title="Parcheggio Protetto"><i class="fa-solid fa-shield-halved"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });

    const favMarkerIcon = L.divIcon({
        className: 'custom-fav-heart-icon',
        html: `<div class="custom-fav-heart-pin" title="Preferito"><i class="fa-solid fa-heart"></i></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
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
    let segnalazioniRecentiMap = new Map();

    // Layer per la posizione GPS dell'utente (User Story 1)
    let userLocationMarker = null;
    let userAccuracyCircle = null;
    let lastUserCoords     = null; // { lat, lng }

    // Layer per il Routing In-App (OpenRouteService)
    let currentRouteLayer       = null;
    let currentRouteCasingLayer = null;
    let currentNavDestination   = null; // { lat, lng, name }
    let currentNavMode          = 'cycling-regular'; // 'cycling-regular' | 'foot-walking'

    // Stato Navigazione Live Turn-by-Turn
    let isLiveNavigating        = false;
    let isFollowMode            = true;
    let isProgrammaticMove      = false;
    let liveWatchId             = null;
    let routeSteps              = [];
    let currentStepIndex        = 0;
    let routeCoordinates        = []; // [[lat, lng], ...]
    let voiceEnabled            = true;
    let lastSpokenInstruction   = null;
    let lastRerouteTime         = 0;

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

    function renderRadialSearch(searchLatLng, placeName, showTrad, showBlocca, showPark, hidePiene, soloPreferiti = false) {
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

                const isFav = userFavoritiIds.has(Number(props.id));
                if (soloPreferiti && !isFav) return;

                const baseIcon = isBlocca ? (isPiena ? markerIconPiena : markerIconBloccatelaio) : markerIconTradizionale;
                const layer = L.marker(latlng, { icon: isFav ? favMarkerIcon : baseIcon });
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
                const isFav = userFavoritiIds.has(Number(parkId));
                if (soloPreferiti && !isFav) return;

                const layer = L.marker(latlng, { icon: isFav ? favMarkerIcon : markerIconParcheggio });
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
        const showTrad      = document.getElementById('filter-tradizionali')?.checked ?? true;
        const showBlocca    = document.getElementById('filter-bloccatelaio')?.checked ?? true;
        const showPark      = document.getElementById('filter-parcheggi')?.checked ?? true;
        const hidePiene     = document.getElementById('filter-piene')?.checked ?? false;
        const soloPreferiti = document.getElementById('filter-preferiti')?.checked ?? false;

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

                const isFav = userFavoritiIds.has(Number(props.id));
                if (soloPreferiti && !isFav) return;

                const baseIcon = isBlocca ? (isPiena ? markerIconPiena : markerIconBloccatelaio) : markerIconTradizionale;
                const layer = L.marker(latlng, { icon: isFav ? favMarkerIcon : baseIcon });
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
                const isFav = userFavoritiIds.has(Number(parkId));
                if (soloPreferiti && !isFav) return;
                
                const layer = L.marker(latlng, { icon: isFav ? favMarkerIcon : markerIconParcheggio });
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

                    renderRadialSearch(searchLatLng, placeName, showTrad, showBlocca, showPark, hidePiene, soloPreferiti);
                } catch (err) {
                    console.error('[Nominatim error]', err);
                    showSearchFeedback(tr('search.noResults'), true);
                    updateFilterBadge();
                    aggiornaStatistiche(visibleRastrelliere, visibleParcheggi);
                }
            } else if (currentSearchLocation && currentSearchLocation.query === currentSearchQuery) {
                renderRadialSearch(currentSearchLocation.latLng, currentSearchLocation.displayName, showTrad, showBlocca, showPark, hidePiene, soloPreferiti);
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
        const showTrad      = document.getElementById('filter-tradizionali')?.checked ?? true;
        const showBlocca    = document.getElementById('filter-bloccatelaio')?.checked ?? true;
        const showPark      = document.getElementById('filter-parcheggi')?.checked ?? true;
        const hidePiene     = document.getElementById('filter-piene')?.checked ?? false;
        const soloPreferiti = document.getElementById('filter-preferiti')?.checked ?? false;
        const badge         = document.getElementById('filter-badge');

        const isCustomized = (!showTrad || !showBlocca || !showPark || hidePiene || soloPreferiti);
        if (badge) {
            badge.classList.toggle('hidden', !isCustomized);
        }
    }

    // =========================================================
    // TASK 1: Toggle Preferiti in tempo reale sulla mappa
    // =========================================================
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
        const numId = Number(id);
        const isFav = userFavoritiIds.has(numId);
        
        // 1. Aggiornamento ottimistico dello stato locale
        if (isFav) {
            userFavoritiIds.delete(numId);
        } else {
            userFavoritiIds.add(numId);
        }

        // 2. Chiamata API asincrona al backend per persistere nel database del profilo
        try {
            if (isFav) {
                await authFetch(`/api/v1/user/preferiti/${numId}`, { method: 'DELETE' });
            } else {
                await authFetch('/api/v1/user/preferiti', {
                    method: 'POST',
                    body: JSON.stringify({
                        rastrellieraId: numId,
                        tipologia: tipologia || 'Rastrelliera',
                        stalli: Number(stalli) || 6,
                        zona: zona || 'Trento',
                        lat: Number(lat),
                        lng: Number(lng)
                    })
                });
            }
        } catch (e) {
            console.error('Errore sincronizzazione preferito backend:', e);
        }

        // 3. Salva la posizione del popup attualmente aperto
        const openPopup = map._popup;
        let openLatLng = null;
        if (openPopup && openPopup.isOpen()) {
            openLatLng = openPopup.getLatLng();
        }

        // 4. Ridisegna istantaneamente tutti i marker sulla mappa per trasformare il cerchio in icona cuore
        if (currentSearchLocation && currentSearchLocation.query === currentSearchQuery) {
            const showTrad      = document.getElementById('filter-tradizionali')?.checked ?? true;
            const showBlocca    = document.getElementById('filter-bloccatelaio')?.checked ?? true;
            const showPark      = document.getElementById('filter-parcheggi')?.checked ?? true;
            const hidePiene     = document.getElementById('filter-piene')?.checked ?? false;
            const soloPreferiti = document.getElementById('filter-preferiti')?.checked ?? false;
            renderRadialSearch(currentSearchLocation.latLng, currentSearchLocation.displayName, showTrad, showBlocca, showPark, hidePiene, soloPreferiti);
        } else {
            await applyFiltersAndSearch(false);
        }

        // 5. Se il popup era aperto, riaprilo fluidamente sul nuovo marker corrispondente
        if (openLatLng) {
            let targetLayer = null;
            [groupTradizionale, groupBloccatelaio, groupParcheggi].forEach(group => {
                group.eachLayer(layer => {
                    const lLatLng = layer.getLatLng ? layer.getLatLng() : null;
                    if (lLatLng && Math.abs(lLatLng.lat - openLatLng.lat) < 0.00005 && Math.abs(lLatLng.lng - openLatLng.lng) < 0.00005) {
                        targetLayer = layer;
                    }
                });
            });
            if (targetLayer) {
                targetLayer.openPopup();
            }
        }
    };

    // =========================================================
    // 4. USER STORY 1: Geolocalizzazione GPS ("La mia posizione")
    // =========================================================
    function handleGeolocation() {
        const btnGeo = document.getElementById('btn-geolocation');

        // Se la navigazione live è attiva e abbiamo già le coordinate dell'utente, recentra all'istante!
        if (isLiveNavigating && lastUserCoords) {
            isFollowMode = true;
            isProgrammaticMove = true;
            map.flyTo([lastUserCoords.lat, lastUserCoords.lng], 18, { animate: true, duration: 0.8 });
            setTimeout(() => { isProgrammaticMove = false; }, 1000);
            updateTurnBanner(lastUserCoords.lat, lastUserCoords.lng);
            const btnRecenter = document.getElementById('btn-recenter-nav');
            if (btnRecenter) btnRecenter.classList.add('hidden');
            return;
        }

        if (!navigator.geolocation) {
            showSearchFeedback(tr('geo.notSupported') || 'Geolocalizzazione non supportata', true);
            return;
        }

        // Feedback visivo sul pulsante durante l'attesa
        if (btnGeo) {
            btnGeo.classList.add('locating');
            const textEl = btnGeo.querySelector('.geo-text');
            if (textEl) textEl.textContent = tr('geo.locating') || 'Rilevamento...';
        }

        const restoreButton = () => {
            if (btnGeo) {
                btnGeo.classList.remove('locating');
                const textEl = btnGeo.querySelector('.geo-text');
                if (textEl) textEl.textContent = tr('geo.button') || 'La mia posizione';
            }
        };

        const onGeoSuccess = (position) => {
            restoreButton();
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy || 30; // raggio in metri
            lastUserCoords = { lat, lng };

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

            // Marker utente dedicato
            userLocationMarker = L.circleMarker([lat, lng], {
                radius: 9,
                fillColor: '#1a73e8',
                color: '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map);

            if (!isLiveNavigating) {
                // Spostamento fluido verso la posizione dell'utente
                map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
            } else {
                isFollowMode = true;
                map.flyTo([lat, lng], 18, { animate: true, duration: 0.8 });
                updateTurnBanner(lat, lng);
            }
        };

        const onGeoError = (error) => {
            // Se fallisce per timeout con alta precisione (comune su desktop/laptop senza GPS dedicato), ritenta a precisione standard
            if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
                navigator.geolocation.getCurrentPosition(
                    onGeoSuccess,
                    (err2) => {
                        restoreButton();
                        let errorMsg = tr('geo.errorUnavailable') || 'Posizione non disponibile';
                        if (err2.code === err2.PERMISSION_DENIED) errorMsg = tr('geo.errorPermission') || 'Permesso di localizzazione negato';
                        showSearchFeedback(errorMsg, true);
                    },
                    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
                );
                return;
            }

            restoreButton();
            let errorMsg = tr('geo.errorUnavailable') || 'Posizione non disponibile';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = tr('geo.errorPermission') || 'Permesso di localizzazione negato';
            }
            showSearchFeedback(errorMsg, true);
        };

        navigator.geolocation.getCurrentPosition(
            onGeoSuccess,
            onGeoError,
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
        );
    }

    const btnGeo = document.getElementById('btn-geolocation');
    if (btnGeo) btnGeo.addEventListener('click', handleGeolocation);

    // =========================================================
    // 5. FETCH DATI DAL BACKEND (Salvataggio nel Model)
    // =========================================================
    async function loadMapData() {
        if (isTokenValid(getToken())) {
            await loadUserPreferiti();
        }
        await loadSegnalazioniRecenti();
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

    async function loadSegnalazioniRecenti() {
        try {
            const res = await fetch('/api/v1/segnalazioni/recenti');
            const data = await res.json();
            segnalazioniRecentiMap.clear();
    
            (data.segnalazioni || []).forEach(s => {
                const id = Number(s.rastrellieraId);
                if (!segnalazioniRecentiMap.has(id)) {
                    segnalazioniRecentiMap.set(id, []);
                }
                segnalazioniRecentiMap.get(id).push(s);
            });
        } catch (err) {
            console.warn('Impossibile caricare segnalazioni recenti:', err);
        }
    }


    // Listener checkbox filtri
    ['filter-tradizionali', 'filter-bloccatelaio', 'filter-parcheggi', 'filter-piene', 'filter-preferiti'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (id === 'filter-preferiti' && el.checked && !isTokenValid(getToken())) {
                alert(tr('popup.loginToFav') || 'Accedi per gestire i tuoi preferiti.');
            }
            applyFiltersAndSearch(false);
        });
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
        const isFav    = userFavoritiIds.has(Number(props.id));

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
        const numStalli = parseInt(stalli, 10) || 6;
        const tipoStr = (props.Tipo_generale || 'Rastr_tradizionale').replace(/['"\\]/g, ' ');
        const zonaStr = (props.zona || props.Tipo_generale || 'Rastrelliera').replace(/['"\\]/g, ' ');

        const favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        const favBtn = `<button id="fav-btn-${props.id}" class="popup-btn btn btn-sm ${isFav ? 'btn-error text-white' : 'btn-outline btn-error'} rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="toggleFavorito(${Number(props.id)},'${tipoStr}',${numStalli},'${zonaStr}',${lat},${lng})">
            ${favIcon} <span class="truncate">${isFav ? tr('popup.fav.remove') : tr('popup.fav.add')}</span>
        </button>`;

        const segBtn = `<button class="popup-btn btn btn-sm btn-warning text-slate-900 font-extrabold rounded-xl flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="openSegnalazioneModal(${props.id},${lat},${lng})">
            <i class="fa-solid fa-triangle-exclamation text-slate-900"></i> <span class="truncate">${tr('popup.report')}</span>
        </button>`;


        // Calcola Percorso In-App con OpenRouteService
        const rackTitle = (props.zona || props.Tipo_generale || 'Rastrelliera').replace(/'/g, "\\'");
        const dirBtn = `
            <button class="popup-btn btn btn-sm btn-primary text-white font-extrabold rounded-xl w-full gap-2 shadow-md mt-2 flex items-center justify-center text-xs py-2 h-auto min-h-[2.4rem] tracking-wide"
                onclick="window.startNavigation(${lat}, ${lng}, '${rackTitle}')">
                <i class="fa-solid fa-route text-white"></i> <span class="text-white">${tr('routing.directions') || tr('popup.directions')}</span>
            </button>`;

        // Calcolo avviso segnalazioni recenti per rastrelliere
        const numId = Number(props.id);
        const segList = segnalazioniRecentiMap.get(numId) || [];
        let alertSegnalazioneHTML = '';

        if (segList.length > 0) {
            const labelsMap = {
                luogo_non_sicuro: 'luogo poco sicuro',
                danno_strutturale: 'danni strutturali',
                vandalismo: 'atti di vandalismo/tentato furto',
                altro: 'altre problematiche'
            };

            const allTipi = [];
            segList.forEach(s => {
                if (s.tipo) {
                    s.tipo.split(', ').forEach(t => {
                        const label = labelsMap[t] || t.replace(/_/g, ' ');
                        if (!allTipi.includes(label)) allTipi.push(label);
                    });
                }
            });

            const motiviStr = allTipi.slice(0, 2).join(' e ');

            alertSegnalazioneHTML = `
                <div class="alert alert-warning bg-amber-500/15 border border-amber-500/30 text-amber-900 rounded-2xl p-2.5 text-xs flex items-start gap-2 shadow-xs">
                    <i class="fa-solid fa-triangle-exclamation text-amber-600 text-sm mt-0.5 shrink-0"></i>
                    <div class="leading-tight">
                        <strong class="font-bold block text-amber-900">Segnalazioni recenti:</strong>
                        <span class="text-slate-700">Nelle ultime ore sono state inviate segnalazioni per <em>${motiviStr || 'problemi vari'}</em>.</span>
                    </div>
                </div>`;
        }
        
        return `
            <div class="popup-content card glass-popup rounded-2xl p-4 text-slate-800 space-y-3">
                <div class="popup-header flex items-center justify-between border-b border-base-200/80 pb-2 pr-7">
                    <h3 class="popup-title font-bold text-base text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-bicycle text-primary"></i> <span>${tr('stats.racks')}</span>
                    </h3>
                    ${badgeHTML}
                </div>
                ${alertSegnalazioneHTML}
                ${isBlocca ? `
                <div class="popup-iot-card ${themeClass} rounded-2xl p-3 shadow-xs space-y-2.5">
                    <div class="popup-iot-header flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                            <span class="iot-pulse-dot"></span>
                            <strong class="iot-title font-bold">${tr('popup.smartLive')}</strong>
                        </div>
                        <span class="iot-chip badge badge-sm font-black">${occPerc ?? 0}%</span>
                    </div>
                    <div class="iot-progress-bar w-full">
                        <progress class="progress ${progressColor} w-full h-2.5 rounded-full" value="${occPerc ?? 0}" max="100"></progress>
                    </div>
                    <div class="iot-stats-row flex items-center justify-around rounded-xl p-2.5 shadow-xs">
                        <div class="iot-stat-item free text-center flex-1">
                            <span class="iot-stat-num font-black text-lg text-emerald-600 flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-circle-check text-xs"></i> <span>${freeSlots ?? 0}</span>
                            </span>
                            <div class="iot-stat-lbl text-[11px] font-extrabold uppercase mt-0.5 tracking-wide">${tr('popup.freeSlots')}</div>
                        </div>
                        <div class="iot-stat-divider w-[1px] h-7"></div>
                        <div class="iot-stat-item occupied text-center flex-1">
                            <span class="iot-stat-num font-black text-lg text-rose-600 flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-lock text-xs"></i> <span>${occSlots ?? 0}</span>
                            </span>
                            <div class="iot-stat-lbl text-[11px] font-extrabold uppercase mt-0.5 tracking-wide">${tr('popup.occupiedSlots')}</div>
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
        const parkId = Number(props.id || 10001);
        const isFav = userFavoritiIds.has(parkId);
        const stalli = parseInt(props.posti || 10, 10);
        const parkName = (props.park || 'Parcheggio Protetto').replace(/['"\\]/g, ' ');
        const viaName = (props.via || parkName).replace(/['"\\]/g, ' ');

        const favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        const favBtn = `<button id="fav-btn-${parkId}" class="popup-btn btn btn-sm ${isFav ? 'btn-error text-white' : 'btn-outline btn-error'} rounded-xl font-bold flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="toggleFavorito(${parkId},'Parcheggio_protetto',${stalli},'${viaName}',${lat},${lng})">
            ${favIcon} <span class="truncate">${isFav ? tr('popup.fav.remove') : tr('popup.fav.add')}</span>
        </button>`;

        const segBtn = `<button class="popup-btn btn btn-sm btn-warning text-slate-900 font-extrabold rounded-xl flex-1 min-w-0 text-xs px-2 shadow-xs whitespace-normal text-center leading-tight py-1.5 h-auto min-h-[2.4rem] flex items-center justify-center gap-1.5"
            onclick="openSegnalazioneModal(${parkId},${lat},${lng})">
            <i class="fa-solid fa-triangle-exclamation text-slate-900"></i> <span class="truncate">${tr('popup.report')}</span>
        </button>`;

        const note = props.note ? `<div class="popup-note alert bg-info/10 border border-info/20 text-info font-medium text-xs rounded-xl p-2.5 flex items-center gap-2 mb-2"><i class="fa-solid fa-circle-info"></i> <span>${props.note}</span></div>` : '';

        // Calcola Percorso In-App con OpenRouteService
        const dirBtn = `
            <button class="popup-btn btn btn-sm btn-primary text-white font-extrabold rounded-xl w-full gap-2 shadow-md mt-2 flex items-center justify-center text-xs py-2 h-auto min-h-[2.4rem] tracking-wide"
                onclick="window.startNavigation(${lat}, ${lng}, '${parkName}')">
                <i class="fa-solid fa-route text-white"></i> <span class="text-white">${tr('routing.directions') || tr('popup.directions')}</span>
            </button>`;

        // Calcolo avviso segnalazioni recenti per parcheggi protetti
        const segListPark = segnalazioniRecentiMap.get(parkId) || [];
        let alertParkHTML = '';

        if (segListPark.length > 0) {
            const labelsMap = {
                luogo_non_sicuro: 'luogo poco sicuro',
                danno_strutturale: 'danni strutturali',
                vandalismo: 'atti di vandalismo/tentato furto',
                altro: 'altre problematiche'
            };

            const allTipi = [];
            segListPark.forEach(s => {
                if (s.tipo) {
                    s.tipo.split(', ').forEach(t => {
                        const label = labelsMap[t] || t.replace(/_/g, ' ');
                        if (!allTipi.includes(label)) allTipi.push(label);
                    });
                }
            });

            const motiviStr = allTipi.slice(0, 2).join(' e ');

            alertParkHTML = `
                <div class="alert alert-warning bg-amber-500/15 border border-amber-500/30 text-amber-900 rounded-2xl p-2.5 text-xs flex items-start gap-2 shadow-xs">
                    <i class="fa-solid fa-triangle-exclamation text-amber-600 text-sm mt-0.5 shrink-0"></i>
                    <div class="leading-tight">
                        <strong class="font-bold block text-amber-900">Segnalazioni recenti:</strong>
                        <span class="text-slate-700">Nelle ultime ore sono state inviate segnalazioni per <em>${motiviStr || 'problemi vari'}</em>.</span>
                    </div>
                </div>`;
        }

        return `
            <div class="popup-content card glass-popup rounded-2xl p-4 text-slate-800 space-y-3">
                <div class="popup-header border-b border-base-200/80 pb-2 pr-7">
                    <h3 class="popup-title font-bold text-base text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-shield-halved text-secondary"></i> <span>${props.park || tr('stats.protected')}</span>
                    </h3>
                </div>
                ${alertParkHTML}
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

    // =========================================================
    // ROUTING IN-APP (OpenRouteService Proxy & Live Turn-by-Turn)
    // =========================================================

    // --- Funzioni Matematiche per Distanze e Percorsi ---
    function calcDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Raggio terrestre in metri
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    function distanceToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
        const dx = bLng - aLng;
        const dy = bLat - aLat;
        if (dx === 0 && dy === 0) {
            return calcDistanceMeters(pLat, pLng, aLat, aLng);
        }
        const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
        const projLng = aLng + t * dx;
        const projLat = aLat + t * dy;
        return calcDistanceMeters(pLat, pLng, projLat, projLng);
    }

    function minDistanceToPolyline(lat, lng, coords) {
        if (!coords || coords.length === 0) return 0;
        if (coords.length === 1) return calcDistanceMeters(lat, lng, coords[0][0], coords[0][1]);

        let min = Infinity;
        for (let i = 0; i < coords.length - 1; i++) {
            const d = distanceToSegmentMeters(lat, lng, coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]);
            if (d < min) min = d;
        }
        return min;
    }

    function getManeuverIcon(type) {
        switch (type) {
            case 0: return 'fa-solid fa-arrow-left';
            case 1: return 'fa-solid fa-arrow-right';
            case 2: return 'fa-solid fa-arrow-turn-left';
            case 3: return 'fa-solid fa-arrow-turn-right';
            case 4: return 'fa-solid fa-arrow-left';
            case 5: return 'fa-solid fa-arrow-right';
            case 6: return 'fa-solid fa-arrow-up';
            case 7: return 'fa-solid fa-arrows-rotate';
            case 8: return 'fa-solid fa-arrow-right-from-bracket';
            case 9: return 'fa-solid fa-rotate-left';
            case 10: return 'fa-solid fa-diamond-turn-right';
            case 11: return 'fa-solid fa-flag-checkered';
            case 12: return 'fa-solid fa-location-arrow';
            case 13: return 'fa-solid fa-arrow-left';
            case 14: return 'fa-solid fa-arrow-right';
            default: return 'fa-solid fa-diamond-turn-right';
        }
    }

    function formatInstructionText(instruction, lang = 'it') {
        if (!instruction) return '';
        if (lang === 'it') {
            let text = instruction;
            text = text.replace(/^Head north on /i, 'Avanti Nord su ');
            text = text.replace(/^Head south on /i, 'Avanti Sud su ');
            text = text.replace(/^Head east on /i, 'Avanti Est su ');
            text = text.replace(/^Head west on /i, 'Avanti Ovest su ');
            text = text.replace(/^Head north/i, 'Avanti verso Nord');
            text = text.replace(/^Head south/i, 'Avanti verso Sud');
            text = text.replace(/^Head east/i, 'Avanti verso Est');
            text = text.replace(/^Head west/i, 'Avanti verso Ovest');
            text = text.replace(/^Turn right onto /i, 'Gira a destra su ');
            text = text.replace(/^Turn left onto /i, 'Gira a sinistra su ');
            text = text.replace(/^Turn right/i, 'Gira a destra');
            text = text.replace(/^Turn left/i, 'Gira a sinistra');
            text = text.replace(/^Continue straight onto /i, 'Continua dritto su ');
            text = text.replace(/^Continue straight/i, 'Continua dritto');
            text = text.replace(/^Arrive at your destination/i, 'Arrivo a destinazione');
            return text;
        } else if (lang === 'de') {
            let text = instruction;
            text = text.replace(/^Head north on /i, 'Weiter nördlich auf ');
            text = text.replace(/^Head south on /i, 'Weiter südlich auf ');
            text = text.replace(/^Head east on /i, 'Weiter östlich auf ');
            text = text.replace(/^Head west on /i, 'Weiter westlich auf ');
            text = text.replace(/^Head north/i, 'Weiter nach Norden');
            text = text.replace(/^Head south/i, 'Weiter nach Süden');
            text = text.replace(/^Head east/i, 'Weiter nach Osten');
            text = text.replace(/^Head west/i, 'Weiter nach Westen');
            text = text.replace(/^Turn right onto /i, 'Biegen Sie rechts auf ');
            text = text.replace(/^Turn left onto /i, 'Biegen Sie links auf ');
            text = text.replace(/^Turn right/i, 'Biegen Sie rechts ab');
            text = text.replace(/^Turn left/i, 'Biegen Sie links ab');
            text = text.replace(/^Continue straight onto /i, 'Weiter geradeaus auf ');
            text = text.replace(/^Continue straight/i, 'Weiter geradeaus');
            text = text.replace(/^Arrive at your destination/i, 'Ziel erreicht');
            return text;
        }
        return instruction;
    }

    // --- Sintesi Vocale ad Alta Fedeltà (TTS) ---
    let availableVoices = [];

    function initVoices() {
        if (!window.speechSynthesis) return;
        availableVoices = window.speechSynthesis.getVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => {
                availableVoices = window.speechSynthesis.getVoices();
            };
        }
    }
    initVoices();

    function getBestVoice(langCode) {
        if (!availableVoices || availableVoices.length === 0) {
            if (window.speechSynthesis) availableVoices = window.speechSynthesis.getVoices();
        }
        if (!availableVoices || availableVoices.length === 0) return null;

        // Escludi voci legacy/robotica storiche di macOS o browser (es. Fred, Albert, Whisper, ecc.)
        const blacklistedVoices = [
            'fred', 'albert', 'whisper', 'bad news', 'bahh', 'bells', 'boing', 
            'bubbles', 'cellos', 'deranged', 'good news', 'hysterical', 
            'pipe organ', 'trinoids', 'zarvox', 'junior', 'ralph', 'organ'
        ];

        const validVoices = availableVoices.filter(v => {
            const name = (v.name || '').toLowerCase();
            return !blacklistedVoices.some(b => name.includes(b));
        });

        const targetPrefix = (langCode || 'it').substring(0, 2).toLowerCase();
        const matching = validVoices.filter(v => (v.lang || '').toLowerCase().startsWith(targetPrefix));

        if (matching.length === 0) return null;

        // Voci naturali moderne preferite per ciascuna lingua
        const preferredVoices = [
            'natural', 'premium', 'enhanced', 'siri',
            // Inglese
            'samantha', 'karen', 'daniel', 'serena', 'oliver', 'google us english', 'google uk english female', 'microsoft aria', 'microsoft guy',
            // Italiano
            'alice', 'federica', 'luca', 'cosimo', 'google italiano', 'microsoft elsa', 'microsoft diego',
            // Tedesco
            'anna', 'petra', 'markus', 'google deutsch', 'microsoft katja', 'microsoft conrad'
        ];

        for (const pref of preferredVoices) {
            const found = matching.find(v => (v.name || '').toLowerCase().includes(pref));
            if (found) return found;
        }

        return matching.find(v => v.default) || matching[0];
    }

    function speakInstruction(text) {
        if (!voiceEnabled || !window.speechSynthesis || !text) return;
        if (text === lastSpokenInstruction) return;
        lastSpokenInstruction = text;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const lang = I18n.getLanguage() || 'it';
            const targetLocale = lang === 'de' ? 'de-DE' : (lang === 'en' ? 'en-US' : 'it-IT');
            utterance.lang = targetLocale;

            const bestVoice = getBestVoice(lang);
            if (bestVoice) {
                utterance.voice = bestVoice;
            }

            utterance.rate = 0.95; // Cadenza naturale e rilassata
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speech synthesis not available:', e);
        }
    }

    function updateNavUIState(profile) {
        const btnBike  = document.getElementById('btn-nav-mode-bike');
        const btnWalk  = document.getElementById('btn-nav-mode-walk');
        const iconEl   = document.getElementById('nav-mode-icon');
        const avatarEl = document.getElementById('nav-mode-avatar');

        if (profile === 'cycling-regular') {
            if (btnBike) {
                btnBike.className = 'btn btn-xs flex-1 rounded-lg font-bold border-none bg-primary text-white shadow-xs gap-1.5 transition-all';
            }
            if (btnWalk) {
                btnWalk.className = 'btn btn-xs flex-1 rounded-lg font-bold border-none btn-ghost btn-nav-mode-inactive gap-1.5 transition-all';
            }
            if (iconEl) iconEl.className = 'fa-solid fa-bicycle';
            if (avatarEl) avatarEl.className = 'w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm';
        } else {
            if (btnWalk) {
                btnWalk.className = 'btn btn-xs flex-1 rounded-lg font-bold border-none bg-emerald-600 text-white shadow-xs gap-1.5 transition-all';
            }
            if (btnBike) {
                btnBike.className = 'btn btn-xs flex-1 rounded-lg font-bold border-none btn-ghost btn-nav-mode-inactive gap-1.5 transition-all';
            }
            if (iconEl) iconEl.className = 'fa-solid fa-person-walking';
            if (avatarEl) avatarEl.className = 'w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 text-sm';
        }
    }

    function updateTurnBanner(userLat, userLng) {
        const banner = document.getElementById('turn-by-turn-banner');
        if (!isLiveNavigating || !banner) {
            if (banner) banner.classList.add('hidden');
            return;
        }

        banner.classList.remove('hidden');

        const iconEl = document.getElementById('turn-banner-icon');
        const distEl = document.getElementById('turn-banner-distance');
        const instEl = document.getElementById('turn-banner-instruction');

        // Controlla se l'utente è arrivato a destinazione (< 15 metri)
        if (currentNavDestination) {
            const distToDest = calcDistanceMeters(userLat, userLng, currentNavDestination.lat, currentNavDestination.lng);
            if (distToDest < 15) {
                if (iconEl) iconEl.className = 'fa-solid fa-flag-checkered text-emerald-300';
                if (distEl) distEl.textContent = '0 m';
                if (instEl) instEl.textContent = tr('routing.arrived') || 'Sei arrivato a destinazione!';
                speakInstruction(tr('routing.arrived') || 'Sei arrivato a destinazione!');
                return;
            }
        }

        if (!routeSteps || routeSteps.length === 0) return;

        // Avanzamento step se l'utente è vicino (< 18m) al termine dello step corrente
        let step = routeSteps[currentStepIndex];
        if (step && step.way_points) {
            const endIdx = step.way_points[1];
            const targetCoord = routeCoordinates[endIdx];
            if (targetCoord) {
                const distToStepEnd = calcDistanceMeters(userLat, userLng, targetCoord[0], targetCoord[1]);
                if (distToStepEnd < 18 && currentStepIndex < routeSteps.length - 1) {
                    currentStepIndex++;
                    step = routeSteps[currentStepIndex];
                }
            }
        }

        if (!step) return;

        const nextIdx = step.way_points ? step.way_points[1] : 0;
        const nextCoord = routeCoordinates[nextIdx];
        let distanceText = '--';
        if (nextCoord) {
            const d = Math.round(calcDistanceMeters(userLat, userLng, nextCoord[0], nextCoord[1]));
            if (d >= 1000) {
                distanceText = (tr('routing.inDistance') || 'Tra {dist}').replace('{dist}', (d / 1000).toFixed(1) + ' ' + (tr('routing.km') || 'km'));
            } else {
                distanceText = (tr('routing.inDistance') || 'Tra {dist}').replace('{dist}', d + ' ' + (tr('routing.meters') || 'm'));
            }
        }

        const activeLang = I18n.getLanguage() || 'it';
        const formattedInstruction = formatInstructionText(step.instruction || step.name || '', activeLang);

        if (iconEl) iconEl.className = getManeuverIcon(step.type);
        if (distEl) distEl.textContent = distanceText;
        if (instEl) instEl.textContent = formattedInstruction;

        if (formattedInstruction) {
            speakInstruction(formattedInstruction);
        }
    }

    function handleLivePosition(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        lastUserCoords = { lat, lng };

        // Aggiorna layer marker utente
        if (userLocationMarker) map.removeLayer(userLocationMarker);
        if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);

        userAccuracyCircle = L.circle([lat, lng], {
            radius: Math.min(pos.coords.accuracy || 20, 300),
            color: '#1a73e8',
            fillColor: '#1a73e8',
            fillOpacity: 0.15,
            weight: 1.5,
            interactive: false
        }).addTo(map);

        userLocationMarker = L.circleMarker([lat, lng], {
            radius: 9,
            fillColor: '#1a73e8',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);

        if (isLiveNavigating) {
            if (isFollowMode) {
                isProgrammaticMove = true;
                map.panTo([lat, lng], { animate: true, duration: 0.8 });
                setTimeout(() => { isProgrammaticMove = false; }, 1000);
            }

            // Verifica deviazione dal percorso (Off-route > 50m)
            if (routeCoordinates && routeCoordinates.length > 0) {
                const distOffRoute = minDistanceToPolyline(lat, lng, routeCoordinates);
                const now = Date.now();
                if (distOffRoute > 50 && (now - lastRerouteTime > 6000)) {
                    lastRerouteTime = now;
                    console.log(`[Routing] Rilevata deviazione (${Math.round(distOffRoute)}m). Ricalcolo percorso...`);
                    const instEl = document.getElementById('turn-banner-instruction');
                    if (instEl) instEl.textContent = tr('routing.recalculating') || 'Ricalcolo percorso...';
                    if (currentNavDestination) {
                        calculateAndRenderRoute(lat, lng, currentNavDestination.lat, currentNavDestination.lng, currentNavMode, true);
                    }
                    return;
                }
            }

            updateTurnBanner(lat, lng);
        }
    }

    function startLiveNavigation() {
        if (!currentNavDestination) return;
        isLiveNavigating = true;
        isFollowMode = true;

        const btnToggle   = document.getElementById('btn-toggle-live-nav');
        const lblToggle   = document.getElementById('lbl-toggle-live-nav');
        const iconToggle  = document.getElementById('icon-toggle-live-nav');
        const btnRecenter = document.getElementById('btn-recenter-nav');

        if (btnToggle) {
            btnToggle.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
            btnToggle.classList.add('bg-rose-600', 'hover:bg-rose-700');
        }
        if (lblToggle) lblToggle.textContent = tr('routing.stopLive') || 'Termina Navigazione';
        if (iconToggle) iconToggle.className = 'fa-solid fa-stop';
        if (btnRecenter) btnRecenter.classList.add('hidden'); // Rimane nascosto perché la navigazione parte già centrata

        if (lastUserCoords) {
            isProgrammaticMove = true;
            map.setView([lastUserCoords.lat, lastUserCoords.lng], 18, { animate: true });
            setTimeout(() => { isProgrammaticMove = false; }, 1000);
            updateTurnBanner(lastUserCoords.lat, lastUserCoords.lng);
        }

        if (!liveWatchId && navigator.geolocation) {
            liveWatchId = navigator.geolocation.watchPosition(
                handleLivePosition,
                (err) => console.warn('watchPosition error:', err),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
            );
        }
    }

    function stopLiveNavigation() {
        isLiveNavigating = false;
        isFollowMode = false;

        if (liveWatchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(liveWatchId);
            liveWatchId = null;
        }

        const btnToggle   = document.getElementById('btn-toggle-live-nav');
        const lblToggle   = document.getElementById('lbl-toggle-live-nav');
        const iconToggle  = document.getElementById('icon-toggle-live-nav');
        const btnRecenter = document.getElementById('btn-recenter-nav');
        const turnBanner  = document.getElementById('turn-by-turn-banner');

        if (btnToggle) {
            btnToggle.classList.remove('bg-rose-600', 'hover:bg-rose-700');
            btnToggle.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        }
        if (lblToggle) lblToggle.textContent = tr('routing.startLive') || 'Avvia Navigazione';
        if (iconToggle) iconToggle.className = 'fa-solid fa-location-arrow';
        if (btnRecenter) btnRecenter.classList.add('hidden');
        if (turnBanner) turnBanner.classList.add('hidden');

        if (window.speechSynthesis) window.speechSynthesis.cancel();
        lastSpokenInstruction = null;
    }

    async function calculateAndRenderRoute(startLat, startLng, endLat, endLng, profile = 'cycling-regular', isReroute = false) {
        const loadingOverlay = document.getElementById('nav-loading-overlay');
        const distEl         = document.getElementById('nav-stat-distance');
        const durEl          = document.getElementById('nav-stat-duration');

        if (loadingOverlay && !isReroute) loadingOverlay.classList.remove('hidden');
        updateNavUIState(profile);

        try {
            const lang = I18n.getLanguage() || 'it';
            const url = `/api/v1/routing?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}&profile=${profile}&language=${lang}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || tr('routing.error'));
            }

            if (!data.features || data.features.length === 0) {
                throw new Error(tr('routing.error'));
            }

            const feature = data.features[0];
            const summary = feature.properties?.summary || {};
            const distMeters = summary.distance || 0;
            const durSeconds = summary.duration || 0;

            // Salva coordinate tracciato [lat, lng] e relativi step
            if (feature.geometry && feature.geometry.coordinates) {
                routeCoordinates = feature.geometry.coordinates.map(c => [c[1], c[0]]);
            } else {
                routeCoordinates = [];
            }
            routeSteps = feature.properties?.segments?.[0]?.steps || [];
            currentStepIndex = 0;

            // Formattazione Distanza
            if (distEl) {
                if (distMeters >= 1000) {
                    distEl.textContent = `${(distMeters / 1000).toFixed(1)} ${tr('routing.km') || 'km'}`;
                } else {
                    distEl.textContent = `${Math.round(distMeters)} ${tr('routing.meters') || 'm'}`;
                }
            }

            // Formattazione Durata
            if (durEl) {
                const totalMinutes = Math.round(durSeconds / 60);
                if (totalMinutes >= 60) {
                    const h = Math.floor(totalMinutes / 60);
                    const m = totalMinutes % 60;
                    durEl.textContent = `${h} ${tr('routing.hours') || 'h'} ${m} ${tr('routing.min') || 'min'}`;
                } else {
                    durEl.textContent = `${Math.max(1, totalMinutes)} ${tr('routing.min') || 'min'}`;
                }
            }

            // Pulizia layer precedenti
            if (currentRouteCasingLayer) map.removeLayer(currentRouteCasingLayer);
            if (currentRouteLayer) map.removeLayer(currentRouteLayer);

            const isBike = (profile === 'cycling-regular');

            // Casing Layer (ombra/bordo morbido)
            currentRouteCasingLayer = L.geoJSON(feature, {
                style: {
                    color: isBike ? '#1e3a8a' : '#064e3b',
                    weight: 8,
                    opacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                    interactive: false
                }
            }).addTo(map);

            // Layer Percorso principale
            currentRouteLayer = L.geoJSON(feature, {
                style: {
                    color: isBike ? '#2563eb' : '#059669',
                    weight: 5,
                    opacity: 0.95,
                    dashArray: isBike ? null : '6, 8',
                    lineCap: 'round',
                    lineJoin: 'round',
                    interactive: true
                }
            }).addTo(map);

            if (!isLiveNavigating) {
                // Inquadra l'intero tragitto con animazione
                map.fitBounds(currentRouteLayer.getBounds(), {
                    padding: [60, 60],
                    maxZoom: 17,
                    animate: true,
                    duration: 1.2
                });
            } else {
                updateTurnBanner(startLat, startLng);
            }

        } catch (err) {
            console.error('[Routing Error]', err);
            if (!isReroute) {
                alert(err.message || tr('routing.error'));
            }
        } finally {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }

    function closeRouting() {
        stopLiveNavigation();

        if (currentRouteCasingLayer) {
            map.removeLayer(currentRouteCasingLayer);
            currentRouteCasingLayer = null;
        }
        if (currentRouteLayer) {
            map.removeLayer(currentRouteLayer);
            currentRouteLayer = null;
        }
        currentNavDestination = null;
        routeCoordinates = [];
        routeSteps = [];
        currentStepIndex = 0;

        const panel = document.getElementById('routing-panel');
        if (panel) panel.classList.add('hidden');
        const btnRecenter = document.getElementById('btn-recenter-nav');
        if (btnRecenter) btnRecenter.classList.add('hidden');
    }

    window.startNavigation = function(destLat, destLng, destName) {
        currentNavDestination = { lat: destLat, lng: destLng, name: destName };
        const panel = document.getElementById('routing-panel');
        const titleEl = document.getElementById('nav-destination-title');
        const distEl  = document.getElementById('nav-stat-distance');
        const durEl   = document.getElementById('nav-stat-duration');
        const btnRecenter = document.getElementById('btn-recenter-nav');
        if (btnRecenter) btnRecenter.classList.add('hidden');

        if (titleEl) titleEl.textContent = destName || tr('routing.title');
        if (distEl)  distEl.textContent = '--';
        if (durEl)   durEl.textContent = '--';
        if (panel)   panel.classList.remove('hidden');

        map.closePopup();

        if (lastUserCoords) {
            calculateAndRenderRoute(lastUserCoords.lat, lastUserCoords.lng, destLat, destLng, currentNavMode);
        } else {
            if (!navigator.geolocation) {
                if (panel) panel.classList.add('hidden');
                alert(tr('geo.notSupported') || 'Geolocalizzazione non supportata');
                return;
            }

            const loadingOverlay = document.getElementById('nav-loading-overlay');
            if (loadingOverlay) loadingOverlay.classList.remove('hidden');

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    handleLivePosition(pos);
                    calculateAndRenderRoute(pos.coords.latitude, pos.coords.longitude, destLat, destLng, currentNavMode);
                },
                (err) => {
                    if (loadingOverlay) loadingOverlay.classList.add('hidden');
                    if (panel) panel.classList.add('hidden');
                    let errMsg = tr('routing.geoRequired') || tr('geo.errorUnavailable');
                    if (err.code === err.PERMISSION_DENIED) {
                        errMsg = tr('geo.errorPermission');
                    }
                    alert(errMsg);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    };

    // Listener Pannello Routing e Live Navigation
    const btnCloseRouting   = document.getElementById('btn-close-routing');
    const btnNavBike        = document.getElementById('btn-nav-mode-bike');
    const btnNavWalk        = document.getElementById('btn-nav-mode-walk');
    const btnToggleLiveNav  = document.getElementById('btn-toggle-live-nav');
    const btnRecenterNav    = document.getElementById('btn-recenter-nav');
    const btnToggleVoice    = document.getElementById('btn-toggle-voice');

    if (btnCloseRouting) {
        btnCloseRouting.addEventListener('click', closeRouting);
    }

    if (btnToggleLiveNav) {
        btnToggleLiveNav.addEventListener('click', () => {
            if (isLiveNavigating) {
                stopLiveNavigation();
            } else {
                startLiveNavigation();
            }
        });
    }

    if (btnRecenterNav) {
        btnRecenterNav.addEventListener('click', () => {
            isFollowMode = true;
            btnRecenterNav.classList.add('hidden');
            if (lastUserCoords) {
                isProgrammaticMove = true;
                map.setView([lastUserCoords.lat, lastUserCoords.lng], 18, { animate: true });
                setTimeout(() => { isProgrammaticMove = false; }, 1000);
                updateTurnBanner(lastUserCoords.lat, lastUserCoords.lng);
            }
        });
    }

    if (btnToggleVoice) {
        btnToggleVoice.addEventListener('click', () => {
            voiceEnabled = !voiceEnabled;
            const icon = document.getElementById('voice-icon');
            if (icon) {
                icon.className = voiceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
            }
        });
    }

    // Se l'utente sposta manualmente la mappa durante la navigazione, sospende l'auto-follow
    const handleManualMapInterruption = () => {
        if (isLiveNavigating && !isProgrammaticMove) {
            isFollowMode = false;
            if (btnRecenterNav) btnRecenterNav.classList.remove('hidden');
        }
    };

    map.on('dragstart', handleManualMapInterruption);
    map.on('zoomstart', handleManualMapInterruption);

    if (btnNavBike) {
        btnNavBike.addEventListener('click', () => {
            if (currentNavMode === 'cycling-regular') return;
            currentNavMode = 'cycling-regular';
            if (currentNavDestination && lastUserCoords) {
                calculateAndRenderRoute(lastUserCoords.lat, lastUserCoords.lng, currentNavDestination.lat, currentNavDestination.lng, currentNavMode);
            }
        });
    }

    if (btnNavWalk) {
        btnNavWalk.addEventListener('click', () => {
            if (currentNavMode === 'foot-walking') return;
            currentNavMode = 'foot-walking';
            if (currentNavDestination && lastUserCoords) {
                calculateAndRenderRoute(lastUserCoords.lat, lastUserCoords.lng, currentNavDestination.lat, currentNavDestination.lng, currentNavMode);
            }
        });
    }

    await loadMapData();
    I18n.onLanguageChange(() => {
        applyFiltersAndSearch(false);
        updateThemeUI(currentTheme);
        initWeather();
        // Se c'è un percorso aperto o navigazione attiva, ricarica le istruzioni nella nuova lingua
        if (currentNavDestination && lastUserCoords) {
            calculateAndRenderRoute(lastUserCoords.lat, lastUserCoords.lng, currentNavDestination.lat, currentNavDestination.lng, currentNavMode, isLiveNavigating);
        }
    });

    // =========================================================
    // METEO LIVE (Open-Meteo API — Trento)
    // =========================================================
    async function initWeather() {
        const tempEl = document.getElementById('weather-temp');
        const descEl = document.getElementById('weather-desc');
        const iconEl = document.getElementById('weather-icon');
        if (!tempEl || !descEl || !iconEl) return;

        function getWeatherDetails(code) {
            switch (code) {
                case 0:
                    return { icon: 'fa-sun text-amber-500', desc: 'Sereno' };
                case 1:
                case 2:
                    return { icon: 'fa-cloud-sun text-amber-400', desc: 'Poco nuvoloso' };
                case 3:
                    return { icon: 'fa-cloud text-slate-400', desc: 'Coperto' };
                case 45:
                case 48:
                    return { icon: 'fa-smog text-slate-400', desc: 'Nebbia' };
                case 51:
                case 53:
                case 55:
                case 61:
                case 63:
                case 65:
                    return { icon: 'fa-cloud-showers-heavy text-sky-500', desc: 'Pioggia' };
                case 71:
                case 73:
                case 75:
                case 77:
                case 85:
                case 86:
                    return { icon: 'fa-snowflake text-sky-300', desc: 'Neve' };
                case 80:
                case 81:
                case 82:
                    return { icon: 'fa-cloud-rain text-sky-600', desc: 'Rovesci' };
                case 95:
                case 96:
                case 99:
                    return { icon: 'fa-bolt text-amber-500', desc: 'Temporale' };
                default:
                    return { icon: 'fa-cloud-sun text-primary', desc: 'Variabile' };
            }
        }

        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=46.0697&longitude=11.1211&current=temperature_2m,weather_code';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Errore richiesta meteo');
            
            const data = await res.json();
            const current = data.current;
            if (!current) return;

            const temp = Math.round(current.temperature_2m);
            const details = getWeatherDetails(current.weather_code);

            tempEl.textContent = `${temp}°C`;
            descEl.textContent = details.desc;
            iconEl.className = `fa-solid ${details.icon} text-base`;
        } catch (err) {
            console.warn('[Meteo] Impossibile recuperare i dati meteo:', err);
            tempEl.textContent = '--°C';
            descEl.textContent = 'Non disp.';
        }
    }

    initWeather();

}); // fine DOMContentLoaded
