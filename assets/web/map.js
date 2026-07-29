import { getConfig } from './config.js';
import { pointInRing, isValidNumber } from './utils.js';
import { showStatus, updateSubmitButtonState, ensureLocationVisible, showImageConfirm } from './ui.js';
import { markManualGps } from './gps.js';
import { validateLocationForCoords } from './validation.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

let mapInstance, markerInstance;
let mapInitialized = false;
let CONFIG = null;
let googleMapsLoaded = false;
let markerPopupTimeout = null;
let accuracyCircle = null;

export function clearAccuracyCircle() {
    if (accuracyCircle && window.map) {
        window.map.removeLayer(accuracyCircle);
    }
    accuracyCircle = null;
}

export function updateAccuracyCircle(lat, lon, accuracyMeters) {
    if (!window.map || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        !Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
        clearAccuracyCircle();
        return;
    }

    clearAccuracyCircle();
    accuracyCircle = L.circle([lat, lon], {
        radius: accuracyMeters,
        color: '#5b9bd5',
        fillColor: '#5b9bd5',
        fillOpacity: 0.12,
        weight: 1,
        interactive: false
    }).addTo(window.map);
}

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

    getConfig().then(config => {
        CONFIG = config;
        const defaults = config.MAP_DEFAULTS || { lat: 12.9716, lon: 77.5946, zoom: 12 };
        window.map = L.map("map").setView([defaults.lat, defaults.lon], defaults.zoom);
        mapInstance = window.map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(window.map);

        setupSearch();
        window.map.on("click", handleMapClick);
        loadGoogleMapsAPI(CONFIG.GOOGLE_MAPS_API_KEY);
        window.placeMarker = placeMarker;
        mapInitialized = true;
        console.log("🗺️ Map + search ready - placeMarker GLOBAL ✅");
    }).catch(err => {
        console.warn('Config load failed, using Bengaluru defaults:', err);
        window.map = L.map("map").setView([12.9716, 77.5946], 12);
        mapInstance = window.map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(window.map);
        setupSearch();
        window.map.on("click", handleMapClick);
        window.placeMarker = placeMarker;
        mapInitialized = true;
    });
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
    searchInput.placeholder = t('mapSearchPlaceholder', getCurrentLanguage()) || 'Search within city limits';
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
            window.currentGPSAccuracy = null;
            markManualGps();
            if (markerInstance) window.map.removeLayer(markerInstance);
            window.placeMarker();
            window.map.setView([gps.lat, gps.lon], 16);
            setMapRestrictionVisibility(false);
            showStatus('', 'success');
            showImageConfirm();
            setTimeout(updateSubmitButtonState, 50);
            if (window.updateReportPreview) window.updateReportPreview();
            if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
            window.dispatchEvent(new CustomEvent('civicLocationUpdated'));
        } else {
            if (markerInstance) window.map.removeLayer(markerInstance);
            window.currentGPS = null;
            setMapRestrictionVisibility(true);
            showStatus(`❌ ${t('mapOutsideBoundary', getCurrentLanguage())}`, 'error');
            updateSubmitButtonState();
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
        showStatus(`❌ ${t('mapOutsideBoundaryClick', getCurrentLanguage())}`, "error");
        updateSubmitButtonState();
        return;
    }

    window.currentGPS = testGPS;
    window.currentGPSAccuracy = null;
    markManualGps();
    setMapRestrictionVisibility(false);
    window.placeMarker();  // ✅ USE GLOBAL
    ensureLocationVisible();
    showImageConfirm();
    showStatus('', 'success');
    updateSubmitButtonState();
    window.dispatchEvent(new CustomEvent('civicLocationUpdated'));

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

    if (Number.isFinite(window.currentGPSAccuracy)) {
        updateAccuracyCircle(window.currentGPS.lat, window.currentGPS.lon, window.currentGPSAccuracy);
    } else {
        clearAccuracyCircle();
    }

    markerInstance.on('dragend', async (e) => {
        const newPos = e.target.getLatLng();
        const testGPS = { lat: newPos.lat, lon: newPos.lng };
        console.log("🔄 Marker dragged to:", testGPS.lat.toFixed(4), testGPS.lon.toFixed(4));

        const valid = await validateLocationForCoords(testGPS);
        if (valid) {
            window.currentGPS = testGPS;
            window.currentGPSAccuracy = null;
            markManualGps();
            setMapRestrictionVisibility(false);
            clearAccuracyCircle();
            updateGpsDisplay();
            showImageConfirm();
            showStatus('', 'success');
            updateSubmitButtonState();
            if (window.updateReportPreview) window.updateReportPreview();
            window.dispatchEvent(new CustomEvent('civicLocationUpdated'));

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
            showStatus(`❌ ${t('mapOutsideBoundaryJurisdiction', getCurrentLanguage())}`, "error");
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
