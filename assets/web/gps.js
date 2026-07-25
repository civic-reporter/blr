// GPS module - SYNTAX FIXED
import { getConfig } from './config.js';
import { showStatus, showLocation, updateTweetButtonState, updateLocationConfirmVisibility } from './ui.js';

function bufferToBinary(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return binary;
}

function parseExifGps(exif) {
    const gps = exif.GPS || {};
    const latArr = gps[piexif.GPSIFD.GPSLatitude];
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
    const lonArr = gps[piexif.GPSIFD.GPSLongitude];
    const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef];

    if (!latArr || !lonArr || !latRef || !lonRef) return null;

    const lat = piexif.GPSHelper.dmsRationalToDeg(latArr, latRef);
    const lon = piexif.GPSHelper.dmsRationalToDeg(lonArr, lonRef);
    return { lat, lon };
}

async function isInGbaBbox(lat, lon) {
    const config = await getConfig();
    const bbox = config.GBA_BBOX;
    return bbox.south <= lat && lat <= bbox.north &&
        bbox.west <= lon && lon <= bbox.east;
}

export function markManualGps() {
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = true;
    updateLocationConfirmVisibility();
}

async function applyExtractedGps(lat, lon) {
    if (!(await isInGbaBbox(lat, lon))) {
        window.currentGPS = null;
        window.gpsFromPhotoExif = false;
        showStatus(`❌ GPS location outside GBA boundary`, "error");
        showLocation();
        updateTweetButtonState();
        updateLocationConfirmVisibility();
        return null;
    }

    window.currentGPS = { lat, lon };
    window.gpsFromPhotoExif = true;
    window.gpsManuallySet = false;
    updateTweetButtonState();
    updateLocationConfirmVisibility();
    showStatus('', "success");

    if (window.map) {
        window.map.setView([lat, lon], 16);
        setTimeout(() => {
            if (window.placeMarker) {
                window.placeMarker();
            } else {
                console.warn("❌ window.placeMarker() not defined");
            }
        }, 300);
    }

    showLocation();

    if (window.isTrafficFlow && window.updateEmailRecipients) {
        setTimeout(() => window.updateEmailRecipients(), 200);
    } else if (window.isCivicFlow && window.updateCivicEmailRecipients) {
        setTimeout(() => window.updateCivicEmailRecipients(), 200);
    }

    return { lat, lon };
}

export async function extractGPSFromImageFile(file) {
    if (!file || typeof piexif === 'undefined') return null;

    try {
        const buffer = await file.arrayBuffer();
        const gps = parseExifGps(piexif.load(bufferToBinary(buffer)));
        if (gps) {
            return applyExtractedGps(gps.lat, gps.lon);
        }
    } catch (e) {
        console.warn('EXIF parse from file failed:', e);
    }

    return null;
}

export async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse start");

    try {
        if (typeof piexif === 'undefined') {
            throw new Error("piexif not available");
        }

        const exif = piexif.load(dataUrl);
        const gps = parseExifGps(exif);
        if (gps) {
            return applyExtractedGps(gps.lat, gps.lon);
        }
    } catch (e) {
        console.error("🚨 EXIF error:", e);
    }

    showLocation();
    showStatus('', "info");
    updateLocationConfirmVisibility();
    return null;
}

export async function getLiveGPSIfInGBA() {
    console.log("📍 Live GPS fallback...");
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const gp = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                if (await isInGbaBbox(gp.lat, gp.lon)) resolve(gp);
                else resolve(null);
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}
