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

export function showStatus(msg, type) {
    // Support both #status (main UI) and #statusMessage (heatmap page)
    const el = statusDiv || document.getElementById('statusMessage');
    if (!el) return;
    if (!msg) {
        el.style.display = "none";
        el.innerHTML = "";
        el.classList.remove("status-error", "status-success", "status-info");
        return;
    }
    el.style.display = "block";
    el.innerHTML = msg;
    el.classList.remove("status-error", "status-success", "status-info");
    if (type === "error") el.classList.add("status-error");
    else if (type === "success") el.classList.add("status-success");
    else el.classList.add("status-info");
    // Auto-hide after 5 seconds on heatmap page
    if (el.id === 'statusMessage') {
        clearTimeout(window._heatmapStatusTimeout);
        window._heatmapStatusTimeout = setTimeout(() => {
            el.style.display = "none";
        }, 5000);
    }
}

export function showUploadOptions() {
    if (uploadOptions) uploadOptions.style.display = "flex";
    if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
    }
    if (imageConfirm) imageConfirm.style.display = "none";
    if (locationInfo) locationInfo.style.display = "none";
    if (successScreen) successScreen.style.display = "none";
    if (statusDiv) statusDiv.innerHTML = "";
    if (tweetBtn) tweetBtn.disabled = true;
    window.currentImageFile = null;
    window.currentGPS = null;
}

export function showSuccessScreen() {
    if (locationInfo) locationInfo.style.display = "none";
    if (successScreen) successScreen.style.display = "block";
    if (previewImg) previewImg.style.display = "none";
    if (imageConfirm) imageConfirm.style.display = "none";
}

// ✅ SINGLE showLocation - WITH AUTO-MARKER
export function showLocation() {
    console.log("🎯🎯🎯 showLocation() CALLED 🎯🎯🎯");
    console.log("isTrafficFlow:", window.isTrafficFlow);

    if (locationInfo) locationInfo.style.display = "block";
    const mapRestr = document.getElementById("mapRestrictionMsg");
    if (mapRestr) mapRestr.style.display = "block";
    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.style.display = "block";

    // ✅ SHOW SEARCH BAR
    const searchWrapper = document.getElementById('gbaSearchWrapper');
    if (searchWrapper) {
        searchWrapper.style.display = 'block';
        console.log("🔍 Search bar shown");
    }

    // ✅ AUTO-MARKER FOR GPS PHOTOS + MOBILE
    if (window.currentGPS && window.map && typeof placeMarker === 'function') {
        setTimeout(() => {
            window.map.setView([window.currentGPS.lat, window.currentGPS.lon], 16);
            placeMarker();
            console.log("🎯 Auto-marker placed:", window.currentGPS.lat.toFixed(4));
        }, 100);
    }
}


export function updateTweetButtonState() {
    const imageOk = !!window.currentImageFile;
    const gpsOk = window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon) &&
        isInGBA(window.currentGPS.lat, window.currentGPS.lon);

    // ✅ PURE DOM - NO CACHED VARS
    const checkbox = document.getElementById("confirmImageCheck");
    const confirmed = !checkbox || checkbox.checked;

    const shouldEnable = imageOk && gpsOk && confirmed;

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
}

// Alias for traffic flow compatibility
export function updateSubmitButtonState() {
    updateTweetButtonState();
}




export function ensureLocationVisible() {
    const locationInfo = document.getElementById("locationInfo");
    if (locationInfo) locationInfo.style.display = "block";
}

export function showImageConfirm() {
    const imageConfirm = document.getElementById("imageConfirm");
    const locationInfo = document.getElementById("locationInfo");
    if (imageConfirm) {
        imageConfirm.style.display = "block";
        console.log("✅ imageConfirm SHOWN");
    }
    if (locationInfo) locationInfo.style.display = "block";
}

export function hideUploadOptions() {
    const uploadOptions = document.getElementById("uploadOptions");
    if (uploadOptions) uploadOptions.style.display = "none";
}
