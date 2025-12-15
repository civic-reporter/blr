import { showUploadOptions, showStatus } from './ui.js';

export function resetApp() {
    // Clear state
    window.currentImageFile = null;
    window.currentGPS = null;
    if (window.map && window.marker) {
        window.map.removeLayer(window.marker);
        window.marker = null;
    }

    // Reset form
    document.getElementById('issueType').value = 'Pothole';
    document.getElementById('issueDesc').value = '';
    const preview = document.getElementById('preview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    const confirmCheck = document.getElementById('confirmImageCheck');
    if (confirmCheck) confirmCheck.checked = false;

    // ✅ CRITICAL: Reset MAP + SEARCH
    const mapEl = document.getElementById('map');
    const searchWrapper = document.getElementById('gbaSearchWrapper');
    const searchInput = document.getElementById('gbaSearch');
    const suggBox = document.getElementById('gbaSearchSuggestions');

    if (searchInput) searchInput.value = '';
    if (suggBox) {
        suggBox.innerHTML = '';
        suggBox.style.display = 'none';
    }
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (mapEl) mapEl.style.display = 'none';

    // Show upload options
    ['uploadOptions'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty('display');
    });

    if (window.tweetBtn) {
        window.tweetBtn.classList.remove('loading');
        window.tweetBtn.textContent = '🚨 Post Issue via @zenc_civic';
        window.tweetBtn.disabled = true;
    }

    showStatus('', '');
    showUploadOptions();
}
