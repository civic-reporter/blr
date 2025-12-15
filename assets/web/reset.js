import { showUploadOptions, showStatus } from './ui.js';

export function resetApp() {
    // 1️⃣ Clear global state
    window.currentImageFile = null;
    window.currentGPS = null;

    // 2️⃣ Clear map marker
    if (window.map && window.marker) {
        window.map.removeLayer(window.marker);
        window.marker = null;
    }

    // 3️⃣ Reset form + preview
    document.getElementById('issueType').value = 'Pothole';
    document.getElementById('issueDesc').value = '';
    document.getElementById('preview').src = '';
    document.getElementById('preview').style.display = 'none';
    document.getElementById('confirmImageCheck').checked = false;

    // 4️⃣ RESET MAP + SEARCH (CRITICAL)
    const mapEl = document.getElementById('map');
    const searchInput = document.getElementById('gbaSearch');
    const suggBox = document.getElementById('gbaSearchSuggestions');
    const searchWrapper = document.getElementById('gbaSearchWrapper');

    if (searchInput) searchInput.value = '';
    if (suggBox) suggBox.innerHTML = '', suggBox.style.display = 'none';
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (mapEl) mapEl.style.display = 'none';  // Hide until needed

    // 5️⃣ Show ALL UI sections
    ['uploadOptions', 'locationInfo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty('display');
    });
    document.querySelectorAll('.form-group').forEach(el => el.style.removeProperty('display'));

    // 6️⃣ Reset tweet button
    if (window.tweetBtn) {
        window.tweetBtn.classList.remove('loading');
        window.tweetBtn.textContent = '🚨 Post Issue via @zenc_civic';
        window.tweetBtn.disabled = true;
    }

    showStatus('', '');
    showUploadOptions();
}
