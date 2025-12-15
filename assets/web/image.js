import { extractGPSFromExif, getLiveGPSIfInGBA } from './gps.js';
import { compressImage, isInGBA, isValidNumber } from './utils.js';
import { showStatus, hideUploadOptions, showLocation, updateTweetButtonState } from './ui.js';

export async function handleImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    window.currentImageFile = file;
    const confirmCheck = document.getElementById("confirmImageCheck");
    if (confirmCheck) confirmCheck.checked = false;
    if (window.tweetBtn) window.tweetBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const preview = document.getElementById("preview");
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = "block";
        }

        // ✅ GPS FIRST
        await extractGPSFromExif(e.target.result);
        // ✅ FORCE MAP + MARKER
        showLocation();  // Triggers auto-marker from ui.js
        updateTweetButtonState();

        // ✅ Compress AFTER GPS
        const compressedFile = await compressImage(file);
        window.currentImageFile = compressedFile;

        // ✅ CRITICAL: Show imageConfirm for ALL (mobile + upload)
        hideUploadOptions();
        const imageConfirm = document.getElementById("imageConfirm");
        if (imageConfirm) imageConfirm.style.display = "block";
    };
    reader.readAsDataURL(file);
}

export async function handleCameraCapture(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please capture a photo.", "error");
        return;
    }

    window.currentImageFile = file;
    const confirmCheck = document.getElementById("confirmImageCheck");
    if (confirmCheck) confirmCheck.checked = false;
    if (window.tweetBtn) window.tweetBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const preview = document.getElementById("preview");
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = "block";
        }

        await extractGPSFromExif(e.target.result);

        const needsGPS = !window.currentGPS || !isValidNumber(window.currentGPS.lat) ||
            !isValidNumber(window.currentGPS.lon) || !isInGBA(window.currentGPS.lat, window.currentGPS.lon);

        if (needsGPS) {
            const liveGPS = await getLiveGPSIfInGBA();
            if (liveGPS) {
                window.currentGPS = liveGPS;
                showStatus(`✅ Live GPS: ${liveGPS.lat.toFixed(4)}, ${liveGPS.lon.toFixed(4)}`, "success");
                showLocation();
                updateTweetButtonState();
            }
        }

        const compressedFile = await compressImage(file);
        window.currentImageFile = compressedFile;

        // ✅ CRITICAL: Show imageConfirm for camera TOO
        hideUploadOptions();
        const imageConfirm = document.getElementById("imageConfirm");
        if (imageConfirm) imageConfirm.style.display = "block";
    };
    reader.readAsDataURL(file);
}
