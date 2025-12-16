// Language Switcher Module
import { t, getCurrentLanguage, setLanguage } from './i18n.js';

export function initLanguageSwitcher() {
    const currentLang = getCurrentLanguage();

    // Create language toggle button
    const langToggle = document.createElement('button');
    langToggle.id = 'languageToggle';
    langToggle.className = 'language-toggle-btn';
    langToggle.setAttribute('aria-label', 'Toggle language');
    langToggle.setAttribute('title', 'Switch between English and Kannada');
    langToggle.textContent = currentLang === 'en' ? 'ಕನ್ನಡ' : 'English';

    // Insert next to theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle && themeToggle.parentNode) {
        themeToggle.parentNode.insertBefore(langToggle, themeToggle.nextSibling);
    } else {
        document.body.appendChild(langToggle);
    }

    // Add click handler
    langToggle.addEventListener('click', () => {
        toggleLanguage();
    });

    // Set initial page language
    setPageLanguage(currentLang);
}

export function toggleLanguage() {
    const currentLang = getCurrentLanguage();
    const newLang = currentLang === 'en' ? 'kn' : 'en';
    setLanguage(newLang);
    setPageLanguage(newLang);

    // Update button text
    const langToggle = document.getElementById('languageToggle');
    if (langToggle) {
        langToggle.textContent = newLang === 'en' ? 'ಕನ್ನಡ' : 'English';
    }
}

export function setPageLanguage(lang) {
    const html = document.documentElement;
    html.setAttribute('lang', lang === 'kn' ? 'kn' : 'en');

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key, lang);
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key, lang);
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key, lang);
    });

    // Update aria-label attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        element.setAttribute('aria-label', t(key, lang));
    });

    // Special handling for select options
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

    // Dispatch custom event for pages that need dynamic translation
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

export function getTranslation(key) {
    const lang = getCurrentLanguage();
    return t(key, lang);
}
