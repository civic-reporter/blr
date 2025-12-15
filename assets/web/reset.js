import { showUploadOptions, showStatus } from './ui.js';

export function resetApp() {
    // 1. Clear global state
    window.currentImageFile = null;
    window.currentGPS = null;
    if (window.map && window.marker) {
        window.map.removeLayer(window.marker);
        window.marker = null;
    }

    // 2. Reset form + preview
    document.getElementById('issueType').value = 'Pothole';
    document.getElementById('issueDesc').value = '';
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

    // 4. Reset tweet button
    if (window.tweetBtn) {
        window.tweetBtn.classList.remove('loading');
        window.tweetBtn.textContent = '🚨 Post Issue via @zenc_civic';
        window.tweetBtn.disabled = true;
    }

    // 5. Show upload screen
    showStatus('', '');
    showUploadOptions();
}
