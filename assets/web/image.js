import { extractGPSFromExif, extractGPSFromImageFile, getLiveGPSIfInGBA } from './gps.js';
import { compressImage, isValidNumber } from './utils.js';
import { showStatus, hideUploadOptions, showLocation, updateSubmitButtonState, showImageConfirm, updateLocationConfirmVisibility } from './ui.js';
import { validateLocationForCoords } from './validation.js';

async function processSelectedImage(file, { preferExif = true } = {}) {
    window.currentImageFile = file;
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = false;
    const confirmCheck = document.getElementById("confirmImageCheck");
    const locationConfirmCheck = document.getElementById("confirmLocationCheck");
    if (confirmCheck) confirmCheck.checked = false;
    if (locationConfirmCheck) locationConfirmCheck.checked = false;
    if (window.submitBtn) window.submitBtn.disabled = true;

    if (preferExif) {
        await extractGPSFromImageFile(file);
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const preview = document.getElementById("preview");
            if (preview) {
                preview.src = e.target.result;
                preview.classList.remove("is-hidden");
            }

            if (preferExif && !window.currentGPS) {
                await extractGPSFromExif(e.target.result);
            }

            if (window.currentGPS && isValidNumber(window.currentGPS.lat) && isValidNumber(window.currentGPS.lon)) {
                const valid = await validateLocationForCoords(window.currentGPS);
                if (!valid) {
                    window.currentGPS = null;
                    window.gpsFromPhotoExif = false;
                    showStatus("❌ Photo GPS is outside GBA boundary. Use map to select location.", "error");
                    updateLocationConfirmVisibility();
                }
            }

            showLocation();
            updateSubmitButtonState();
            updateLocationConfirmVisibility();
            if (window.updateReportPreview) window.updateReportPreview();

            const compressedFile = await compressImage(file);
            window.currentImageFile = compressedFile;

            hideUploadOptions();
            showImageConfirm();
            const imageConfirm = document.getElementById("imageConfirm");
            if (imageConfirm) imageConfirm.classList.remove("is-hidden");

            resolve();
        };
        reader.readAsDataURL(file);
    });
}

export async function handleImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    await processSelectedImage(file, { preferExif: true });
}

export async function handleCameraCapture(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please capture a photo.", "error");
        return;
    }

    await extractGPSFromImageFile(file);

    const needsGPS = !window.currentGPS ||
        !isValidNumber(window.currentGPS.lat) ||
        !isValidNumber(window.currentGPS.lon);

    if (needsGPS) {
        const liveGPS = await getLiveGPSIfInGBA();
        if (liveGPS) {
            const valid = await validateLocationForCoords(liveGPS);
            if (valid) {
                window.currentGPS = liveGPS;
                window.gpsFromPhotoExif = false;
                window.gpsManuallySet = false;
                showStatus(`✅ Live GPS: ${liveGPS.lat.toFixed(4)}, ${liveGPS.lon.toFixed(4)}`, "success");
            } else {
                window.currentGPS = null;
                showStatus("❌ Live GPS outside GBA boundary", "error");
            }
        } else {
            showStatus("ℹ️ No valid GPS. Use map/search.", "info");
        }
    }

    await processSelectedImage(file, { preferExif: false });
}
