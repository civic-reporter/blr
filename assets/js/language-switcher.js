// Language Switcher Module
import {
    t,
    getCurrentLanguage,
    setLanguage,
    getAlternateLanguage,
    getLanguageToggleLabel,
    getAvailableLanguages,
    resolveLanguageForCity,
    isHubPage
} from './i18n.js';

function initHubLanguagePicker() {
    let picker = document.getElementById('languagePicker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'languagePicker';
        picker.className = 'language-picker';
        picker.setAttribute('role', 'group');
        picker.setAttribute('aria-label', 'Select language');

        [
            { code: 'en', label: 'EN' },
            { code: 'kn', label: 'ಕನ್ನಡ' }
        ].forEach(({ code, label }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'language-picker-btn';
            btn.dataset.lang = code;
            btn.textContent = label;
            btn.addEventListener('click', () => selectHubLanguage(code));
            picker.appendChild(btn);
        });

        const headerActions = document.querySelector('.home-header-actions');
        if (headerActions) {
            headerActions.appendChild(picker);
        } else {
            const header = document.querySelector('.home-header');
            if (header) header.appendChild(picker);
            else document.body.appendChild(picker);
        }
    }

    updateHubLanguagePicker(getCurrentLanguage());
}

function updateHubLanguagePicker(activeLang) {
    document.querySelectorAll('.language-picker-btn').forEach(btn => {
        const isActive = btn.dataset.lang === activeLang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function selectHubLanguage(lang) {
    setLanguage(lang);
    setPageLanguage(lang);
    updateHubLanguagePicker(lang);
}

export async function initLanguageSwitcher() {
    if (isHubPage()) {
        initHubLanguagePicker();
        setPageLanguage(resolveLanguageForCity());
        return;
    }

    const { getConfig } = await import('../web/config.js');
    await getConfig();

    const available = getAvailableLanguages();
    if (available.length < 2) {
        setPageLanguage(resolveLanguageForCity());
        return;
    }

    const currentLang = resolveLanguageForCity();

    let langToggle = document.getElementById('languageToggle');
    if (!langToggle) {
        langToggle = document.createElement('button');
        langToggle.id = 'languageToggle';
        langToggle.className = 'language-toggle-btn';
        langToggle.setAttribute('aria-label', 'Toggle language');
        langToggle.setAttribute('title', 'Switch language');

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle && themeToggle.parentNode) {
            themeToggle.parentNode.insertBefore(langToggle, themeToggle.nextSibling);
        } else {
            document.body.appendChild(langToggle);
        }

        langToggle.addEventListener('click', () => {
            toggleLanguage();
        });
    }

    langToggle.textContent = getLanguageToggleLabel(currentLang);
    setPageLanguage(currentLang);
}

export function toggleLanguage() {
    const currentLang = getCurrentLanguage();
    const newLang = getAlternateLanguage(currentLang);
    setLanguage(newLang);
    setPageLanguage(newLang);

    const langToggle = document.getElementById('languageToggle');
    if (langToggle) {
        langToggle.textContent = getLanguageToggleLabel(newLang);
    }
}

export function setPageLanguage(lang) {
    const html = document.documentElement;
    html.setAttribute('lang', lang === 'kn' ? 'kn' : lang === 'ml' ? 'ml' : 'en');

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key, lang);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key, lang);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key, lang);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        element.setAttribute('aria-label', t(key, lang));
    });

    document.querySelectorAll('select[data-i18n-options]').forEach(select => {
        const options = select.getAttribute('data-i18n-options');
        if (options) {
            const optionKeys = options.split(',');
            Array.from(select.options).forEach((option, index) => {
                if (index < optionKeys.length) {
                    option.textContent = t(optionKeys[index].trim(), lang);
                }
            });
        }
    });

    const privacyLink = document.getElementById('privacyLink');
    if (privacyLink) {
        const currentHref = privacyLink.getAttribute('href');
        const prefix = currentHref.includes('../../') ? '../../' : '';
        if (lang === 'kn') {
            privacyLink.href = prefix + 'privacy-kn.html';
        } else {
            privacyLink.href = prefix + 'privacy.html';
        }
    }

    const howToLink = document.getElementById('howToLink');
    if (howToLink) {
        const currentHref = howToLink.getAttribute('href');
        const prefix = currentHref.includes('../../') ? '../../' : '';
        if (lang === 'kn') {
            howToLink.href = prefix + 'how-to-kn.html';
        } else {
            howToLink.href = prefix + 'how-to.html';
        }
    }

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

export function getTranslation(key) {
    const lang = getCurrentLanguage();
    return t(key, lang);
}
