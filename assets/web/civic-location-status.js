/**
 * Location status panel for the civic reporter.
 *
 * Mobile browsers frequently hand us a photo with its GPS tags already removed,
 * so this panel explains which of those cases happened and offers the user an
 * explicit way to supply a location instead.
 */

import { GPS_SOURCE, getGpsSource, requestLiveGpsFromUser } from './gps.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

const PANEL_ID = 'locationStatus';

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function hasPhoto() {
    return !!window.currentImageFile;
}

function stateForSource(source) {
    if (!hasPhoto()) return 'awaiting-photo';
    return source || GPS_SOURCE.NONE;
}

const STATE_PRESENTATION = {
    'awaiting-photo': { icon: 'fa-image', tone: 'neutral' },
    [GPS_SOURCE.NONE]: { icon: 'fa-location-dot', tone: 'neutral' },
    [GPS_SOURCE.PHOTO]: { icon: 'fa-circle-check', tone: 'success' },
    [GPS_SOURCE.LIVE]: { icon: 'fa-location-crosshairs', tone: 'success' },
    [GPS_SOURCE.MANUAL]: { icon: 'fa-map-pin', tone: 'success' },
    [GPS_SOURCE.STRIPPED]: { icon: 'fa-triangle-exclamation', tone: 'warn' },
    [GPS_SOURCE.NO_LOCATION_TAG]: { icon: 'fa-triangle-exclamation', tone: 'warn' },
    [GPS_SOURCE.OUTSIDE_BOUNDARY]: { icon: 'fa-circle-xmark', tone: 'error' }
};

const STATE_COPY = {
    'awaiting-photo': ['locStatusTitleNoPhoto', 'locStatusBodyNoPhoto'],
    [GPS_SOURCE.NONE]: ['locStatusTitleNone', 'locStatusBodyNone'],
    [GPS_SOURCE.PHOTO]: ['locStatusTitlePhoto', 'locStatusBodyPhoto'],
    [GPS_SOURCE.LIVE]: ['locStatusTitleLive', 'locStatusBodyLive'],
    [GPS_SOURCE.MANUAL]: ['locStatusTitleManual', 'locStatusBodyManual'],
    [GPS_SOURCE.STRIPPED]: ['locStatusTitleStripped', 'locStatusBodyStripped'],
    [GPS_SOURCE.NO_LOCATION_TAG]: ['locStatusTitleNoTag', 'locStatusBodyNoTag'],
    [GPS_SOURCE.OUTSIDE_BOUNDARY]: ['locStatusTitleOutside', 'locStatusBodyOutside']
};

const MISSING_GPS_STATES = new Set([
    GPS_SOURCE.STRIPPED,
    GPS_SOURCE.NO_LOCATION_TAG
]);

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function helpTipKeys() {
    if (isAndroid()) return ['gpsHelpAndroid1', 'gpsHelpAndroid2', 'gpsHelpAndroid3'];
    if (isIos()) return ['gpsHelpIos1', 'gpsHelpIos2', 'gpsHelpIos3'];
    return ['gpsHelpGeneric1', 'gpsHelpGeneric2', 'gpsHelpGeneric3'];
}

function buildHelpSection(lang) {
    const tips = helpTipKeys()
        .map((key) => `<li>${escapeHtml(t(key, lang))}</li>`)
        .join('');

    return `
        <details class="civic-loc-help">
            <summary>${escapeHtml(t('gpsHelpToggle', lang))}</summary>
            <ul class="civic-loc-help-list">${tips}</ul>
        </details>
    `;
}

export function renderLocationStatus() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const lang = getCurrentLanguage();
    const state = stateForSource(getGpsSource());
    const presentation = STATE_PRESENTATION[state] || STATE_PRESENTATION[GPS_SOURCE.NONE];
    const [titleKey, bodyKey] = STATE_COPY[state] || STATE_COPY[GPS_SOURCE.NONE];
    let bodyText = t(bodyKey, lang);
    if (state === GPS_SOURCE.LIVE && Number.isFinite(window.currentGPSAccuracy)) {
        bodyText = `${bodyText} ${t('locationAccuracyNote', lang).replace('{meters}', String(Math.round(window.currentGPSAccuracy)))}`;
    }

    const showLiveButton = state !== GPS_SOURCE.PHOTO && state !== 'awaiting-photo';
    const showHelp = MISSING_GPS_STATES.has(state);

    panel.dataset.state = state;
    panel.dataset.tone = presentation.tone;
    panel.innerHTML = `
        <div class="civic-loc-main">
            <span class="civic-loc-icon" aria-hidden="true"><i class="fas ${presentation.icon}"></i></span>
            <div class="civic-loc-copy">
                <p class="civic-loc-title">${escapeHtml(t(titleKey, lang))}</p>
                <p class="civic-loc-body">${escapeHtml(bodyText)}</p>
            </div>
        </div>
        ${showLiveButton ? `
        <div class="civic-loc-actions">
            <button type="button" id="useLiveLocationBtn" class="civic-loc-btn">
                <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                <span>${escapeHtml(t('useMyLocation', lang))}</span>
            </button>
            <p class="civic-loc-hint">${escapeHtml(t('orSetPinManually', lang))}</p>
        </div>` : ''}
        ${showHelp ? buildHelpSection(lang) : ''}
    `;

    const liveBtn = document.getElementById('useLiveLocationBtn');
    if (liveBtn) liveBtn.addEventListener('click', handleUseLiveLocation);
}

async function handleUseLiveLocation(event) {
    const button = event.currentTarget;
    const lang = getCurrentLanguage();
    const label = button.querySelector('span');
    const originalLabel = label ? label.textContent : '';

    button.disabled = true;
    if (label) label.textContent = t('locatingNow', lang);

    try {
        const result = await requestLiveGpsFromUser();
        if (result.ok) {
            renderLocationStatus();
            if (result.lowAccuracy) {
                const meters = Math.round(result.accuracy);
                showInlineError(t('locationLowAccuracyManual', lang).replace('{meters}', String(meters)));
            }
            return;
        }

        const reasonKey = {
            denied: 'locationDenied',
            outside: 'locationOutsideGba',
            unsupported: 'locationUnsupported',
            'low-accuracy': 'locationLowAccuracy'
        }[result.reason] || 'locationUnavailable';

        const message = result.reason === 'low-accuracy' && result.accuracy
            ? t(reasonKey, lang).replace('{meters}', String(Math.round(result.accuracy)))
            : t(reasonKey, lang);
        showInlineError(message);
    } finally {
        const stillMounted = document.body.contains(button);
        if (stillMounted) {
            button.disabled = false;
            if (label) label.textContent = originalLabel;
        }
    }
}

function showInlineError(message) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    let errorEl = panel.querySelector('.civic-loc-error');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'civic-loc-error';
        errorEl.setAttribute('role', 'alert');
        panel.appendChild(errorEl);
    }
    if (!message) {
        errorEl.remove();
        return;
    }

    errorEl.textContent = message;
}

export function initLocationStatus() {
    renderLocationStatus();
    document.addEventListener('civic:gps-source', renderLocationStatus);
    window.addEventListener('languageChanged', renderLocationStatus);
    window.renderCivicLocationStatus = renderLocationStatus;
}
