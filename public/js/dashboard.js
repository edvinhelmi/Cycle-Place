/**
 * dashboard.js — Area Personale Trento Bike Parking
 * Coerente con la pagina principale (Task 1, Task 4, RNF1, RNF6)
 */

const TOKEN_KEY = 'tbp_jwt';
const REFRESH_TOKEN_KEY = 'tbp_refresh_jwt';

// =======================================================
// JWT Helpers
// =======================================================
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getRefreshToken() { return localStorage.getItem(REFRESH_TOKEN_KEY); }
function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function decodeToken(token) {
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
}

function isTokenValid(token) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
        const dRefresh = decodeToken(refreshToken);
        if (dRefresh && dRefresh.exp && dRefresh.exp * 1000 > Date.now()) {
            return true;
        }
    }
    if (!token) return false;
    const d = decodeToken(token);
    return d && d.exp && d.exp * 1000 > Date.now();
}

function authHeaders() {
    return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
}

function formatDate(iso) {
    if (!iso) return '—';
    const lang = I18n.getLanguage();
    const loc = lang === 'de' ? 'de-DE' : (lang === 'en' ? 'en-US' : 'it-IT');
    return new Date(iso).toLocaleString(loc, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Cache dati per ri-render al cambio lingua
let cachedPreferiti = [];
let cachedSegnalazioni = [];

// =======================================================
// Inizializzazione Dashboard
// =======================================================
async function init() {
    await I18n.init();

    const token = getToken();
    if (!isTokenValid(token)) {
        window.location.href = '/';
        return;
    }

    const user = decodeToken(token);

    function updateProfileProvider() {
        const pProvider = document.getElementById('p-provider');
        if (pProvider) {
            pProvider.innerHTML = user.provider === 'google' 
                ? '<i class="fa-brands fa-google text-primary"></i> <span>' + tr('dash.googleAccount') + '</span>'
                : '<i class="fa-solid fa-house-user"></i> <span>' + tr('dash.localAccount') + '</span>';
        }
    }

    // Navbar & Saluto utente
    const userNameSpan = document.getElementById('dash-user-name');
    if (userNameSpan) userNameSpan.textContent = user.name || 'Utente';

    // Dati Anagrafici Profilo
    const pName     = document.getElementById('p-name');
    const pSurname  = document.getElementById('p-surname');
    const pEmail    = document.getElementById('p-email');

    if (pName)     pName.textContent     = user.name    || '—';
    if (pSurname)  pSurname.textContent  = user.surname || '—';
    if (pEmail)    pEmail.textContent    = user.email   || '—';
    updateProfileProvider();

    // Setup Mobile Hamburger Menu (RNF1, RNF6)
    setupMobileMenu();

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
        updateThemeUI(newTheme);
    }

    if (themeToggleCheckbox) {
        themeToggleCheckbox.addEventListener('change', () => {
            applyTheme(themeToggleCheckbox.checked ? 'dark' : 'trento');
        });
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'trento';
    updateThemeUI(currentTheme);

    // Sottoscrizione al cambio lingua I18n
    I18n.onLanguageChange(() => {
        updateProfileProvider();
        renderPreferiti(cachedPreferiti);
        renderSegnalazioni(cachedSegnalazioni);
        updateThemeUI(document.documentElement.getAttribute('data-theme') || 'trento');
    });

    // Carica Preferiti e Segnalazioni
    await Promise.all([loadPreferiti(), loadSegnalazioni()]);

    // Logout
    const btnLogout = document.getElementById('dash-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            removeToken();
            window.location.href = '/';
        });
    }
}

// =======================================================
// Mobile Hamburger Menu
// =======================================================
function setupMobileMenu() {
    const btnHamburger = document.getElementById('btn-hamburger');
    const userControls = document.getElementById('user-controls');

    function toggleMenu() {
        if (!userControls || !btnHamburger) return;
        const isActive = userControls.classList.toggle('active');
        btnHamburger.setAttribute('aria-expanded', String(isActive));
        const iconSpan = btnHamburger.querySelector('.hamburger-icon');
        if (iconSpan) {
            iconSpan.innerHTML = isActive ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        }
    }

    function closeMenu() {
        if (!userControls || !btnHamburger) return;
        userControls.classList.remove('active');
        btnHamburger.setAttribute('aria-expanded', 'false');
        const iconSpan = btnHamburger.querySelector('.hamburger-icon');
        if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }

    if (btnHamburger) {
        btnHamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    document.addEventListener('click', (e) => {
        if (userControls && userControls.classList.contains('active')) {
            if (!userControls.contains(e.target) && !btnHamburger.contains(e.target)) {
                closeMenu();
            }
        }
    });
}

// =======================================================
// Gestione Preferiti
// =======================================================
async function loadPreferiti() {
    try {
        const res = await fetch('/api/v1/user/preferiti', { headers: authHeaders() });
        const data = await res.json();
        cachedPreferiti = (res.ok && data.preferiti) ? data.preferiti : [];
        renderPreferiti(cachedPreferiti);
    } catch (err) {
        console.error('Errore caricamento preferiti:', err);
    }
}

function renderPreferiti(items) {
    const list = document.getElementById('preferiti-list');
    if (!list) return;

    if (!items || items.length === 0) {
        list.innerHTML = `<p class="empty-msg alert bg-base-100/70 border border-base-300 text-slate-500 font-medium text-sm rounded-2xl">${tr('dash.noFavourites')}</p>`;
        return;
    }

    list.innerHTML = items.map(f => `
        <div class="list-item card bg-base-100/90 border border-base-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5" id="fav-${f.id}">
            <div class="list-item-info space-y-1">
                <div class="font-bold text-slate-800 text-sm sm:text-base flex flex-wrap items-center gap-2">
                    ${f.tipologia === 'Parcheggio_protetto' 
                        ? `<span><i class="fa-solid fa-shield-halved text-secondary"></i> ${f.zona || 'Parcheggio Protetto'}</span><span class="badge badge-sm badge-secondary text-white font-bold">Bici Box</span>` 
                        : `<span><i class="fa-solid fa-bicycle text-primary"></i> ${tr('dash.rack')} #${f.id}</span>`}
                    ${f.stalli ? `<span class="badge badge-sm badge-ghost font-bold text-slate-600">(${f.stalli} ${tr('dash.stalli')})</span>` : ''}
                    ${f.tipologia === 'Rastr_bloccatelaio' ? '<span class="badge badge-sm badge-accent text-white font-bold">bloccatelaio</span>' : ''}
                </div>
                <div class="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span><i class="fa-solid fa-location-dot text-slate-400"></i> ${tr('dash.zone')}: <strong>${f.zona || '—'}</strong></span>
                    <span class="text-slate-300">•</span>
                    <span><i class="fa-regular fa-calendar text-slate-400"></i> ${tr('dash.savedOn')} ${formatDate(f.savedAt)}</span>
                </div>
            </div>
            <div class="list-item-actions w-full sm:w-auto">
                <button class="btn btn-sm btn-outline btn-error rounded-xl w-full sm:w-auto font-semibold gap-1.5 mt-2" onclick="rimuoviPreferito(${f.id})">
                    <i class="fa-solid fa-trash-can"></i> <span>${tr('dash.remove')}</span>
                </button>
            </div>
        </div>`).join('');
}

async function rimuoviPreferito(id) {
    try {
        const res = await fetch(`/api/v1/user/preferiti/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            cachedPreferiti = cachedPreferiti.filter(f => f.id !== id);
            renderPreferiti(cachedPreferiti);
        }
    } catch (err) {
        console.error('Errore rimozione preferito:', err);
    }
}

// =======================================================
// Gestione Segnalazioni
// =======================================================
async function loadSegnalazioni() {
    try {
        const res = await fetch('/api/v1/segnalazioni/user', { headers: authHeaders() });
        const data = await res.json();
        cachedSegnalazioni = (res.ok && data.segnalazioni) ? data.segnalazioni : [];
        renderSegnalazioni(cachedSegnalazioni);
    } catch (err) {
        console.error('Errore caricamento segnalazioni:', err);
    }
}

function getTipoIcon(tipo) {
    switch (tipo) {
        case 'bici_abbandonata':  return '<i class="fa-solid fa-bicycle text-primary"></i>';
        case 'danno_strutturale': return '<i class="fa-solid fa-wrench text-warning"></i>';
        case 'rastrelliera_piena':return '<i class="fa-solid fa-ban text-error"></i>';
        case 'vandalismo':        return '<i class="fa-solid fa-triangle-exclamation text-error"></i>';
        default:                  return '<i class="fa-solid fa-pen-to-square text-info"></i>';
    }
}

function renderSegnalazioni(items) {
    const list = document.getElementById('segnalazioni-list');
    if (!list) return;

    if (!items || items.length === 0) {
        list.innerHTML = `<p class="empty-msg alert bg-base-100/70 border border-base-300 text-slate-500 font-medium text-sm rounded-2xl">${tr('dash.noReports')}</p>`;
        return;
    }

    list.innerHTML = [...items].reverse().map(s => {
        const tipoText = tr(`tipo.${s.tipo}`) || s.tipo;
        const icon = getTipoIcon(s.tipo);
        const badgeClass = s.stato === 'risolta' ? 'badge-success text-white' : (s.stato === 'in_lavorazione' ? 'badge-warning text-white' : 'badge-info text-white');
        return `
        <div class="list-item card bg-base-100/90 border border-base-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div class="list-item-info space-y-1">
                <div class="font-bold text-slate-800 text-sm sm:text-base flex flex-wrap items-center gap-2">
                    <span>${icon} ${tipoText}</span>
                    <span class="text-slate-500 font-normal">— ${tr('dash.rack')} #${s.rastrellieraId}</span>
                </div>
                <div class="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span><i class="fa-regular fa-calendar text-slate-400"></i> ${formatDate(s.timestamp)}</span>
                    ${s.note ? `<span class="text-slate-300">•</span> <span class="italic text-slate-600">"${s.note}"</span>` : ''}
                </div>
            </div>
            <div class="list-item-actions w-full sm:w-auto flex justify-start sm:justify-end">
                <span class="badge ${badgeClass} font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-lg">${s.stato || 'inviata'}</span>
            </div>
        </div>`;
    }).join('');
}



// Esponi per onclick inline
window.rimuoviPreferito = rimuoviPreferito;

// =======================================================
// GESTIONE MODIFICA PROFILO, PASSWORD & NOTIFICHE (RF 3.2, RF 3.3)
// =======================================================
const btnToggleEdit = document.getElementById('btn-toggle-edit-profile');
const profileViewMode = document.getElementById('profile-view-mode');
const profileEditForm = document.getElementById('profile-edit-form');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const editMsg = document.getElementById('edit-profile-msg');
const editBtnText = document.getElementById('edit-profile-btn-text');

function toggleEditProfile(show) {
    if (!profileViewMode || !profileEditForm) return;
    const isEditing = show !== undefined ? show : profileEditForm.classList.contains('hidden');
    
    if (isEditing) {
        profileViewMode.classList.add('hidden');
        profileEditForm.classList.remove('hidden');
        if (editBtnText) editBtnText.textContent = 'Chiudi Modifica';
        
        // Svuota i campi password per evitare l'autocompilazione del browser
        document.getElementById('edit-curr-pass').value = '';
        document.getElementById('edit-new-pass').value = '';
        document.getElementById('edit-conf-pass').value = '';

        // Ripristina tutte le icone a tipo "password"
        document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
            const target = document.getElementById(btn.dataset.target);
            if (target) target.type = 'password';
            btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
        });

        const decoded = decodeToken(getToken());
        if (decoded) {
            document.getElementById('edit-name').value = decoded.name || '';
            document.getElementById('edit-surname').value = decoded.surname || '';
        }

        const pwdSection = document.getElementById('password-change-section');
        if (pwdSection && decoded?.provider === 'google') {
            pwdSection.classList.add('hidden');
        }
    } else {
        profileViewMode.classList.remove('hidden');
        profileEditForm.classList.add('hidden');
        if (editBtnText) editBtnText.textContent = 'Modifica Dati';
        profileEditForm.reset();
        if (editMsg) editMsg.textContent = '';
    }
}

// Gestione click sugli occhietti
document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const inputId = btn.dataset.target;
        const input = document.getElementById(inputId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash text-primary"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
});

if (btnToggleEdit) btnToggleEdit.addEventListener('click', () => toggleEditProfile());
if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => toggleEditProfile(false));

if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (editMsg) editMsg.textContent = '';

        const name = document.getElementById('edit-name').value.trim();
        const surname = document.getElementById('edit-surname').value.trim();
        const notificheEmail = document.getElementById('edit-notif-email').checked;

        const currentPassword = document.getElementById('edit-curr-pass').value;
        const newPassword = document.getElementById('edit-new-pass').value;
        const confPassword = document.getElementById('edit-conf-pass').value;

        if (newPassword || currentPassword || confPassword) {
            if (!currentPassword) {
                editMsg.className = 'text-xs font-bold text-error';
                editMsg.textContent = '❌ Inserisci la tua password attuale per confermare il cambio password.';
                return;
            }
            if (newPassword !== confPassword) {
                editMsg.className = 'text-xs font-bold text-error';
                editMsg.textContent = '❌ La nuova password e la conferma non coincidono.';
                return;
            }
            const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
            if (!PASSWORD_REGEX.test(newPassword)) {
                editMsg.className = 'text-xs font-bold text-error';
                editMsg.textContent = '❌ La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un carattere speciale.';
                return;
            }
        }

        try {
            const res = await fetch('/api/v1/user/profile', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    name,
                    surname,
                    notificheEmail,
                    currentPassword: currentPassword || undefined,
                    newPassword: newPassword || undefined
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Salva il nuovo token rigenerato
            if (data.token) {
                localStorage.setItem(TOKEN_KEY, data.token);
            }

            // Aggiorna anagrafica a schermo
            document.getElementById('p-name').textContent = data.user.name;
            document.getElementById('p-surname').textContent = data.user.surname;
            const greetEl = document.getElementById('dash-user-name');
            if (greetEl) greetEl.textContent = data.user.name;

            editMsg.className = 'text-xs font-bold text-success';
            editMsg.textContent = '✅ Dati aggiornati con successo!';

            setTimeout(() => {
                toggleEditProfile(false);
            }, 1200);

        } catch (err) {
            editMsg.className = 'text-xs font-bold text-error';
            editMsg.textContent = '❌ ' + (err.message || 'Errore durante l\'aggiornamento dei dati');
        }
    });
}

// =======================================================
// CANCELLAZIONE ACCOUNT GDPR (RF 3.4)
// =======================================================
const modalDeleteAccount = document.getElementById('modal-delete-account');
const btnOpenDeleteModal = document.getElementById('btn-open-delete-modal');
const btnCancelDeleteAccount = document.getElementById('btn-cancel-delete-account');
const btnConfirmDeleteAccount = document.getElementById('btn-confirm-delete-account');
const deleteAccountError = document.getElementById('delete-account-error');

if (btnOpenDeleteModal && modalDeleteAccount) {
    btnOpenDeleteModal.addEventListener('click', () => {
        if (deleteAccountError) deleteAccountError.textContent = '';
        modalDeleteAccount.showModal();
    });
}

if (btnCancelDeleteAccount && modalDeleteAccount) {
    btnCancelDeleteAccount.addEventListener('click', () => {
        modalDeleteAccount.close();
    });
}

if (btnConfirmDeleteAccount) {
    btnConfirmDeleteAccount.addEventListener('click', async () => {
        btnConfirmDeleteAccount.disabled = true;
        btnConfirmDeleteAccount.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Eliminazione...';

        try {
            const res = await fetch('/api/v1/user/account', {
                method: 'DELETE',
                headers: authHeaders()
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore durante la cancellazione');

            // Rimuovi token locale e reindirizza alla home
            removeToken();
            window.location.href = '/?deleted=1';

        } catch (err) {
            btnConfirmDeleteAccount.disabled = false;
            btnConfirmDeleteAccount.innerHTML = '<i class="fa-solid fa-trash-can"></i> Sì, Elimina Definitivamente';
            if (deleteAccountError) {
                deleteAccountError.textContent = '❌ ' + err.message;
            }
        }
    });
}

// Avvio
document.addEventListener('DOMContentLoaded', init);

