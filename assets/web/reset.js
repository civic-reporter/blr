import { showUploadOptions, showStatus, showWorkflow } from './ui.js';
import { clearCivicDraft } from './civic-submit.js';
import { clearReportPreview } from './civic-preview.js';
import { resetGpsSource } from './gps.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

export function resetApp() {
    clearCivicDraft();
    clearReportPreview();
    // 1. Clear global state
    window.currentImageFile = null;
    window.currentGPS = null;
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = false;
    resetGpsSource();
    if (window.map && window.marker) {
        window.map.removeLayer(window.marker);
        window.marker = null;
    }

    // 2. Reset form + preview (support both civic and traffic)
    const issueTypeEl = document.getElementById('issueType');
    const trafficCategoryEl = document.getElementById('trafficCategory');
    const issueDescEl = document.getElementById('issueDesc');
    const trafficDescEl = document.getElementById('trafficDesc');

    if (issueTypeEl) issueTypeEl.value = 'Pothole';
    if (trafficCategoryEl) trafficCategoryEl.value = '';
    if (issueDescEl) issueDescEl.value = '';
    if (trafficDescEl) trafficDescEl.value = '';

    const preview = document.getElementById('preview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    const confirmCheck = document.getElementById('confirmImageCheck');
    if (confirmCheck) confirmCheck.checked = false;
    const locationConfirmCheck = document.getElementById('confirmLocationCheck');
    if (locationConfirmCheck) locationConfirmCheck.checked = false;

    const whatsappSuccessBox = document.getElementById('whatsappSuccessBox');
    if (whatsappSuccessBox) {
        whatsappSuccessBox.innerHTML = '';
        whatsappSuccessBox.classList.add('is-hidden');
    }

    const searchInput = document.getElementById('gbaSearch');
    const suggBox = document.getElementById('gbaSearchSuggestions');
    const searchWrapper = document.getElementById('gbaSearchWrapper');
    const mapEl = document.getElementById('map');

    if (searchInput) searchInput.value = '';
    if (suggBox) {
        suggBox.innerHTML = '';
        suggBox.style.display = 'none';
    }
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (mapEl) mapEl.style.display = 'none';


    const submitBtn = document.getElementById('submitBtn');
    const trafficSubmitBtn = document.getElementById('trafficSubmit');

    if (submitBtn) {
        submitBtn.classList.remove('loading');
        submitBtn.textContent = t('postIssue', getCurrentLanguage());
        submitBtn.disabled = true;
    }
    if (trafficSubmitBtn) {
        trafficSubmitBtn.classList.remove('loading');
        trafficSubmitBtn.textContent = '🚦 Report';
        trafficSubmitBtn.disabled = true;
    }

    // 5. Show upload screen
    showStatus('', '');
    showWorkflow();
    showUploadOptions();
    if (window.resetCivicSteps) window.resetCivicSteps();
}
