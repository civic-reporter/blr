import { findCorpForCurrentGPS, findWardForCurrentGPS } from './validation.js';
import { findConstituencyForCurrentGPS } from './twitter.js';
import { isValidNumber, isInGBA } from './utils.js';
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

export async function updateReportPreview() {
    const panel = document.getElementById('reportPreview');
    if (!panel) return;

    const lang = getCurrentLanguage();

    if (!hasValidGps()) {
        panel.classList.add('is-hidden');
        return;
    }

    panel.classList.remove('is-hidden');
    setPreviewValue('previewWard', t('loading', lang));
    setPreviewValue('previewCorp', t('loading', lang));
    setPreviewValue('previewConstituency', t('loading', lang));
    setPreviewValue('previewMla', t('loading', lang));

    const requestId = ++previewRequestId;

    try {
        const [
            { acName, mlaHandle },
            { corpName, corpHandle },
            { wardNo, wardName }
        ] = await Promise.all([
            findConstituencyForCurrentGPS(),
            findCorpForCurrentGPS(),
            findWardForCurrentGPS()
        ]);

        if (requestId !== previewRequestId) return;

        const wardText = wardNo || wardName
            ? [wardNo ? `Ward ${wardNo}` : '', wardName || ''].filter(Boolean).join(' · ')
            : t('previewUnavailable', lang);

        const corpText = corpName
            ? `${corpName}${corpHandle ? ` (${corpHandle})` : ''}`
            : t('previewUnavailable', lang);

        const constituencyText = acName || t('previewUnavailable', lang);
        const mlaText = mlaHandle || t('previewUnavailable', lang);

        setPreviewValue('previewWard', wardText);
        setPreviewValue('previewCorp', corpText);
        setPreviewValue('previewConstituency', constituencyText);
        setPreviewValue('previewMla', mlaText);
    } catch (e) {
        console.warn('Report preview failed:', e);
        if (requestId !== previewRequestId) return;
        const unavailable = t('previewUnavailable', lang);
        setPreviewValue('previewWard', unavailable);
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
