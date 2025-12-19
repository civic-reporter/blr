console.log('📦 app.js loading...');
import { cacheUIElements, showUploadOptions, updateTweetButtonState } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { shareToGBA } from './twitter.js';
import { resetApp } from './reset.js';
import { initEmailModule, isValidEmail } from './email-authorities.js';
import { updateCivicEmailRecipients, displaySuccessLocationInfo, prepareCivicEmailData } from './civic-email.js';

console.log('✅ app.js imports loaded');

window.currentImageFile = null;
window.currentGPS = null;
window.isCivicFlow = true; // Flag to differentiate from traffic flow

console.log('📋 Document ready state:', document.readyState);

function initApp() {
    console.log('🚀 Civic app initializing...');
    cacheUIElements();

    // Initialize email module
    initEmailModule().then(success => {
        if (success) {
            console.log('✅ Email module initialized');
        } else {
            console.log('⚠️ Email module not available');
        }
    });

    const checkbox = document.getElementById("confirmImageCheck");
    if (checkbox) {
        checkbox.addEventListener("change", updateTweetButtonState);
        console.log("✅ Checkbox listener added");
    }

    // Email checkbox listeners
    const emailCheckbox = document.getElementById("emailAuthoritiesCheck");
    if (emailCheckbox) {
        emailCheckbox.addEventListener("change", () => {
            if (window.updateCivicEmailRecipients) {
                window.updateCivicEmailRecipients();
            }
        });
        console.log("✅ Email checkbox listener added");
    }

    const ccCheckbox = document.getElementById("ccMeCheck");
    const userEmailInput = document.getElementById("userEmailInput");
    if (ccCheckbox && userEmailInput) {
        ccCheckbox.addEventListener("change", () => {
            if (ccCheckbox.checked) {
                userEmailInput.style.display = 'block';
                userEmailInput.focus();
            } else {
                userEmailInput.style.display = 'none';
                userEmailInput.value = '';
                const validationMsg = document.getElementById('emailValidationMsg');
                if (validationMsg) validationMsg.style.display = 'none';
            }
        });
        console.log("✅ CC checkbox listener added");
    }

    const issueType = document.getElementById("issueType");
    if (issueType) {
        issueType.addEventListener("change", () => {
            const statusDiv = document.getElementById("status");
            if (statusDiv && statusDiv.textContent.includes("Please select an issue type")) {
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
        handleImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleCameraCapture(e.target.files[0]));
    document.getElementById("tweetBtn")?.addEventListener("click", shareToGBA);
    document.getElementById("submitAnotherBtn")?.addEventListener("click", resetApp);
    document.getElementById("changeImageBtn")?.addEventListener("click", resetApp);

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

    console.log('🗺️ Calling initMap()...');
    initMap();
    console.log('📤 Calling showUploadOptions()...');
    showUploadOptions();

    // Make functions available globally for gps.js, map.js, and twitter.js
    window.updateCivicEmailRecipients = updateCivicEmailRecipients;
    window.displaySuccessLocationInfo = displaySuccessLocationInfo;
    window.prepareCivicEmailData = prepareCivicEmailData;
    console.log('📧 window.updateCivicEmailRecipients assigned:', typeof window.updateCivicEmailRecipients);
    console.log('📍 window.displaySuccessLocationInfo assigned:', typeof window.displaySuccessLocationInfo);
    console.log('📧 window.prepareCivicEmailData assigned:', typeof window.prepareCivicEmailData);

    console.log('✅ Civic app initialization complete');
}

if (document.readyState === 'loading') {
    console.log('⏳ Waiting for DOMContentLoaded...');
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    console.log('✅ DOM already loaded, initializing immediately');
    initApp();
}
