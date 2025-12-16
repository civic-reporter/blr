import { CONFIG } from './config.js';
import { pointInRing, isValidNumber } from './utils.js';
import { showStatus, updateTweetButtonState, ensureLocationVisible } from './ui.js';
import { validateLocationForCoords } from './validation.js';

let mapInstance, markerInstance;
let mapInitialized = false;

export function initMap() {
    if (mapInitialized) return;

    // ✅ GLOBAL MAP EXPOSURE
    window.map = L.map("map").setView([12.9716, 77.5946], 12);
    mapInstance = window.map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(window.map);

    setupSearch();
    window.map.on("click", handleMapClick);
    mapInitialized = true;

    // ✅ EXPORT + GLOBALIZE placeMarker
    window.placeMarker = placeMarker;
    console.log("🗺️ Map + search ready - placeMarker GLOBAL ✅");
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
    searchInput.placeholder = 'Search GBA (MG Road, Jayanagar 4th Block)...';
    searchInput.style.cssText = 'width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;';

    wrapper.appendChild(searchInput);

    const mapNode = document.getElementById('map');
    if (mapNode?.parentNode) {
        mapNode.parentNode.insertBefore(wrapper, mapNode);
    }

    // Initialize Google Places Autocomplete when API is ready
    initGoogleAutocomplete(searchInput);
}

function initGoogleAutocomplete(searchInput) {
    // Wait for Google Maps API to be loaded
    const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            clearInterval(checkGoogle);
            setupGoogleAutocomplete(searchInput);
        }
    }, 100);
}

function setupGoogleAutocomplete(searchInput) {
    const bangalore = new google.maps.LatLng(12.9716, 77.5946);

    const autocomplete = new google.maps.places.Autocomplete(searchInput, {
        bounds: new google.maps.LatLngBounds(
            new google.maps.LatLng(CONFIG.GBA_BBOX.south, CONFIG.GBA_BBOX.west),
            new google.maps.LatLng(CONFIG.GBA_BBOX.north, CONFIG.GBA_BBOX.east)
        ),
        strictBounds: false,
        componentRestrictions: { country: 'in' },
        fields: ['geometry', 'name', 'formatted_address']
    });

    autocomplete.addListener('place_changed', async () => {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
            showStatus('❌ No location found', 'error');
            return;
        }

        const gps = {
            lat: place.geometry.location.lat(),
            lon: place.geometry.location.lng()
        };

        const valid = await validateLocationForCoords(gps);
        if (valid && window.map) {
            window.currentGPS = gps;
            if (markerInstance) window.map.removeLayer(markerInstance);
            window.placeMarker();
            window.map.setView([gps.lat, gps.lon], 16);
            showStatus(`✅ ${place.name || place.formatted_address}`, 'success');
            setTimeout(updateTweetButtonState, 50);
        } else {
            showStatus('❌ Outside GBA boundary', 'error');
        }
    });
}

export async function handleMapClick(e) {
    console.log("🖱️ Map clicked:", e.latlng.lat.toFixed(4), e.latlng.lng.toFixed(4));
    const testGPS = { lat: e.latlng.lat, lon: e.latlng.lng };
    const valid = await validateLocationForCoords(testGPS);

    if (!valid) {
        if (markerInstance) window.map.removeLayer(markerInstance);
        window.currentGPS = null;
        showStatus("❌ Outside GBA - click inside boundary", "error");
        return;
    }

    window.currentGPS = testGPS;
    window.placeMarker();  // ✅ USE GLOBAL
    updateGpsDisplay();
    ensureLocationVisible();
    showStatus(`✅ Clicked: ${testGPS.lat.toFixed(4)}, ${testGPS.lon.toFixed(4)}`, "success");
    updateTweetButtonState();
}

// ✅ EXPORT placeMarker
export function placeMarker() {
    console.log("📍 Placing marker at:", window.currentGPS?.lat?.toFixed(4), window.currentGPS?.lon?.toFixed(4));

    if (!window.currentGPS || !isValidNumber(window.currentGPS.lat) || !isValidNumber(window.currentGPS.lon)) {
        console.warn("❌ Invalid GPS for marker");
        return;
    }

    if (markerInstance) window.map.removeLayer(markerInstance);

    markerInstance = L.marker([window.currentGPS.lat, window.currentGPS.lon], {
        draggable: true
    }).addTo(window.map)
        .bindPopup("Issue location ✅<br>Drag to adjust within GBA")
        .openPopup();

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
            markerInstance.setLatLng([window.currentGPS.lat, window.currentGPS.lon]);
            showStatus("❌ Outside GBA jurisdiction", "error");
        }
    });

    window.marker = markerInstance;
}

function updateGpsDisplay() {
    const el = document.getElementById("gpsCoords");
    if (!el || !window.currentGPS) return;

    el.innerHTML = `${window.currentGPS.lat.toFixed(6)}, ${window.currentGPS.lon.toFixed(6)}`;
    const link = el.querySelector('.gps-link');
    if (link) link.remove();

    const a = document.createElement('a');
    a.href = `https://www.google.com/maps/search/?api=1&query=${window.currentGPS.lat},${window.currentGPS.lon}`;
    a.target = '_blank';
    a.className = 'gps-link';
    a.textContent = '🗺️ Open Map';
    el.appendChild(a);
}
