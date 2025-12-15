import { CONFIG } from './config.js';
import { pointInRing, isValidNumber } from './utils.js';
import { showStatus, updateTweetButtonState, ensureLocationVisible } from './ui.js';
import { validateLocationForCoords } from './validation.js';

let mapInstance, markerInstance;
let mapInitialized = false;

export function initMap() {
    if (mapInitialized) return;

    // ✅ GLOBAL MAP + MARKER EXPOSURE
    window.map = L.map("map").setView([12.9716, 77.5946], 12);
    mapInstance = window.map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(window.map);

    setupSearch();
    window.map.on("click", handleMapClick);
    mapInitialized = true;
    console.log("🗺️ Map + marker ready");
}

function setupSearch() {
    const existing = document.getElementById('gbaSearchWrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'gbaSearchWrapper';
    wrapper.style.cssText = 'position:relative;width:100%;margin-bottom:10px;';

    const searchInput = document.createElement('input');
    searchInput.id = 'gbaSearch';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search GBA location...';
    searchInput.style.cssText = 'width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;';

    const suggBox = document.createElement('div');
    suggBox.id = 'gbaSearchSuggestions';
    suggBox.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ccc;border-radius:4px;max-height:200px;overflow:auto;z-index:1000;';

    wrapper.appendChild(searchInput);
    wrapper.appendChild(suggBox);

    const mapNode = document.getElementById('map');
    if (mapNode?.parentNode) {
        mapNode.parentNode.insertBefore(wrapper, mapNode);
    }

    let hintTimeout;
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (hintTimeout) clearTimeout(hintTimeout);
        if (q.length < 2) {
            suggBox.style.display = 'none';
            suggBox.innerHTML = '';
            return;
        }
        hintTimeout = setTimeout(() => loadNominatimHints(q, suggBox, searchInput), 300);
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) suggBox.style.display = 'none';
    });
}

async function loadNominatimHints(query, suggBox, searchInput) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}` +
            `&bounded=1&viewbox=77.40,12.82,77.85,13.20&countrycodes=in&limit=5`
        );
        const data = await res.json();
        suggBox.innerHTML = '';

        data.slice(0, 5).forEach(item => {
            const div = document.createElement('div');
            div.className = 'sugg-item';
            div.style.cssText = 'padding:8px;cursor:pointer;border-bottom:1px solid #eee;';
            div.textContent = item.display_name.split(',')[0];
            div.addEventListener('click', async () => {
                searchInput.value = item.display_name;
                suggBox.style.display = 'none';

                const gps = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
                const valid = await validateLocationForCoords(gps);
                if (valid && window.map) {
                    window.currentGPS = gps;
                    placeMarker();
                    window.map.setView([gps.lat, gps.lon], 16);
                    showStatus('✅ GBA location set', 'success');
                    updateTweetButtonState();
                } else {
                    showStatus('❌ Outside GBA', 'error');
                }
            });
            suggBox.appendChild(div);
        });
        suggBox.style.display = data.length ? 'block' : 'none';
    } catch (err) {
        console.error("Search error:", err);
    }
}

export async function handleMapClick(e) {
    console.log("🖱️ Map clicked:", e.latlng.lat, e.latlng.lng);
    const testGPS = { lat: e.latlng.lat, lon: e.latlng.lng };
    const valid = await validateLocationForCoords(testGPS);

    if (!valid) {
        if (markerInstance) window.map.removeLayer(markerInstance);
        window.currentGPS = null;
        showStatus("❌ Outside GBA - click inside boundary", "error");
        return;
    }

    window.currentGPS = testGPS;
    placeMarker();
    updateGpsDisplay();
    ensureLocationVisible();
    showStatus(`✅ Clicked: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, "success");
    updateTweetButtonState();
}

export function placeMarker() {
    console.log("📍 Placing marker at:", window.currentGPS?.lat, window.currentGPS?.lon);

    if (markerInstance) window.map.removeLayer(markerInstance);

    markerInstance = L.marker([window.currentGPS.lat, window.currentGPS.lon], {
        draggable: true
    }).addTo(window.map).bindPopup("Drag to adjust location").openPopup();

    // ✅ DRAG HANDLER
    markerInstance.on('dragend', async (e) => {
        const newPos = e.target.getLatLng();
        const testGPS = { lat: newPos.lat, lon: newPos.lng };
        console.log("🔄 Marker dragged to:", testGPS.lat.toFixed(4), testGPS.lon.toFixed(4));

        const valid = await validateLocationForCoords(testGPS);
        if (valid) {
            window.currentGPS = testGPS;
            updateGpsDisplay();
            showStatus(`✅ Dragged: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, "success");
            updateTweetButtonState();
        } else {
            // Snap back
            markerInstance.setLatLng([window.currentGPS.lat, window.currentGPS.lon]);
            showStatus("❌ Outside GBA jurisdiction", "error");
        }
    });

    window.marker = markerInstance;  // Global backup
}

function updateGpsDisplay() {
    const el = document.getElementById("gpsCoords");
    if (el && window.currentGPS) {
        el.innerHTML = `${window.currentGPS.lat.toFixed(6)}, ${window.currentGPS.lon.toFixed(6)}`;
        const link = el.querySelector('.gps-link');
        if (link) link.remove();
        const a = document.createElement('a');
        a.href = `https://www.google.com/maps/search/?api=1&query=${window.currentGPS.lat},${window.currentGPS.lon}`;
        a.target = '_blank';
        a.className = 'gps-link';
        a.textContent = '🗺️ Maps';
        el.appendChild(a);
    }
}
