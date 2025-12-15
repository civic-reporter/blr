// Main app
import { cacheUIElements, showUploadOptions } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { shareToGBA } from './twitter.js';
import { resetApp } from './reset.js';

// Global state
window.currentImageFile = null;
window.currentGPS = null;

document.addEventListener("DOMContentLoaded", () => {
    cacheUIElements();
    const checkbox = document.getElementById("confirmImageCheck");
    if (checkbox) {
        checkbox.addEventListener("change", updateTweetButtonState);
        console.log("✅ Checkbox listener added");
    }

    // Wire ALL buttons + drop
    document.getElementById("cameraBtn")?.addEventListener("click", () =>
        document.getElementById("cameraInput").click());
    document.getElementById("uploadBtn")?.addEventListener("click", () =>
        document.getElementById("imageInput").click());

    document.getElementById("imageInput")?.addEventListener("change", e =>
        handleImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleCameraCapture(e.target.files[0]));
    document.getElementById("tweetBtn")?.addEventListener("click", shareToGBA);
    document.getElementById("submitAnotherBtn")?.addEventListener("click", resetApp);
    document.getElementById("changeImageBtn")?.addEventListener("click", resetApp);

    // Drop zone
    const dropZone = document.getElementById("dropZone");
    if (dropZone) {
        dropZone.addEventListener("dragover", e => {
            e.preventDefault(); dropZone.classList.add("dragover");
        });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
        dropZone.addEventListener("drop", e => {
            e.preventDefault(); dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files[0]);
        });
    }

    initMap();
    showUploadOptions();
});
