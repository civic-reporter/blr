import { CONFIG } from './config.js';
import { pointInRing, isValidNumber } from './utils.js';
import { showStatus, showLocation, updateTweetButtonState, ensureLocationVisible } from './ui.js';
import { validateLocationForCoords } from './validation.js';

let map, marker;
let mapInitialized = false;

export function initMap() {
    if (mapInitialized) return;

    map = L.map("map").setView([12.9716, 77.5946], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    setupSearch();
    map.on("click", handleMapClick);
    mapInitialized = true;
}

function setupSearch() {
    const wrapper = document.createElement('div');
    wrapper.id = 'gbaSearchWrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';

    const searchInput = document.createElement('input');
    searchInput.id = 'gbaSearch';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search GBA (MG Road, Jayanagar 4th Block)...';

    const suggBox = document.createElement('div');
    suggBox.id = 'gbaSearchSuggestions';
    suggBox.style.display = 'none';

    wrapper.appendChild(searchInput);
    wrapper.appendChild(suggBox);

    const mapNode = document.getElementById('map');
    mapNode.parentNode.insertBefore(wrapper, mapNode);

    let hintTimeout = null;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (hintTimeout) clearTimeout(hintTimeout);
        if (q.length < 3) {
            suggBox.style.display = 'none';
            suggBox.innerHTML = '';
            return;
        }
        hintTimeout = setTimeout(() => loadNominatimHints(q, suggBox, searchInput), 300);
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            suggBox.style.display = 'none';
        }
    });
}

export async function handleMapClick(e) {
    const testGPS = { lat: e.latlng.lat, lon: e.latlng.lng };
    const valid = await validateLocationForCoords(testGPS);

    if (!valid) {
        window.currentGPS = null;
        if (marker && map) { map.removeLayer(marker); marker = null; }
        if (window.tweetBtn) window.tweetBtn.disabled = true;
        if (document.getElementById("infoBox")) document.getElementById("infoBox").classList.remove("valid");
        showStatus("❌ Map clicks outside GBA jurisdiction are not allowed.", "error");
        return;
    }

    window.currentGPS = testGPS;
    placeMarker();
    updateGpsDisplay();
    ensureLocationVisible();

    if (document.getElementById("locationInfo")) document.getElementById("locationInfo").style.display = "block";
    if (document.getElementById("infoBox")) document.getElementById("infoBox").classList.add("valid");
    showStatus("✅ Location verified within GBA jurisdiction.", "success");

    updateTweetButtonState();
}

export function placeMarker() {
    if (!map || !window.currentGPS) return;

    if (marker) map.removeLayer(marker);

    marker = L.marker([window.currentGPS.lat, window.currentGPS.lon], {
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
            window.currentGPS = testGPS;
            updateGpsDisplay();
            ensureLocationVisible();
            showStatus(`✅ Dragged to GBA: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, "success");
            updateTweetButtonState();
        } else {
            e.target.setLatLng([window.currentGPS.lat, window.currentGPS.lon]);
            showStatus("❌ Outside GBA jurisdiction. Drag inside boundary.", "error");
            if (window.tweetBtn) window.tweetBtn.disabled = true;
            updateTweetButtonState();
        }
    });
}

function updateGpsDisplay() {
    const el = document.getElementById("gpsCoords");
    if (!el || !window.currentGPS) return;
    el.innerHTML = `${window.currentGPS.lat.toFixed(6)}, ${window.currentGPS.lon.toFixed(6)}`;
    const a = document.createElement("a");
    a.href = `https://www.google.com/maps/search/?api=1&query=${window.currentGPS.lat},${window.currentGPS.lon}`;
    a.target = "_blank";
    a.className = "gps-link";
    a.textContent = "🗺️ Open Map";
    el.appendChild(a);
}

async function loadNominatimHints(query, suggBox, searchInput) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}` +
            `&bounded=1&viewbox=77.40,12.82,77.85,13.20&countrycodes=in&limit=5`
        );
        const data = await res.json();
        suggBox.innerHTML = '';

        if (!data.length) {
            suggBox.style.display = 'none';
            return;
        }

        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'gba-suggestion-item';
            div.textContent = item.display_name;
            div.addEventListener('click', async () => {
                searchInput.value = item.display_name;
                suggBox.style.display = 'none';

                const gps = {
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                };
                const valid = await validateLocationForCoords(gps);
                if (valid) {
                    window.currentGPS = gps;
                    if (marker && map) map.removeLayer(marker);
                    placeMarker();
                    ensureLocationVisible();
                    map.setView([gps.lat, gps.lon], 16);
                    showStatus('✅ Location validated inside GBA.', 'success');
                    updateTweetButtonState();
                } else {
                    showStatus('❌ Outside GBA boundary.', 'error');
                }
            });
            suggBox.appendChild(div);
        });

        suggBox.style.display = 'block';
    } catch (err) {
        console.error(err);
    }
}
