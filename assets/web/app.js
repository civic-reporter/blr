console.log('📦 app.js loading...');
import { cacheUIElements, showUploadOptions, showStatus, updateTweetButtonState } from './ui.js';
import { initMap } from './map.js';
import { handleImageUpload, handleCameraCapture } from './image.js';
import { shareToGBA, saveCivicDraft, restoreCivicDraft } from './twitter.js';
import { resetApp } from './reset.js';
import { initEmailModule, isValidEmail } from './email-authorities.js';
import { updateCivicEmailRecipients, displaySuccessLocationInfo, prepareCivicEmailData } from './civic-email.js';
import { updateReportPreview } from './civic-preview.js';
import { updateCivicWhatsAppOption, renderWhatsAppSuccess } from './civic-whatsapp.js';
import { blurFacesInImage } from '../js/face-blur.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

console.log('✅ app.js imports loaded');

window.currentImageFile = null;
window.currentGPS = null;
window.isCivicFlow = true;

console.log('📋 Document ready state:', document.readyState);

async function blurAndUpdatePreview() {
    if (!window.currentImageFile) return;

    const preview = document.getElementById("preview");
    if (!preview) return;

    const lang = getCurrentLanguage();
    const blurStatusDiv = document.getElementById("blurStatus");
    if (blurStatusDiv) {
        blurStatusDiv.textContent = t('detectingFaces', lang);
        blurStatusDiv.className = "blur-status";
        blurStatusDiv.classList.remove('is-hidden');
        blurStatusDiv.style.display = "block";
    }

    const blurredBlob = await blurFacesInImage(window.currentImageFile);
    window.currentImageFile = blurredBlob;

    const blurredUrl = URL.createObjectURL(blurredBlob);
    preview.src = blurredUrl;

    if (blurStatusDiv) {
        blurStatusDiv.textContent = t('privacyProtected', lang);
        setTimeout(() => {
            blurStatusDiv.style.display = "none";
            blurStatusDiv.classList.add('is-hidden');
        }, 2000);
    }
}

async function handleCivicImageUpload(file) {
    await handleImageUpload(file);
    await blurAndUpdatePreview();
}

function openPhotoPicker() {
    const input = document.getElementById("imageInput");
    if (!input) return;
    input.value = '';
    input.click();
}

function openCameraCapture() {
    const input = document.getElementById("cameraInput");
    if (!input) return;
    input.value = '';
    input.click();
}

async function handleCivicCameraCapture(file) {
    await handleCameraCapture(file);
    await blurAndUpdatePreview();
}

function initApp() {
    console.log('🚀 Civic app initializing...');
    cacheUIElements();

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
                userEmailInput.classList.remove('is-hidden');
                userEmailInput.focus();
            } else {
                userEmailInput.classList.add('is-hidden');
                userEmailInput.value = '';
                const validationMsg = document.getElementById('emailValidationMsg');
                if (validationMsg) validationMsg.classList.add('is-hidden');
            }
        });
        console.log("✅ CC checkbox listener added");
    }

    const issueDesc = document.getElementById("issueDesc");
    const issueDescCount = document.getElementById("issueDescCount");
    if (issueDesc && issueDescCount) {
        issueDesc.addEventListener("input", () => {
            const len = issueDesc.value.length;
            issueDescCount.textContent = `${len} / 120`;
            issueDescCount.classList.toggle("char-count-warn", len > 100);
            saveCivicDraft();
        });
    }

    const issueType = document.getElementById("issueType");
    if (issueType) {
        issueType.addEventListener("change", () => {
            const statusDiv = document.getElementById("status");
            if (statusDiv && statusDiv.textContent.includes("Please select an issue type")) {
                statusDiv.style.display = "none";
                statusDiv.textContent = "";
            }
            saveCivicDraft();
            updateTweetButtonState();
        });
    }

    document.getElementById("uploadBtn")?.addEventListener("click", openPhotoPicker);
    document.getElementById("cameraBtn")?.addEventListener("click", openCameraCapture);

    document.getElementById("imageInput")?.addEventListener("change", e =>
        handleCivicImageUpload(e.target.files[0]));
    document.getElementById("cameraInput")?.addEventListener("change", e =>
        handleCivicCameraCapture(e.target.files[0]));
    document.getElementById("tweetBtn")?.addEventListener("click", shareToGBA);
    document.getElementById("submitAnotherBtn")?.addEventListener("click", resetApp);
    document.getElementById("changeImageBtn")?.addEventListener("click", openPhotoPicker);

    const dropZone = document.getElementById("uploadOptions");
    if (dropZone) {
        dropZone.addEventListener("dragover", e => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });
        dropZone.addEventListener("dragleave", e => {
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove("dragover");
            }
        });
        dropZone.addEventListener("drop", e => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) {
                handleCivicImageUpload(e.dataTransfer.files[0]);
            }
        });
    }

    window.addEventListener('online', () => {
        const statusDiv = document.getElementById('status');
        if (statusDiv?.classList.contains('status-error') &&
            statusDiv.textContent.includes(t('offlineError', getCurrentLanguage()))) {
            showStatus(t('backOnline', getCurrentLanguage()), 'success');
        }
    });

    window.addEventListener('offline', () => {
        if (window.currentImageFile) {
            saveCivicDraft();
        }
    });

    console.log('🗺️ Calling initMap()...');
    initMap();
    console.log('📤 Calling showUploadOptions()...');
    showUploadOptions();

    if (restoreCivicDraft()) {
        const lang = getCurrentLanguage();
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = t('draftRestored', lang);
            statusDiv.className = 'status-info';
            statusDiv.classList.remove('is-hidden');
        }
    }

    window.updateCivicEmailRecipients = updateCivicEmailRecipients;
    window.displaySuccessLocationInfo = displaySuccessLocationInfo;
    window.prepareCivicEmailData = prepareCivicEmailData;
    window.updateReportPreview = updateReportPreview;
    window.updateCivicWhatsAppOption = updateCivicWhatsAppOption;
    window.renderWhatsAppSuccess = renderWhatsAppSuccess;

    console.log('✅ Civic app initialization complete');
}

if (document.readyState === 'loading') {
    console.log('⏳ Waiting for DOMContentLoaded...');
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    console.log('✅ DOM already loaded, initializing immediately');
    initApp();
}
