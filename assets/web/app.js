// app.js — original app script (migrated from inline)

// Configuration
const API_GATEWAY_URL = "https://c543fafez6.execute-api.ap-south-1.amazonaws.com/zenc";
const MAP_KML_URL = "assets/data/map.kml";           // adjust path if needed (e.g. assets/data/map.txt)
const CONST_KML_URL = "assets/data/blr_const.kml";    // adjust path if needed

let currentImageFile = null;
let currentGPS = null;
let map, marker;
let corpPolygons = null;
let constPolygons = null;
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

function isInGBA(lat, lon) {
    return GBA_BBOX.south <= lat && lat <= GBA_BBOX.north &&
        GBA_BBOX.west <= lon && GBA_BBOX.east;
}


const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const tweetBtn = document.getElementById("tweetBtn");
const infoBox = document.getElementById("infoBox");

if (imageInput) imageInput.addEventListener("change", handleImage);
if (dropZone) {
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            imageInput.files = e.dataTransfer.files;
            handleImage({ target: { files: e.dataTransfer.files } });
        }
    });
}

function handleImage(evt) {
    const file = evt.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
        showStatus("❌ Please upload a photo file.", "error");
        return;
    }
    currentImageFile = file;

    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById("preview");
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = "block";
        }
        extractGPSFromExif(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse start");

    // 1. EXIF (your exact code)
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
            showStatus(`✅ GPS from photo: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');

            if (!isInGBA(lat, lon)) {
                showStatus(`⚠️ Outside GBA - drag marker`, 'warning');
                tweetBtn.disabled = true;
            } else {
                tweetBtn.disabled = false;
                showStatus(`✅ GBA GPS verified: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
            }
            showLocation();
            return;
        }
    } catch (e) {
        console.error("🚨 EXIF failed:", e);
    }

    // 2. LIVE GPS fallback (mobile camera fix)
    try {
        const liveGPS = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                reject, { enableHighAccuracy: true, timeout: 5000 }
            );
        });
        if (isInGBA(liveGPS.lat, liveGPS.lon)) {
            currentGPS = liveGPS;
            showStatus(`✅ Live GPS: ${liveGPS.lat.toFixed(4)}, ${liveGPS.lon.toFixed(4)}`, 'success');
            showLocation();
            return;
        }
    } catch (e) { }

    // 3. Manual map
    showStatus('ℹ️ Click map for location.', 'info');
    tweetBtn.disabled = true;
}



function isValidNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
}

function useBrowserLocation() {
    if (!navigator.geolocation) { initMapFallback(); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        currentGPS = { lat: Number(pos.coords.latitude), lon: Number(pos.coords.longitude) };
        showLocation();
    }, () => {
        initMapFallback();
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

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

    // 🔧 DEBUG LOG (remove after fix)
    console.log('🗺️ CLICK:', testGPS, 'VALID:', valid, 'TWEETBTN:', tweetBtn);

    if (!valid) {
        currentGPS = null;
        if (marker) { map.removeLayer(marker); marker = null; }
        if (tweetBtn) tweetBtn.disabled = true;  // 🔧 DEFENSIVE
        if (infoBox) infoBox.classList.remove("valid");
        showStatus("❌ Outside GBA jurisdiction.", "error");
        return;
    }

    currentGPS = testGPS;
    placeMarker();
    updateGpsDisplay();

    // 🔧 CRITICAL: Defensive enable + force UI update
    if (tweetBtn) {
        tweetBtn.disabled = false;
        tweetBtn.style.opacity = '1';
        tweetBtn.classList.remove('disabled', 'loading');
        console.log('✅ TWEET BUTTON ENABLED');
    } else {
        console.error('❌ tweetBtn NOT FOUND - check HTML id="tweetBtn"');
    }

    if (infoBox) infoBox.classList.add("valid");
    showStatus("✅ Location verified within GBA jurisdiction.", "success");
}


function showLocation() {
    const locInfo = document.getElementById("locationInfo");
    const mapRestr = document.getElementById("mapRestrictionMsg");
    if (locInfo) locInfo.style.display = "block";
    if (mapRestr) mapRestr.style.display = "block";
    if (document.getElementById("map")) document.getElementById("map").style.display = "block";
    initMap();
    if (currentGPS && isValidNumber(currentGPS.lat) && isValidNumber(currentGPS.lon)) {
        map.setView([currentGPS.lat, currentGPS.lon], 16);
        placeMarker();
        updateGpsDisplay();
        tweetBtn.disabled = false;
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

function initMapFallback() {
    const m = document.getElementById("map");
    if (m) m.style.display = "block";
    initMap();
    map.setView([12.9716, 77.5946], 12);
    const locInfo = document.getElementById("locationInfo");
    const mapRestr = document.getElementById("mapRestrictionMsg");
    if (locInfo) locInfo.style.display = "block";
    if (mapRestr) mapRestr.style.display = "block";
    showStatus("Click on the map to set the exact location within GBA area.", "info");
}

function placeMarker() {
    if (marker) map.removeLayer(marker);
    if (currentGPS && map) {
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

            // ✅ STRICT POLYGON VALIDATION (matches map click)
            const valid = await validateLocationForCoords(testGPS);
            if (valid) {
                currentGPS = testGPS;
                updateGpsDisplay();
                tweetBtn.disabled = false;
                showStatus(`✅ Dragged to GBA: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, 'success');
            } else {
                // REVERT to valid position
                e.target.setLatLng([currentGPS.lat, currentGPS.lon]);
                showStatus(`❌ Outside GBA jurisdiction. Drag inside boundary.`, 'error');
                tweetBtn.disabled = true;
            }
        });


    }
}

// --- Corporations from map.txt (NewCorp) ---
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

async function findCorpForCurrentGPS() {
    if (!currentGPS) return { corpName: "", corpHandle: "" };
    const polys = await loadCorpPolygons();
    const lon = currentGPS.lon;
    const lat = currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            const corpName = p.corp || "";
            const corpHandle = corpHandleForName(corpName);
            return { corpName, corpHandle };
        }
    }
    return { corpName: "", corpHandle: "" };
}

// --- Constituencies from blr_const.txt ---
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
            if (sd.getAttribute("name") === "AC_NAME") {
                acName = sd.textContent.trim();
            }
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
    const lon = currentGPS.lon;
    const lat = currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            const handleUser = MLA_HANDLES[p.acName] || "";
            const handle = handleUser ? "@" + handleUser : "";
            return { acName: p.acName, mlaHandle: handle };
        }
    }
    return { acName: "", mlaHandle: "" };
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

function showStatus(msg, type) {
    const el = document.getElementById("status");
    if (!el) return;
    if (!msg) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.innerHTML = msg;
    el.style.background = type === "error" ? "#f8d7da"
        : type === "success" ? "#d4edda"
            : "#e2e3e5";
    el.style.borderLeft = `4px solid ${type === "error" ? "#dc3545" :
        type === "success" ? "#28a745" : "#6c757d"}`;
}

async function shareToGBA() {
    // ✅ FINAL GBA CHECK BEFORE TWEET
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

    const formData = new FormData();
    formData.append("image", currentImageFile);
    formData.append("lat", currentGPS.lat.toFixed(6));
    formData.append("lon", currentGPS.lon.toFixed(6));
    formData.append("issueType", issueType);
    formData.append("description", desc);
    formData.append("corpHandle", corpHandle || "");
    formData.append("corpName", corpName || "");
    formData.append("constituency", acName);
    formData.append("mlaHandle", mlaHandle);

    tweetBtn.disabled = true;
    tweetBtn.textContent = "Posting...";
    tweetBtn.classList.add("loading");
    showStatus("📤 Uploading issue to @zenc_civic...", "info");

    try {
        const res = await fetch(API_GATEWAY_URL, { method: "POST", body: formData });
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); }
        catch (e) { throw new Error("Bad JSON from API: " + raw.slice(0, 200)); }

        if (res.ok && data.success) {
            const url = data.tweetUrl || data.tweet_url || "";
            let html = "✅ Tweet posted successfully from @zenc_civic!";
            if (corpName || acName) {
                html += `<div class="map-message" style="margin-top:6px;">`;
                if (corpName) {
                    html += `Corporation: ${corpName}${corpHandle ? " (" + corpHandle + ")" : ""}<br>`;
                }
                if (acName) {
                    html += `Constituency: ${acName}${mlaHandle ? " – tagged " + mlaHandle : ""}`;
                }
                html += `</div>`;
            }
            if (url) {
                html += `<div class="map-message" style="margin-top:8px;">
                   <a href="${url}" target="_blank">${url}</a>
                 </div>`;
            }
            showStatus(html, "success");
            if (url) {
                const copyBtn = document.createElement("button");
                copyBtn.textContent = "📋 Copy Tweet URL";
                copyBtn.className = "copy-btn";
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(url).then(() => {
                        copyBtn.textContent = "✅ Copied!";
                        setTimeout(() => copyBtn.textContent = "📋 Copy Tweet URL", 2000);
                    });
                };
                document.getElementById("status").appendChild(copyBtn);
            }
            document.getElementById("issueType").value = "Pothole";
            document.getElementById("issueDesc").value = "";
        } else {
            showStatus(`❌ Failed to post: ${data.message || data.error || res.status}`, "error");
        }
    } catch (e) {
        showStatus("❌ Submission failed: " + e.message, "error");
        console.error("Post error:", e);
    } finally {
        tweetBtn.disabled = false;
        tweetBtn.classList.remove("loading");
        tweetBtn.textContent = "🚨 Post Issue via @zenc_civic";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initMap();
});