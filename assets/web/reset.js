import { showUploadOptions, showStatus } from './ui.js';

export function resetApp() {
    // 1. Clear global state
    window.currentImageFile = null;
    window.currentGPS = null;
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

    // 3. Reset search + map (HIDE until needed)
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

    // 4. Reset buttons (support both civic and traffic)
    const tweetBtn = document.getElementById('tweetBtn');
    const trafficSubmitBtn = document.getElementById('trafficSubmit');

    if (tweetBtn) {
        tweetBtn.classList.remove('loading');
        tweetBtn.textContent = '🚨 Post Issue via @zenc_civic';
        tweetBtn.disabled = true;
    }
    if (trafficSubmitBtn) {
        trafficSubmitBtn.classList.remove('loading');
        trafficSubmitBtn.textContent = '🚦 Report';
        trafficSubmitBtn.disabled = true;
    }

    // 5. Show upload screen
    showStatus('', '');
    showUploadOptions();
}
