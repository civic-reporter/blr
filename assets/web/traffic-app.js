// Traffic Reporter App - mirrors civic-app.js structure
import { cacheUIElements, showUploadOptions, updateSubmitButtonState } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { submitTraffic } from './traffic-submission.js';
import { resetApp } from './reset.js';
import { blurFacesInImage } from '../js/face-blur.js';

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

    // Clear error message when issue type is selected
    const trafficCategory = document.getElementById("trafficCategory");
    if (trafficCategory) {
        trafficCategory.addEventListener("change", () => {
            const statusDiv = document.getElementById("status");
            if (statusDiv && statusDiv.textContent.includes("Please select a traffic issue type")) {
                statusDiv.style.display = "none";
                statusDiv.textContent = "";
            }
        });
    }

    // Wire buttons
    document.getElementById("cameraBtn")?.addEventListener("click", () =>
        document.getElementById("cameraInput").click());
    document.getElementById("uploadBtn")?.addEventListener("click", () =>
        document.getElementById("imageInput").click());

    document.getElementById("imageInput")?.addEventListener("change", e =>
        handleTrafficImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleTrafficCameraCapture(e.target.files[0]));

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

// Traffic-specific image handlers with face blurring
async function handleTrafficImageUpload(file) {
    await handleImageUpload(file);
    await blurAndUpdatePreview();
}

async function handleTrafficCameraCapture(file) {
    await handleCameraCapture(file);
    await blurAndUpdatePreview();
}

async function blurAndUpdatePreview() {
    if (!window.currentImageFile) return;

    const preview = document.getElementById("preview");
    if (!preview) return;

    // Show blurring status
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.textContent = "🔍 Blurring faces for privacy...";
        statusDiv.className = "status info";
        statusDiv.style.display = "block";
    }

    // Blur faces
    const blurredBlob = await blurFacesInImage(window.currentImageFile);
    window.currentImageFile = blurredBlob;

    // Update preview with blurred image
    const blurredUrl = URL.createObjectURL(blurredBlob);
    preview.src = blurredUrl;

    // Clear status after a moment
    setTimeout(() => {
        if (statusDiv && statusDiv.textContent.includes("Blurring")) {
            statusDiv.style.display = "none";
        }
    }, 2000);
}
