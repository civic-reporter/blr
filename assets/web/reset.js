import { showUploadOptions, showStatus } from './ui.js';

export function resetApp() {
    // Reset state
    window.currentImageFile = null;
    window.currentGPS = null;
    if (window.map && window.marker) {
        window.map.removeLayer(window.marker);
        window.marker = null;
    }

    // Reset form
    const issueType = document.getElementById("issueType");
    const issueDesc = document.getElementById("issueDesc");
    if (issueType) issueType.value = "Pothole";
    if (issueDesc) issueDesc.value = "";
    const confirmImageCheck = document.getElementById("confirmImageCheck");
    if (confirmImageCheck) confirmImageCheck.checked = false;

    // Reset preview
    const previewImg = document.getElementById("preview");
    if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
    }

    // Re-show ALL hidden elements
    ['uploadOptions', 'locationInfo', 'gpsDetails'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty('display');
    });
    document.querySelectorAll('.form-group').forEach(el => el.style.removeProperty('display'));
    document.getElementById('map')?.style.removeProperty('display');
    document.getElementById('tweetBtnContainer')?.style.removeProperty('display');

    // Reset success screen
    const successScreen = document.getElementById("successScreen");
    if (successScreen) successScreen.style.display = "none";
    const tweetLinkContainer = document.getElementById('tweetLinkContainer');
    if (tweetLinkContainer) {
        tweetLinkContainer.innerHTML = '';
    }

    // Reset map view
    if (window.map) {
        window.map.setView([12.9716, 77.5946], 13);
        window.map.invalidateSize();
    }

    // Clear search
    const searchInput = document.getElementById('gbaSearch');
    const suggBox = document.getElementById('gbaSearchSuggestions');
    if (searchInput) searchInput.value = '';
    if (suggBox) {
        suggBox.innerHTML = '';
        suggBox.style.display = 'none';
    }

    // Reset tweet button
    if (window.tweetBtn) {
        window.tweetBtn.classList.remove("loading");
        window.tweetBtn.textContent = "🚨 Post Issue via @zenc_civic";
        window.tweetBtn.disabled = true;
    }

    showStatus("", "");
    showUploadOptions();
}
