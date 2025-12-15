import { extractGPSFromExif, getLiveGPSIfInGBA } from './gps.js';
import { compressImage } from './utils.js';
import { showStatus, hideUploadOptions, showLocation, updateTweetButtonState } from './ui.js';
import { isInGBA, isValidNumber } from './utils.js';

export async function handleImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    window.currentImageFile = file;
    if (document.getElementById("confirmImageCheck")) document.getElementById("confirmImageCheck").checked = false;
    if (window.tweetBtn) window.tweetBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (e) => {
        if (document.getElementById("preview")) {
            document.getElementById("preview").src = e.target.result;
            document.getElementById("preview").style.display = "block";
        }

        await extractGPSFromExif(e.target.result);

        const compressedFile = await compressImage(file);
        window.currentImageFile = compressedFile;

        hideUploadOptions();
        if (document.getElementById("imageConfirm")) document.getElementById("imageConfirm").style.display = "block";
    };
    reader.readAsDataURL(file);
}

export async function handleCameraCapture(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please capture a photo.", "error");
        return;
    }

    window.currentImageFile = file;
    if (document.getElementById("confirmImageCheck")) document.getElementById("confirmImageCheck").checked = false;
    if (window.tweetBtn) window.tweetBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = async (e) => {
        if (document.getElementById("preview")) {
            document.getElementById("preview").src = e.target.result;
            document.getElementById("preview").style.display = "block";
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
            } else {
                showLocation();
                showStatus("ℹ️ Set location using search or by tapping/dragging on the map.", "info");
                if (window.tweetBtn) window.tweetBtn.disabled = true;
            }
        }

        const compressedFile = await compressImage(file);
        window.currentImageFile = compressedFile;

        hideUploadOptions();
        if (document.getElementById("imageConfirm")) document.getElementById("imageConfirm").style.display = "block";
    };
    reader.readAsDataURL(file);
}
