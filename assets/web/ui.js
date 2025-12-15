// UI State Management - NO DUPLICATES
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
    if (!statusDiv) return;
    if (!msg) {
        statusDiv.style.display = "none";
        statusDiv.innerHTML = "";
        statusDiv.classList.remove("status-error", "status-success", "status-info");
        return;
    }
    statusDiv.style.display = "block";
    statusDiv.innerHTML = msg;
    statusDiv.classList.remove("status-error", "status-success", "status-info");
    if (type === "error") statusDiv.classList.add("status-error");
    else if (type === "success") statusDiv.classList.add("status-success");
    else statusDiv.classList.add("status-info");
}

export function showUploadOptions() {
    if (uploadOptions) uploadOptions.style.display = "flex";
    if (previewImg) {
        previewImg.src = ""; previewImg.style.display = "none";
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
}

export function showLocation() {
    if (locationInfo) locationInfo.style.display = "block";
    const mapRestr = document.getElementById("mapRestrictionMsg");
    if (mapRestr) mapRestr.style.display = "block";
    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.style.display = "block";
}

export function updateTweetButtonState() {
    const imageOk = !!window.currentImageFile;
    const gpsOk = window.currentGPS &&
        isValidNumber(window.currentGPS.lat) &&
        isValidNumber(window.currentGPS.lon) &&
        isInGBA(window.currentGPS.lat, window.currentGPS.lon);
    let confirmed = true;
    if (confirmImageCheck) confirmed = !!confirmImageCheck.checked;
    if (tweetBtn) tweetBtn.disabled = !(imageOk && gpsOk && confirmed);
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

// ✅ SINGLE hideUploadOptions - NO DUPLICATE
export function hideUploadOptions() {
    const uploadOptions = document.getElementById("uploadOptions");
    if (uploadOptions) {
        uploadOptions.style.display = "none";
        console.log("✅ uploadOptions HIDDEN");
    }
}
