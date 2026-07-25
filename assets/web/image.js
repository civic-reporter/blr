import { extractGPSFromExif, extractGPSFromImageFile } from './gps.js';
import { compressImage, isValidNumber } from './utils.js';
import { showStatus, hideUploadOptions, showLocation, updateTweetButtonState } from './ui.js';
import { validateLocationForCoords } from './validation.js';

export async function handleImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    window.currentImageFile = file;
    const confirmCheck = document.getElementById("confirmImageCheck");
    if (confirmCheck) confirmCheck.checked = false;
    if (window.tweetBtn) window.tweetBtn.disabled = true;

    // Read GPS from the original gallery/file picker image before any re-encoding.
    await extractGPSFromImageFile(file);

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const preview = document.getElementById("preview");
            if (preview) {
                preview.src = e.target.result;
                preview.classList.remove("is-hidden");
            }

            if (!window.currentGPS) {
                await extractGPSFromExif(e.target.result);
            }

            if (window.currentGPS && isValidNumber(window.currentGPS.lat) && isValidNumber(window.currentGPS.lon)) {
                const valid = await validateLocationForCoords(window.currentGPS);
                if (!valid) {
                    window.currentGPS = null;
                    showStatus("❌ Photo GPS is outside GBA boundary. Use map to select location.", "error");
                }
            }

            showLocation();
            updateTweetButtonState();
            if (window.updateReportPreview) window.updateReportPreview();

            const compressedFile = await compressImage(file);
            window.currentImageFile = compressedFile;

            hideUploadOptions();
            const imageConfirm = document.getElementById("imageConfirm");
            if (imageConfirm) imageConfirm.classList.remove("is-hidden");

            resolve();
        };
        reader.readAsDataURL(file);
    });
}

export async function handleCameraCapture(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please capture a photo.", "error");
        return;
    }

    await handleImageUpload(file);
}
