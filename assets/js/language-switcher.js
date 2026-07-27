// Language Switcher Module
import {
    t,
    getCurrentLanguage,
    setLanguage,
    getAlternateLanguage,
    getLanguageToggleLabel,
    getAvailableLanguages
} from './i18n.js';

export function initLanguageSwitcher() {
    const available = getAvailableLanguages();
    if (available.length < 2) return;

    const currentLang = getCurrentLanguage();

    const langToggle = document.createElement('button');
    langToggle.id = 'languageToggle';
    langToggle.className = 'language-toggle-btn';
    langToggle.setAttribute('aria-label', 'Toggle language');
    langToggle.setAttribute('title', 'Switch language');
    langToggle.textContent = getLanguageToggleLabel(currentLang);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle && themeToggle.parentNode) {
        themeToggle.parentNode.insertBefore(langToggle, themeToggle.nextSibling);
    } else {
        document.body.appendChild(langToggle);
    }

    langToggle.addEventListener('click', () => {
        toggleLanguage();
    });

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
