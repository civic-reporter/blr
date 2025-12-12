// app.js — GBA Civic Reporter (fixed structure)

// Configuration
const API_GATEWAY_URL = "https://c543fafez6.execute-api.ap-south-1.amazonaws.com/zenc";
const MAP_KML_URL = "assets/data/map.kml";
const CONST_KML_URL = "assets/data/blr_const.kml";
const WARD_KML_URL = "assets/data/wards.kml";

let currentImageFile = null;
let currentGPS = null;
let map, marker;
let corpPolygons = null;
let constPolygons = null;
let wardPolygons = null;
let mapInitialized = false;

// Constituency → MLA handle
const MLA_HANDLES = {
    "Yeshwanthpur": "STSomashekarMLA",
    "Yelahanka": "SRVishwanathBJP",
    "Vijayanagara": "MLAHRGaviyappa",
    "Shivajinagar": "ArshadRizwan",
    "Shantinagar": "mlanaharis",
    "Sarvagnanagar": "thekjgeorge",
    "Rajarajeshwarinagar": "MunirathnaMLA",
    "Rajajinagar": "nimmasuresh",
    "Pulakeshinagar": "",
    "Padmanabhanagar": "RAshokaBJP",
    "Malleshwaram": "drashwathcn",
    "Mahalakshmi Layout": "GopalaiahK",
    "Mahadevapura": "MALimbavali",
    "Krishnarajapuram": "BABasavaraja",
    "Jayanagar": "CKRBJP",
    "Hoskote": "SBG4Hosakote",
    "Hebbal": "byrathi_suresh",
    "Govindaraja Nagar": "Priyakrishna_K",
    "Gandhinagar": "dineshgrao",
    "Dasarahalli": "munirajusbjp",
    "Chickpet": "BGUdayBJP",
    "Chamrajpet": "BZZameerAhmedK",
    "C. V. Raman Nagar": "SRaghuMLA",
    "Byatarayanapura": "krishnabgowda",
    "Bommanahalli": "msrbommanahalli",
    "Basavanagudi": "Ravi_LA",
    "Vijayanagar": "mkrishnappa_MLA",
    "BTM Layout": "RLR_BTM",
    "Anekal (SC)": "MLAShivanna"
};

const GBA_BBOX = {
    south: 12.82, north: 13.20,
    west: 77.40, east: 77.85
};

// Global UI references (set on DOMContentLoaded)
let uploadOptions, previewImg, locationInfo, successScreen, statusDiv;
let imageInput, cameraInput, tweetBtn, infoBox, dropZone;
let imageConfirm, confirmImageCheck, changeImageBtn;

// --- Basic helpers ---

function isInGBA(lat, lon) {
    return GBA_BBOX.south <= lat && lat <= GBA_BBOX.north &&
        GBA_BBOX.west <= lon && lon <= GBA_BBOX.east;
}

function isValidNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
}

function showStatus(msg, type) {
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
    if (type === "error") {
        statusDiv.classList.add("status-error");
    } else if (type === "success") {
        statusDiv.classList.add("status-success");
    } else {
        statusDiv.classList.add("status-info");
    }
}


// --- UI flow helpers ---

function hideUploadOptions() {
    if (uploadOptions) uploadOptions.style.display = "none";
}

function showUploadOptions() {
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
    currentImageFile = null;
    currentGPS = null;
}

function showSuccessScreen() {
    if (locationInfo) locationInfo.style.display = "none";
    if (successScreen) successScreen.style.display = "block";
}

function resetApp() {
    // Reset state
    currentImageFile = null;
    currentGPS = null;
    if (marker && map) {
        map.removeLayer(marker);
        marker = null;
    }

    // Reset form
    const issueType = document.getElementById("issueType");
    const issueDesc = document.getElementById("issueDesc");
    if (issueType) issueType.value = "Pothole";
    if (issueDesc) issueDesc.value = "";
    if (confirmImageCheck) confirmImageCheck.checked = false;

    // Reset map view
    if (map) {
        map.setView([12.9716, 77.5946], 13);
    }

    showStatus("", "");
    showUploadOptions();
}

// Tweet button gating
function updateTweetButtonState() {
    const imageOk = !!currentImageFile;
    const gpsOk = currentGPS &&
        isValidNumber(currentGPS.lat) &&
        isValidNumber(currentGPS.lon) &&
        isInGBA(currentGPS.lat, currentGPS.lon);
    const confirmed = confirmImageCheck && confirmImageCheck.checked;

    if (tweetBtn) {
        tweetBtn.disabled = !(imageOk && gpsOk && confirmed);
    }
}

// --- Image handling ---

function handleImageUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }

    currentImageFile = file;
    if (confirmImageCheck) confirmImageCheck.checked = false;
    if (tweetBtn) tweetBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = (e) => {
        if (previewImg) {
            previewImg.src = e.target.result;
            previewImg.style.display = "block";
        }
        hideUploadOptions();
        if (imageConfirm) imageConfirm.style.display = "block";
        extractGPSFromExif(e.target.result);
    };
    reader.readAsDataURL(file);
}

// --- EXIF + GPS ---

async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse start");

    try {
        const exif = piexif.load(dataUrl);
        const gps = exif.GPS || {};
        const latArr = gps[piexif.GPSIFD.GPSLatitude];
        const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
        const lonArr = gps[piexif.GPSIFD.GPSLongitude];
        const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef];

        if (latArr && lonArr && latRef && lonRef) {
            const lat = piexif.GPSHelper.dmsRationalToDeg(latArr, latRef);
            const lon = piexif.GPSHelper.dmsRationalToDeg(lonArr, lonRef);

            currentGPS = { lat, lon };
            showStatus(`✅ GPS from photo: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");

            if (!isInGBA(lat, lon)) {
                showStatus("⚠️ Outside GBA - drag marker", "warning");
                if (tweetBtn) tweetBtn.disabled = true;
            } else {
                showStatus(`✅ GBA GPS verified: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");
            }
            showLocation();
            updateTweetButtonState();
            return;
        }
    } catch (e) {
        console.error("🚨 EXIF failed:", e);
    }

    // Live GPS fallback
    try {
        const liveGPS = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                reject,
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
        if (isInGBA(liveGPS.lat, liveGPS.lon)) {
            currentGPS = liveGPS;
            showStatus(`✅ Live GPS: ${liveGPS.lat.toFixed(4)}, ${liveGPS.lon.toFixed(4)}`, "success");
            showLocation();
            updateTweetButtonState();
            return;
        }
    } catch (e) {
        // ignore
    }

    showStatus("ℹ️ Click map for location.", "info");
    if (tweetBtn) tweetBtn.disabled = true;
}

// --- Map / Leaflet ---

async function validateLocationForCoords(testGPS) {
    if (!testGPS || !isValidNumber(testGPS.lat) || !isValidNumber(testGPS.lon)) return false;
    try {
        const polys = await loadCorpPolygons();
        return polys.some(p => p.ring && p.ring.length >= 3 && pointInRing(testGPS.lon, testGPS.lat, p.ring));
    } catch (e) {
        console.warn("Location validation failed:", e);
        return false;
    }
}

async function handleMapClick(e) {
    const testGPS = { lat: e.latlng.lat, lon: e.latlng.lng };
    const valid = await validateLocationForCoords(testGPS);

    if (!valid) {
        currentGPS = null;
        if (marker && map) { map.removeLayer(marker); marker = null; }
        if (tweetBtn) tweetBtn.disabled = true;
        if (infoBox) infoBox.classList.remove("valid");
        showStatus("❌ Map clicks outside GBA jurisdiction are not allowed.", "error");
        return;
    }

    currentGPS = testGPS;
    placeMarker();
    updateGpsDisplay();

    if (locationInfo) locationInfo.style.display = "block";
    if (infoBox) infoBox.classList.add("valid");
    showStatus("✅ Location verified within GBA jurisdiction.", "success");

    updateTweetButtonState();
}

function showLocation() {
    if (locationInfo) locationInfo.style.display = "block";
    const mapRestr = document.getElementById("mapRestrictionMsg");
    if (mapRestr) mapRestr.style.display = "block";
    const mapEl = document.getElementById("map");
    if (mapEl) mapEl.style.display = "block";

    initMap();
    if (currentGPS && isValidNumber(currentGPS.lat) && isValidNumber(currentGPS.lon)) {
        map.setView([currentGPS.lat, currentGPS.lon], 16);
        placeMarker();
        updateGpsDisplay();
        if (infoBox) infoBox.classList.add("valid");
    }
    setTimeout(() => { if (map) map.invalidateSize(); }, 250);
}

function initMap() {
    if (mapInitialized) return;
    map = L.map("map").setView([12.9716, 77.5946], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);
    map.on("click", handleMapClick);
    mapInitialized = true;
}

function placeMarker() {
    if (!map || !currentGPS) return;
    if (marker) map.removeLayer(marker);
    marker = L.marker([currentGPS.lat, currentGPS.lon], {
        draggable: true,
        title: "Drag to adjust location"
    })
        .addTo(map)
        .bindPopup("Issue location ✅<br>Drag to adjust within GBA area")
        .openPopup();

    marker.on("dragend", async e => {
        const newPos = e.target.getLatLng();
        const testGPS = { lat: newPos.lat, lon: newPos.lng };
        const valid = await validateLocationForCoords(testGPS);

        if (valid) {
            currentGPS = testGPS;
            updateGpsDisplay();
            showStatus(`✅ Dragged to GBA: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, "success");
            updateTweetButtonState();
        } else {
            e.target.setLatLng([currentGPS.lat, currentGPS.lon]);
            showStatus("❌ Outside GBA jurisdiction. Drag inside boundary.", "error");
            if (tweetBtn) tweetBtn.disabled = true;
        }
    });
}

function updateGpsDisplay() {
    const el = document.getElementById("gpsCoords");
    if (!el || !currentGPS) return;
    el.innerHTML = `${currentGPS.lat.toFixed(6)}, ${currentGPS.lon.toFixed(6)}`;
    const a = document.createElement("a");
    a.href = `https://www.google.com/maps/search/?api=1&query=${currentGPS.lat},${currentGPS.lon}`;
    a.target = "_blank";
    a.className = "gps-link";
    a.textContent = "🗺️ Open Map";
    el.appendChild(a);
}

// --- Polygon loading (unchanged logic) ---

function corpHandleForName(name) {
    switch (name) {
        case "Central": return "@BCCCofficial";
        case "East": return "@EASTCITYCORP";
        case "West": return "@BWCCofficial";
        case "North": return "@BNCCofficial";
        case "South": return "@comm_blr_south";
        default: return "";
    }
}

async function loadCorpPolygons() {
    if (corpPolygons) return corpPolygons;
    const res = await fetch(MAP_KML_URL);
    if (!res.ok) throw new Error("map.txt not found");
    const kmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
    corpPolygons = placemarks.map(pm => {
        const simpleData = pm.getElementsByTagName("SimpleData");
        let corpName = "";
        for (const sd of simpleData) {
            if (sd.getAttribute("name") === "NewCorp") {
                corpName = sd.textContent.trim();
            }
        }
        const coordsNode = pm.getElementsByTagName("coordinates")[0];
        if (!coordsNode) return null;
        const ring = coordsNode.textContent.trim()
            .split(/\s+/)
            .map(pair => pair.split(",").map(Number))
            .map(([lon, lat]) => [lon, lat]);
        return { corp: corpName, ring };
    }).filter(Boolean);
    return corpPolygons;
}

async function loadWardPolygons() {
    if (wardPolygons) return wardPolygons;
    const res = await fetch(WARD_KML_URL);
    if (!res.ok) throw new Error("ward KML not found");
    const kmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
    wardPolygons = placemarks.map(pm => {
        const simpleData = pm.getElementsByTagName("SimpleData");
        let wardNo = "", wardName = "";
        for (const sd of simpleData) {
            const nameAttr = sd.getAttribute("name");
            if (nameAttr === "ward_id") wardNo = sd.textContent.trim();
            else if (nameAttr === "ward_name") wardName = sd.textContent.trim();
        }
        const coordsNode = pm.getElementsByTagName("coordinates")[0];
        if (!coordsNode) return null;
        const ring = coordsNode.textContent.trim()
            .split(/\s+/)
            .map(pair => pair.split(",").map(Number))
            .map(([lon, lat]) => [lon, lat]);
        return { wardNo, wardName, ring };
    }).filter(Boolean);
    return wardPolygons;
}

async function findCorpForCurrentGPS() {
    if (!currentGPS) return { corpName: "", corpHandle: "" };
    const polys = await loadCorpPolygons();
    const lon = currentGPS.lon, lat = currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { corpName: p.corp || "", corpHandle: corpHandleForName(p.corp) };
        }
    }
    return { corpName: "", corpHandle: "" };
}

async function loadConstituencyPolygons() {
    if (constPolygons) return constPolygons;
    const res = await fetch(CONST_KML_URL);
    if (!res.ok) throw new Error("blr_const.txt not found");
    const kmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
    constPolygons = placemarks.map(pm => {
        const simpleData = pm.getElementsByTagName("SimpleData");
        let acName = "";
        for (const sd of simpleData) {
            if (sd.getAttribute("name") === "AC_NAME") acName = sd.textContent.trim();
        }
        const coordsNode = pm.getElementsByTagName("coordinates")[0];
        if (!coordsNode) return null;
        const ring = coordsNode.textContent.trim()
            .split(/\s+/)
            .map(pair => pair.split(",").map(Number))
            .map(([lon, lat]) => [lon, lat]);
        return { acName, ring };
    }).filter(Boolean);
    return constPolygons;
}

async function findConstituencyForCurrentGPS() {
    if (!currentGPS) return { acName: "", mlaHandle: "" };
    const polys = await loadConstituencyPolygons();
    const lon = currentGPS.lon, lat = currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            const handleUser = MLA_HANDLES[p.acName] || "";
            const handle = handleUser ? "@" + handleUser : "";
            return { acName: p.acName, mlaHandle: handle };
        }
    }
    return { acName: "", mlaHandle: "" };
}

async function findWardForCurrentGPS() {
    if (!currentGPS) return { wardNo: "", wardName: "" };
    const polys = await loadWardPolygons();
    const lon = currentGPS.lon, lat = currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { wardNo: p.wardNo, wardName: p.wardName };
        }
    }
    return { wardNo: "", wardName: "" };
}

function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- Tweet / share ---

async function shareToGBA() {
    if (!currentGPS || !isValidNumber(currentGPS.lat) || !isInGBA(currentGPS.lat, currentGPS.lon)) {
        showStatus("❌ Location must be inside GBA boundary.", "error");
        return;
    }
    if (!currentImageFile) {
        showStatus("❌ Please upload an image first.", "error");
        return;
    }

    const issueType = document.getElementById("issueType").value;
    const desc = document.getElementById("issueDesc").value.trim();

    const { acName, mlaHandle } = await findConstituencyForCurrentGPS();
    const { corpName, corpHandle } = await findCorpForCurrentGPS();
    const { wardNo, wardName } = await findWardForCurrentGPS();

    // Set UI state first
    if (tweetBtn) {
        tweetBtn.disabled = true;
        tweetBtn.textContent = "Posting...";
        tweetBtn.classList.add("loading");
    }
    showStatus("📤 Uploading issue to @zenc_civic...", "info");

    // ✅ FIXED: Proper RAF for smooth button repaint
    await new Promise(resolve => requestAnimationFrame(resolve));

    const formData = new FormData();
    formData.append("image", currentImageFile);
    formData.append("lat", currentGPS.lat.toFixed(6));
    formData.append("lon", currentGPS.lon.toFixed(6));
    formData.append("issueType", issueType);
    formData.append("description", desc);
    formData.append("corpHandle", corpHandle || "");
    formData.append("corpName", corpName || "");
    formData.append("wardNo", wardNo || "");
    formData.append("wardName", wardName || "");
    formData.append("constituency", acName);
    formData.append("mlaHandle", mlaHandle);

    try {
        const res = await fetch(API_GATEWAY_URL, { method: "POST", body: formData });
        const raw = await res.text();
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            throw new Error("Bad JSON from API: " + raw.slice(0, 200));
        }

        if (res.ok && data.success) {
            const url = data.tweetUrl || data.tweet_url || "";

            // Populate tweet link first
            const tweetContainer = document.getElementById('tweetLinkContainer');
            if (tweetContainer) {
                tweetContainer.innerHTML = `
                    <p class="map-message">Tweet posted! <a href="${url}" target="_blank">View on X</a></p>
                    <button id="copyTweetBtn" class="copy-btn">📋 Copy Tweet URL</button>
                `;
            }

            // Hide form elements + reset state
            document.getElementById('uploadOptions').style.display = 'none';
            document.getElementById('issueType').closest('.form-group')?.style.display = 'none';
            document.getElementById('issueDesc').closest('.form-group')?.style.display = 'none';
            document.querySelector('.leaflet-container')?.style.display = 'none';
            document.getElementById('gpsDetails')?.style.display = 'none';
            document.getElementById('tweetBtnContainer')?.style.display = 'none';

            // Clear/reset form data
            currentImageFile = null;
            currentImageUrl = null;
            currentGPS = null;
            document.getElementById('issueType').value = '';
            document.getElementById('issueDesc').value = '';
            const preview = document.getElementById('imagePreview');
            if (preview) preview.src = '';
            if (confirmImageCheck) confirmImageCheck.checked = false;

            // Show success
            showSuccessScreen();

            // Wire copy button
            const copyBtn = document.getElementById('copyTweetBtn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(url).then(() => {
                        copyBtn.textContent = '✅ Copied!';
                        setTimeout(() => copyBtn.textContent = '📋 Copy Tweet URL', 2000);
                    });
                });
            }
            return; // ✅ EXIT EARLY - prevents finally block
        } else {
            showStatus(`❌ Failed to post: ${data.message || data.error || res.status}`, "error");
        }
    } catch (e) {
        showStatus("❌ Submission failed: " + e.message, "error");
        console.error("Post error:", e);
    } finally {
        // ✅ Only runs on ERROR - tweet button stays hidden on success
        if (tweetBtn && document.getElementById('tweetBtnContainer')?.style.display !== 'none') {
            tweetBtn.classList.remove("loading");
            tweetBtn.textContent = "🚨 Post Issue via @zenc_civic";
            tweetBtn.disabled = false;
            updateTweetButtonState();
        }
    }
}





// --- Wire up DOM ---

document.addEventListener("DOMContentLoaded", () => {
    // Cache elements
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

    const cameraBtn = document.getElementById("cameraBtn");
    const uploadBtn = document.getElementById("uploadBtn");
    const submitAnotherBtn = document.getElementById("submitAnotherBtn");

    // Buttons
    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener("click", () => cameraInput.click());
    }
    if (uploadBtn && imageInput) {
        uploadBtn.addEventListener("click", () => imageInput.click());
    }
    if (imageInput) {
        imageInput.addEventListener("change", e => handleImageUpload(e.target.files[0]));
    }
    if (cameraInput) {
        cameraInput.addEventListener("change", e => handleImageUpload(e.target.files[0]));
    }

    if (dropZone) {
        dropZone.addEventListener("dragover", e => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
        dropZone.addEventListener("drop", e => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length) {
                handleImageUpload(e.dataTransfer.files[0]);
            }
        });
    }

    if (changeImageBtn) {
        changeImageBtn.addEventListener("click", resetApp);
    }
    if (confirmImageCheck) {
        confirmImageCheck.addEventListener("change", updateTweetButtonState);
    }
    if (submitAnotherBtn) {
        submitAnotherBtn.addEventListener("click", resetApp);
    }

    // Map
    initMap();
    showUploadOptions();
});
