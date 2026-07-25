// GPS module - SYNTAX FIXED
import { showStatus, showLocation, updateTweetButtonState } from './ui.js';
import { isInGBA } from './utils.js';

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

async function applyExtractedGps(lat, lon) {
    if (!isInGBA(lat, lon)) {
        window.currentGPS = null;
        showStatus(`❌ GPS location outside GBA boundary`, "error");
        showLocation();
        updateTweetButtonState();
        return null;
    }

    window.currentGPS = { lat, lon };
    updateTweetButtonState();
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
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const gps = parseExifGps(piexif.load(binary));
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
    return null;
}
export async function getLiveGPSIfInGBA() {
    console.log("📍 Live GPS fallback...");
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);

        navigator.geolocation.getCurrentPosition(
            pos => {
                const gp = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                if (isInGBA(gp.lat, gp.lon)) resolve(gp);
                else resolve(null);
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });
}
