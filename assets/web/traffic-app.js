// Traffic Reporter App - mirrors civic-app.js structure
import { cacheUIElements, showUploadOptions, updateSubmitButtonState } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { submitTraffic } from './traffic-submission.js';
import { resetApp } from './reset.js';

// Global state for traffic reports
window.currentImageFile = null;
window.currentGPS = null;
window.isTrafficFlow = true; // Flag to differentiate from civic flow

document.addEventListener("DOMContentLoaded", () => {
    cacheUIElements();

    // Traffic-specific: confirm checkbox listener
    const checkbox = document.getElementById("confirmImageCheck");
    if (checkbox) {
        checkbox.addEventListener("change", updateSubmitButtonState);
        console.log("✅ Traffic: Checkbox listener added");
    }

    // Wire buttons
    document.getElementById("cameraBtn")?.addEventListener("click", () =>
        document.getElementById("cameraInput").click());
    document.getElementById("uploadBtn")?.addEventListener("click", () =>
        document.getElementById("imageInput").click());

    document.getElementById("imageInput")?.addEventListener("change", e =>
        handleImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleCameraCapture(e.target.files[0]));

    // Traffic submit button (different ID from civic)
    document.getElementById("trafficSubmit")?.addEventListener("click", submitTraffic);
    document.getElementById("submitAnotherBtn")?.addEventListener("click", resetApp);
    document.getElementById("changeImageBtn")?.addEventListener("click", resetApp);

    // Drop zone
    const dropZone = document.getElementById("dropZone");
    if (dropZone) {
        dropZone.addEventListener("dragover", e => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
        dropZone.addEventListener("drop", e => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) handleImageUpload(e.dataTransfer.files[0]);
        });
    }

    initMap();
    showUploadOptions();
});
