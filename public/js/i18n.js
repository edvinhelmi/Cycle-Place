/**
 * i18n.js — Trento Bike Parking Custom Translation Engine
 * Gestisce caricamento asincrono dei file JSON di lingua,
 * cambio dinamico della lingua, sincronizzazione DOM e persistenza in localStorage.
 */

const I18n = (function() {
    const LANG_KEY = 'tbp_lang';
    const SUPPORTED_LANGS = ['it', 'en', 'de'];
    const DEFAULT_LANG = 'it';

    let currentLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = DEFAULT_LANG;

    const cache = {}; // Memoria cache per dizionari: { it: {...}, en: {...}, de: {...} }
    const subscribers = [];

    /**
     * Carica il dizionario JSON per la lingua specificata (con caching)
     */
    async function loadLanguage(lang) {
        if (cache[lang]) return cache[lang];
        try {
            const res = await fetch(`/lang/${lang}.json`);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            cache[lang] = data;
            return data;
        } catch (err) {
            console.warn(`[i18n] Impossibile caricare /lang/${lang}.json:`, err);
            return cache[DEFAULT_LANG] || {};
        }
    }

    /**
     * Traduce una chiave, con eventuale interpolazione di parametri ({n}, {place}, ecc.)
     */
    function t(key, params = {}) {
        const dict = cache[currentLang] || cache[DEFAULT_LANG] || {};
        let text = dict[key] !== undefined ? dict[key] : key;
        if (typeof text === 'string' && params && typeof params === 'object') {
            for (const [paramKey, paramVal] of Object.entries(params)) {
                text = text.replaceAll(`{${paramKey}}`, paramVal);
            }
        }
        return text;
    }

    /**
     * Aggiorna la bandiera SVG (flag-icons) e il testo visuale del selettore
     */
    function updateFlagIcon() {
        const flagIcon = document.getElementById('lang-flag-icon');
        if (flagIcon) {
            flagIcon.className = currentLang === 'en' ? 'fi fi-gb text-base rounded-xs shadow-xs pointer-events-none' :
                                (currentLang === 'de' ? 'fi fi-de text-base rounded-xs shadow-xs pointer-events-none' : 'fi fi-it text-base rounded-xs shadow-xs pointer-events-none');
        }
        const selectedCode = document.getElementById('lang-selected-code');
        if (selectedCode) {
            selectedCode.textContent = currentLang.toUpperCase();
        }
    }

    /**
     * Applica le traduzioni a tutti gli elementi con attributi data-i18n nel DOM
     */
    function updateDOM() {
        document.documentElement.lang = currentLang;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            // Se l'elemento contiene uno span di testo (escluso flag o icone), aggiorna solo quello
            const textSpan = el.querySelector('span:not(.fi):not([class*="fa-"])');
            if (textSpan) {
                textSpan.textContent = val;
            } else if (!el.querySelector('i, svg')) {
                el.textContent = val;
            } else {
                // Preserva i tag <i> figli
                const icon = el.querySelector('i, svg');
                el.innerHTML = '';
                if (icon) el.appendChild(icon);
                const textNode = document.createTextNode((icon ? ' ' : '') + val);
                el.appendChild(textNode);
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });

        const langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = currentLang;

        updateFlagIcon();

        // Notifica tutti i componenti sottoscritti al cambio lingua
        subscribers.forEach(fn => {
            try { fn(currentLang); } catch (e) { console.error('[i18n callback error]', e); }
        });
    }

    /**
     * Cambia la lingua attiva, scarica il JSON se necessario e aggiorna il DOM
     */
    async function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
        currentLang = lang;
        localStorage.setItem(LANG_KEY, currentLang);
        await loadLanguage(currentLang);
        updateDOM();
    }

    /**
     * Inizializzazione della libreria
     */
    async function init() {
        // Precarica sia la lingua di default che quella memorizzata
        await Promise.all([loadLanguage(DEFAULT_LANG), loadLanguage(currentLang)]);
        updateDOM();

        // Listener unificato sul selettore lingua
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = currentLang;
            langSelect.addEventListener('change', e => {
                setLanguage(e.target.value);
            });
        }
    }

    /**
     * Registra un callback da eseguire ogni volta che cambia la lingua
     */
    function onLanguageChange(callback) {
        if (typeof callback === 'function') subscribers.push(callback);
    }

    function getLanguage() {
        return currentLang;
    }

    return {
        init,
        t,
        tr: t, // Alias compatibile con script.js e dashboard.js
        setLanguage,
        getLanguage,
        onLanguageChange,
        applyTranslations: updateDOM
    };
})();

// Espone I18n e tr a livello globale per retrocompatibilità
window.I18n = I18n;
window.tr = I18n.t;
