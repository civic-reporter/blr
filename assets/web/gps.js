// GPS module - SYNTAX FIXED
import { showStatus, showLocation, updateTweetButtonState } from './ui.js';
import { isInGBA } from './utils.js';

export async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse start");

    try {
        if (typeof piexif === 'undefined') {
            throw new Error("piexif not available");
        }

        const exif = piexif.load(dataUrl);
        const gps = exif.GPS || {};
        const latArr = gps[piexif.GPSIFD.GPSLatitude];
        const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
        const lonArr = gps[piexif.GPSIFD.GPSLongitude];
        const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef];

        if (latArr && lonArr && latRef && lonRef) {
            const lat = piexif.GPSHelper.dmsRationalToDeg(latArr, latRef);
            const lon = piexif.GPSHelper.dmsRationalToDeg(lonArr, lonRef);

            // Check if location is in GBA before accepting it
            if (!isInGBA(lat, lon)) {
                window.currentGPS = null;
                showStatus(`❌ GPS location outside GBA boundary`, "error");
                showLocation();
                updateTweetButtonState();
                return null;
            }

            window.currentGPS = { lat, lon };
            updateTweetButtonState();
            showStatus(`✅ GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");

            if (window.map) {
                window.map.setView([lat, lon], 16);
                setTimeout(() => {
                    // ✅ FIXED: Use GLOBAL placeMarker
                    if (window.placeMarker) {
                        window.placeMarker();
                    } else {
                        console.warn("❌ window.placeMarker() not defined");
                    }
                }, 300);
            }

            showLocation();

            // Update email recipients after GPS is confirmed (with delay to ensure GPS is set)
            if (window.isTrafficFlow && window.updateEmailRecipients) {
                console.log('📧 Scheduling updateEmailRecipients from GPS');
                setTimeout(() => {
                    console.log('📧 GPS confirmed, currentGPS:', window.currentGPS);
                    window.updateEmailRecipients();
                }, 200);
            }

            return { lat, lon };
        }
    } catch (e) {
        console.error("🚨 EXIF error:", e);
    }

    showLocation();
    showStatus("ℹ️ No GPS. Use map/search.", "info");
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
