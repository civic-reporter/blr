import { extractGPSFromImageFile, getLiveGPSIfInGBA, resetGpsSource } from './gps.js';
import { compressImage, isValidNumber } from './utils.js';
import { showStatus, hideUploadOptions, showLocation, updateSubmitButtonState, showImageConfirm, updateLocationConfirmVisibility } from './ui.js';
import { validateLocationForCoords } from './validation.js';

function isSupportedImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;

    const name = (file.name || '').toLowerCase();
    return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
}

function needsGps() {
    return !window.currentGPS ||
        !isValidNumber(window.currentGPS.lat) ||
        !isValidNumber(window.currentGPS.lon);
}

async function tryLiveGpsFallback() {
    const liveGPS = await getLiveGPSIfInGBA();
    if (!liveGPS) return;

    if (await validateLocationForCoords(liveGPS)) {
        window.currentGPS = liveGPS;
        window.gpsFromPhotoExif = false;
        window.gpsManuallySet = false;
    } else {
        window.currentGPS = null;
        showStatus("❌ Live GPS outside GBA boundary", "error");
    }
}

function readPreviewDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

async function processSelectedImage(file, { useLiveGpsFallback = false } = {}) {
    window.currentImageFile = file;
    window.currentGPS = null;
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = false;
    resetGpsSource();

    const confirmCheck = document.getElementById("confirmImageCheck");
    const locationConfirmCheck = document.getElementById("confirmLocationCheck");
    if (confirmCheck) confirmCheck.checked = false;
    if (locationConfirmCheck) locationConfirmCheck.checked = false;
    if (window.submitBtn) window.submitBtn.disabled = true;

    await extractGPSFromImageFile(file);

    const dataUrl = await readPreviewDataUrl(file);
    const preview = document.getElementById("preview");
    if (preview && dataUrl) {
        preview.src = dataUrl;
        preview.classList.remove("is-hidden");
    }

    if (useLiveGpsFallback && needsGps()) {
        await tryLiveGpsFallback();
    }

    if (window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon) &&
        !window.gpsFromPhotoExif) {
        const valid = await validateLocationForCoords(window.currentGPS);
        if (!valid) {
            window.currentGPS = null;
            showStatus("❌ Location is outside GBA boundary. Use map to select location.", "error");
            updateLocationConfirmVisibility();
        }
    }

    showLocation();
    updateSubmitButtonState();
    updateLocationConfirmVisibility();
    if (window.updateReportPreview) window.updateReportPreview();

    window.currentImageFile = await compressImage(file);

    hideUploadOptions();
    showImageConfirm();
    const imageConfirm = document.getElementById("imageConfirm");
    if (imageConfirm) imageConfirm.classList.remove("is-hidden");
}

export async function handleImageUpload(file, options = {}) {
    if (!isSupportedImageFile(file)) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    await processSelectedImage(file, options);
}

export async function handleCameraCapture(file, options = {}) {
    if (!isSupportedImageFile(file)) {
        showStatus("❌ Please capture a photo.", "error");
        return;
    }

    await processSelectedImage(file, options);
}
