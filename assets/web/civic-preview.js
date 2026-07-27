import { findCorpForCurrentGPS, findWardForCurrentGPS } from './validation.js';
import { findConstituencyForCurrentGPS } from './civic-submit.js';
import { isValidNumber, isInGBA } from './utils.js';
import { getCityFeatures } from './config.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

let previewRequestId = 0;

function hasValidGps() {
    return !!(window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon) &&
        isInGBA(window.currentGPS.lat, window.currentGPS.lon));
}

function setPreviewValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || t('unknown', getCurrentLanguage());
}

function setOldWardRowVisible(visible) {
    const oldWardEl = document.getElementById('previewOldWard');
    const row = oldWardEl?.closest('.civic-preview-row');
    if (row) {
        row.classList.toggle('is-hidden', !visible);
    }
}

function formatWardText(wardNo, wardName, lang) {
    if (wardNo || wardName) {
        return [wardNo ? `Ward ${wardNo}` : '', wardName || ''].filter(Boolean).join(' · ');
    }
    return t('previewUnavailable', lang);
}

export async function updateReportPreview() {
    const panel = document.getElementById('reportPreview');
    if (!panel) return;

    const lang = getCurrentLanguage();
    const features = await getCityFeatures();
    const showOldWard = features.showOldWard !== false;
    setOldWardRowVisible(showOldWard);

    if (!hasValidGps()) {
        panel.classList.add('is-hidden');
        return;
    }

    panel.classList.remove('is-hidden');
    setPreviewValue('previewWard', t('loading', lang));
    if (showOldWard) setPreviewValue('previewOldWard', t('loading', lang));
    setPreviewValue('previewCorp', t('loading', lang));
    setPreviewValue('previewConstituency', t('loading', lang));
    setPreviewValue('previewMla', t('loading', lang));

    const requestId = ++previewRequestId;

    try {
        const [
            { acName, mlaHandle, mlaName },
            { corpName, corpHandle },
            { wardNo, wardName, oldWardNo, oldWardName }
        ] = await Promise.all([
            findConstituencyForCurrentGPS(),
            findCorpForCurrentGPS(),
            findWardForCurrentGPS()
        ]);

        if (requestId !== previewRequestId) return;

        const wardText = formatWardText(wardNo, wardName, lang);
        const oldWardText = formatWardText(oldWardNo, oldWardName, lang);

        const showCorpHandle = features.showCorpSocialHandle !== false && corpHandle;
        const corpText = corpName
            ? `${corpName}${showCorpHandle ? ` (${corpHandle})` : ''}`
            : t('previewUnavailable', lang);

        const constituencyText = acName || t('previewUnavailable', lang);
        const mlaText = mlaName
            || (features.mlaDisplay === 'name' ? t('previewUnavailable', lang) : mlaHandle)
            || (acName ? t('mlaNameNotConfigured', lang) : t('previewUnavailable', lang));

        setPreviewValue('previewWard', wardText);
        if (showOldWard) setPreviewValue('previewOldWard', oldWardText);
        setPreviewValue('previewCorp', corpText);
        setPreviewValue('previewConstituency', constituencyText);
        setPreviewValue('previewMla', mlaText);
    } catch (e) {
        console.warn('Report preview failed:', e);
        if (requestId !== previewRequestId) return;
        const unavailable = t('previewUnavailable', lang);
        setPreviewValue('previewWard', unavailable);
        if (showOldWard) setPreviewValue('previewOldWard', unavailable);
        setPreviewValue('previewCorp', unavailable);
        setPreviewValue('previewConstituency', unavailable);
        setPreviewValue('previewMla', unavailable);
    }
}

export function clearReportPreview() {
    previewRequestId++;
    const panel = document.getElementById('reportPreview');
    if (panel) panel.classList.add('is-hidden');
}
