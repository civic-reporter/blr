import { getConfig } from './config.js';
import { pointInRing, isValidNumber } from './utils.js';
import { showStatus, updateTweetButtonState, ensureLocationVisible } from './ui.js';
import { validateLocationForCoords } from './validation.js';

let mapInstance, markerInstance;
let mapInitialized = false;
let CONFIG = null;
let googleMapsLoaded = false;
let markerPopupTimeout = null;

function setMapRestrictionVisibility(visible) {
    const msg = document.getElementById("mapRestrictionMsg");
    if (!msg) return;
    if (visible) {
        msg.classList.remove("is-hidden");
    } else {
        msg.classList.add("is-hidden");
    }
}

function loadGoogleMapsAPI(apiKey) {
    if (googleMapsLoaded || typeof google !== 'undefined') return;
    googleMapsLoaded = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    console.log('📍 Loading Google Maps API dynamically');
}

export function initMap() {
    console.log('🗺️ Initializing map...');
    if (mapInitialized) {
        console.log('⚠️ Map already initialized, skipping');
        return;
    }

    console.log('📍 Creating Leaflet map instance immediately');
    window.map = L.map("map").setView([12.9716, 77.5946], 12);
    mapInstance = window.map;

    // Load Google Maps API in background when config is ready
    getConfig().then(config => {
        CONFIG = config;
        loadGoogleMapsAPI(CONFIG.GOOGLE_MAPS_API_KEY);
    }).catch(err => console.warn('Config load failed:', err));

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(window.map);

    setupSearch();
    window.map.on("click", handleMapClick);
    mapInitialized = true;

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
    searchInput.placeholder = 'Search for regions under Greater Bengaluru Authority';
    searchInput.style.cssText = 'width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;';

    wrapper.appendChild(searchInput);

    const mapNode = document.getElementById('map');
    if (mapNode?.parentNode) {
        mapNode.parentNode.insertBefore(wrapper, mapNode);
    }

    initGoogleAutocomplete(searchInput);
}

function initGoogleAutocomplete(searchInput) {
    const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            clearInterval(checkGoogle);
            setupGoogleAutocomplete(searchInput);
        }
    }, 100);
}

async function setupGoogleAutocomplete(searchInput) {
    if (!CONFIG) CONFIG = await getConfig();

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
            setMapRestrictionVisibility(false);
            showStatus('', 'success');
            setTimeout(updateTweetButtonState, 50);
            if (window.updateReportPreview) window.updateReportPreview();
            if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
        } else {
            if (markerInstance) window.map.removeLayer(markerInstance);
            window.currentGPS = null;
            setMapRestrictionVisibility(true);
            showStatus('❌ Outside GBA boundary', 'error');
            updateTweetButtonState();
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
        setMapRestrictionVisibility(true);
        showStatus("❌ Outside GBA - click inside boundary", "error");
        updateTweetButtonState();
        return;
    }

    window.currentGPS = testGPS;
    setMapRestrictionVisibility(false);
    window.placeMarker();  // ✅ USE GLOBAL
    ensureLocationVisible();
    showStatus('', 'success');
    updateTweetButtonState();

    if (window.updateReportPreview) window.updateReportPreview();

    // Update email recipients based on flow type
    if (window.isTrafficFlow && window.updateEmailRecipients) {
        setTimeout(() => window.updateEmailRecipients(), 100);
    } else if (window.isCivicFlow && window.updateCivicEmailRecipients) {
        setTimeout(() => window.updateCivicEmailRecipients(), 100);
    }
    if (window.isCivicFlow && window.updateCivicWhatsAppOption) {
        setTimeout(() => window.updateCivicWhatsAppOption(), 100);
    }
}

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
        .bindPopup("Issue location")
        .openPopup();

    if (markerPopupTimeout) {
        clearTimeout(markerPopupTimeout);
    }
    markerPopupTimeout = setTimeout(() => {
        if (markerInstance && markerInstance.isPopupOpen()) {
            markerInstance.closePopup();
        }
    }, 5000);

    updateGpsDisplay();

    markerInstance.on('dragend', async (e) => {
        const newPos = e.target.getLatLng();
        const testGPS = { lat: newPos.lat, lon: newPos.lng };
        console.log("🔄 Marker dragged to:", testGPS.lat.toFixed(4), testGPS.lon.toFixed(4));

        const valid = await validateLocationForCoords(testGPS);
        if (valid) {
            window.currentGPS = testGPS;
            setMapRestrictionVisibility(false);
            updateGpsDisplay();
            showStatus('', 'success');
            updateTweetButtonState();
            if (window.updateReportPreview) window.updateReportPreview();

            // Update email recipients when marker is dragged
            if (window.isTrafficFlow && window.updateEmailRecipients) {
                setTimeout(() => window.updateEmailRecipients(), 100);
            } else if (window.isCivicFlow && window.updateCivicEmailRecipients) {
                setTimeout(() => window.updateCivicEmailRecipients(), 100);
            }
            if (window.isCivicFlow && window.updateCivicWhatsAppOption) {
                setTimeout(() => window.updateCivicWhatsAppOption(), 100);
            }
        } else {
            markerInstance.setLatLng([window.currentGPS.lat, window.currentGPS.lon]);
            setMapRestrictionVisibility(true);
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
