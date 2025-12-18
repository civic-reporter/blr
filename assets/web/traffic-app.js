// Traffic Reporter App - mirrors civic-app.js structure
console.log('📦 traffic-app.js loading...');
import { cacheUIElements, showUploadOptions, updateSubmitButtonState } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { submitTraffic } from './traffic-submission.js';
import { resetApp } from './reset.js';
import { blurFacesInImage } from '../js/face-blur.js';

console.log('✅ traffic-app.js imports loaded');

// Global state for traffic reports
window.currentImageFile = null;
window.currentGPS = null;
window.isTrafficFlow = true; // Flag to differentiate from civic flow

console.log('📋 Document ready state:', document.readyState);

// Function to initialize the app
function initApp() {
    console.log('🚀 Traffic app initializing...');
    cacheUIElements();

    // Traffic-specific: confirm checkbox listener
    const checkbox = document.getElementById("confirmImageCheck");
    if (checkbox) {
        checkbox.addEventListener("change", updateSubmitButtonState);
        console.log("✅ Traffic: Checkbox listener added");
    }


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

    document.getElementById("cameraBtn")?.addEventListener("click", () =>
        document.getElementById("cameraInput").click());
    document.getElementById("uploadBtn")?.addEventListener("click", () =>
        document.getElementById("imageInput").click());

    document.getElementById("imageInput")?.addEventListener("change", e =>
        handleTrafficImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleTrafficCameraCapture(e.target.files[0]));

    document.getElementById("trafficSubmit")?.addEventListener("click", submitTraffic);
    document.getElementById("submitAnotherBtn")?.addEventListener("click", resetApp);
    document.getElementById("changeImageBtn")?.addEventListener("click", resetApp);

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

    console.log('🗺️ Calling initMap()...');
    initMap();
    console.log('📤 Calling showUploadOptions()...');
    showUploadOptions();
    console.log('✅ Traffic app initialization complete');
}

if (document.readyState === 'loading') {
    console.log('⏳ Waiting for DOMContentLoaded...');
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    console.log('✅ DOM already loaded, initializing immediately');
    initApp();
}

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

    const blurStatusDiv = document.getElementById("blurStatus");
    if (blurStatusDiv) {
        blurStatusDiv.textContent = "🔍 Blurring faces for privacy...";
        blurStatusDiv.className = "blur-status";
        blurStatusDiv.style.display = "block";
    }

    const blurredBlob = await blurFacesInImage(window.currentImageFile);
    window.currentImageFile = blurredBlob;

    const blurredUrl = URL.createObjectURL(blurredBlob);
    preview.src = blurredUrl;

    if (blurStatusDiv) {
        blurStatusDiv.textContent = "✅ Privacy protection applied";
        setTimeout(() => {
            blurStatusDiv.style.display = "none";
        }, 2000);
    }
}
