// UI State Management - SINGLE showLocation
import { isValidNumber } from './utils.js';

let uploadOptions, previewImg, locationInfo, successScreen, statusDiv;
let imageInput, cameraInput, submitBtn, infoBox, dropZone;
let imageConfirm, confirmImageCheck, changeImageBtn;

export function cacheUIElements() {
    uploadOptions = document.getElementById("uploadOptions");
    previewImg = document.getElementById("preview");
    locationInfo = document.getElementById("locationInfo");
    successScreen = document.getElementById("successScreen");
    statusDiv = document.getElementById("status");
    imageInput = document.getElementById("imageInput");
    cameraInput = document.getElementById("cameraInput");
    submitBtn = document.getElementById("submitBtn");
    infoBox = document.getElementById("infoBox");
    dropZone = document.getElementById("dropZone");
    imageConfirm = document.getElementById("imageConfirm");
    confirmImageCheck = document.getElementById("confirmImageCheck");
    changeImageBtn = document.getElementById("changeImageBtn");
    window.submitBtn = submitBtn;
}

// Helper to toggle visibility using classes
function toggleVisibility(element, isVisible, displayClass = 'is-visible') {
    if (!element) return;
    // Clear inline display style to let classes take over
    element.style.display = '';

    if (isVisible) {
        element.classList.remove('is-hidden');
        element.classList.add(displayClass);
    } else {
        element.classList.add('is-hidden');
        element.classList.remove('is-visible', 'is-flex');
    }
}

function hasValidGps() {
    return !!(window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon));
}

function needsLocationConfirm() {
    return !!(window.currentImageFile && hasValidGps() && window.gpsManuallySet);
}

export function updateLocationConfirmVisibility() {
    const locationConfirm = document.getElementById("locationConfirm");
    const confirmLocationCheck = document.getElementById("confirmLocationCheck");
    const show = needsLocationConfirm();

    toggleVisibility(locationConfirm, show);
    if (!show && confirmLocationCheck) confirmLocationCheck.checked = false;
}

function updateLocationHints() {
    const dragHint = document.getElementById("dragMarkerHint");
    toggleVisibility(dragHint, !hasValidGps());

    const gpsCoordsEl = document.getElementById("gpsCoords");
    if (gpsCoordsEl && !hasValidGps() && !gpsCoordsEl.textContent.trim()) {
        gpsCoordsEl.textContent = "Not selected yet";
    }
}

export function showStatus(msg, type) {
    const el = statusDiv || document.getElementById('statusMessage');
    if (!el) return;

    if (!msg) {
        toggleVisibility(el, false);
        el.innerHTML = "";
        el.classList.remove("status-error", "status-success", "status-info", "is-visible", "info", "success", "error");
        return;
    }

    toggleVisibility(el, true);
    el.innerHTML = msg;

    if (el.id === 'statusMessage') {
        el.className = `heatmap-status-message is-visible ${type || 'info'}`;
        clearTimeout(window._heatmapStatusTimeout);
        window._heatmapStatusTimeout = setTimeout(() => {
            el.classList.remove('is-visible');
        }, 5000);
        return;
    }

    el.classList.remove("status-error", "status-success", "status-info");

    if (type === "error") el.classList.add("status-error");
    else if (type === "success") el.classList.add("status-success");
    else el.classList.add("status-info");
}

export function showUploadOptions() {
    toggleVisibility(uploadOptions, true, 'is-flex');

    if (previewImg) {
        previewImg.src = "";
        toggleVisibility(previewImg, false);
    }

    toggleVisibility(imageConfirm, false);
    toggleVisibility(locationInfo, false);
    toggleVisibility(successScreen, false);

    if (statusDiv) statusDiv.innerHTML = "";
    if (submitBtn) submitBtn.disabled = true;

    window.currentImageFile = null;
    window.currentGPS = null;
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = false;
}

export function showSuccessScreen() {
    toggleVisibility(locationInfo, false);
    toggleVisibility(successScreen, true);
    toggleVisibility(previewImg, false);
    toggleVisibility(imageConfirm, false);
}

// ✅ SINGLE showLocation - WITH AUTO-MARKER
export function showLocation() {
    console.log("🎯🎯🎯 showLocation() CALLED 🎯🎯🎯");
    console.log("isTrafficFlow:", window.isTrafficFlow);

    toggleVisibility(locationInfo, true);

    const mapRestr = document.getElementById("mapRestrictionMsg");
    toggleVisibility(mapRestr, false);

    const mapEl = document.getElementById("map");
    toggleVisibility(mapEl, true);

    updateLocationHints();

    // ✅ SHOW SEARCH BAR
    const searchWrapper = document.getElementById('gbaSearchWrapper');
    if (searchWrapper) {
        toggleVisibility(searchWrapper, true);
        console.log("🔍 Search bar shown");
    }

    // ✅ AUTO-MARKER FOR GPS PHOTOS + MOBILE
    if (window.currentGPS && window.map && typeof placeMarker === 'function') {
        setTimeout(() => {
            window.map.setView([window.currentGPS.lat, window.currentGPS.lon], 16);
            placeMarker();
            console.log("🎯 Auto-marker placed:", window.currentGPS.lat.toFixed(4));
            if (window.updateReportPreview) window.updateReportPreview();
            if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
        }, 100);
    } else if (window.updateReportPreview) {
        window.updateReportPreview();
        if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
    }
}


export function updateSubmitButtonState() {
    const imageOk = !!window.currentImageFile;
    const gpsOk = hasValidGps();

    const photoCheckbox = document.getElementById("confirmImageCheck");
    const photoConfirmed = !!(photoCheckbox && photoCheckbox.checked);

    const locationCheckbox = document.getElementById("confirmLocationCheck");
    const locationConfirmRequired = needsLocationConfirm();
    const locationConfirmed = !locationConfirmRequired ||
        !!(locationCheckbox && locationCheckbox.checked);

    updateLocationConfirmVisibility();

    const issueType = document.getElementById("issueType");
    const civicIssueSelected = !issueType || !!issueType.value;

    const issueDesc = document.getElementById("issueDesc");
    const issueDescOk = !!(issueDesc && issueDesc.value.trim());

    const shouldEnable = imageOk && gpsOk && photoConfirmed && locationConfirmed &&
        civicIssueSelected && issueDescOk;

    // Update civic button (if present)
    const civicSubmitBtn = document.getElementById("submitBtn");
    if (civicSubmitBtn) {
        civicSubmitBtn.disabled = !shouldEnable;
        console.log("🔧 Civic button state:", {
            imageOk, gpsOk, photoConfirmed, locationConfirmed, issueDescOk, shouldEnable
        });
    }

    // Update traffic button (if present)
    const trafficBtn = document.getElementById("trafficSubmit");
    if (trafficBtn) {
        trafficBtn.disabled = !shouldEnable;
        console.log("🔧 Traffic button state:", {
            imageOk, gpsOk, photoConfirmed, locationConfirmed, shouldEnable
        });
    }

    updateLocationHints();
}

export function ensureLocationVisible() {
    const locationInfo = document.getElementById("locationInfo");
    toggleVisibility(locationInfo, true);
}

export function showImageConfirm() {
    const imageConfirm = document.getElementById("imageConfirm");
    const locationInfo = document.getElementById("locationInfo");

    if (imageConfirm) {
        toggleVisibility(imageConfirm, true);
        console.log("✅ imageConfirm SHOWN");
    }
    toggleVisibility(locationInfo, true);
}

export function hideUploadOptions() {
    const uploadOptions = document.getElementById("uploadOptions");
    toggleVisibility(uploadOptions, false);
}
