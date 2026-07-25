// UI State Management - SINGLE showLocation
import { isValidNumber, isInGBA } from './utils.js';

let uploadOptions, previewImg, locationInfo, successScreen, statusDiv;
let imageInput, cameraInput, tweetBtn, infoBox, dropZone;
let imageConfirm, confirmImageCheck, changeImageBtn;

export function cacheUIElements() {
    uploadOptions = document.getElementById("uploadOptions");
    previewImg = document.getElementById("preview");
    locationInfo = document.getElementById("locationInfo");
    successScreen = document.getElementById("successScreen");
    statusDiv = document.getElementById("status");
    imageInput = document.getElementById("imageInput");
    cameraInput = document.getElementById("cameraInput");
    tweetBtn = document.getElementById("tweetBtn");
    infoBox = document.getElementById("infoBox");
    dropZone = document.getElementById("dropZone");
    imageConfirm = document.getElementById("imageConfirm");
    confirmImageCheck = document.getElementById("confirmImageCheck");
    changeImageBtn = document.getElementById("changeImageBtn");
    window.tweetBtn = tweetBtn;
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
        isValidNumber(window.currentGPS.lon) &&
        isInGBA(window.currentGPS.lat, window.currentGPS.lon));
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
    // Support both #status (main UI) and #statusMessage (heatmap page)
    const el = statusDiv || document.getElementById('statusMessage');
    if (!el) return;

    if (!msg) {
        toggleVisibility(el, false);
        el.innerHTML = "";
        el.classList.remove("status-error", "status-success", "status-info");
        return;
    }

    toggleVisibility(el, true);
    el.innerHTML = msg;
    el.classList.remove("status-error", "status-success", "status-info");

    if (type === "error") el.classList.add("status-error");
    else if (type === "success") el.classList.add("status-success");
    else el.classList.add("status-info");

    // Auto-hide after 5 seconds on heatmap page
    if (el.id === 'statusMessage') {
        clearTimeout(window._heatmapStatusTimeout);
        window._heatmapStatusTimeout = setTimeout(() => {
            toggleVisibility(el, false);
        }, 5000);
    }
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
    if (tweetBtn) tweetBtn.disabled = true;

    window.currentImageFile = null;
    window.currentGPS = null;
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


export function updateTweetButtonState() {
    const imageOk = !!window.currentImageFile;
    const gpsOk = hasValidGps();

    // ✅ PURE DOM - NO CACHED VARS
    const checkbox = document.getElementById("confirmImageCheck");
    const confirmed = !!(checkbox && checkbox.checked);

    const issueType = document.getElementById("issueType");
    const civicIssueSelected = !issueType || !!issueType.value;

    const shouldEnable = imageOk && gpsOk && confirmed && civicIssueSelected;

    // Update civic button (if present)
    const tweetBtn = document.getElementById("tweetBtn");
    if (tweetBtn) {
        tweetBtn.disabled = !shouldEnable;
        console.log("🔧 Civic button state:", { imageOk, gpsOk, confirmed, shouldEnable });
    }

    // Update traffic button (if present)
    const trafficBtn = document.getElementById("trafficSubmit");
    if (trafficBtn) {
        trafficBtn.disabled = !shouldEnable;
        console.log("🔧 Traffic button state:", { imageOk, gpsOk, confirmed, shouldEnable });
    }

    updateLocationHints();
}

// Alias for traffic flow compatibility
export function updateSubmitButtonState() {
    updateTweetButtonState();
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
