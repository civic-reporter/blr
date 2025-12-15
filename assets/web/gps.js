import { CONFIG } from './config.js';
import { isValidNumber, isInGBA } from './utils.js';
import { showStatus, showLocation, updateTweetButtonState } from './ui.js';

export async function extractGPSFromExif(dataUrl) {
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

            window.currentGPS = { lat, lon };
            showStatus(`✅ GPS from photo: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");

            if (!isInGBA(lat, lon)) {
                showStatus("⚠️ Outside GBA - drag marker", "warning");
                if (window.tweetBtn) window.tweetBtn.disabled = true;
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

    showLocation();
    showStatus("ℹ️ No GPS in photo. Use search box or tap/drag on the map to set location.", "info");
    if (window.tweetBtn) window.tweetBtn.disabled = true;
}

export async function getLiveGPSIfInGBA() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const gp = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                if (isInGBA(gp.lat, gp.lon)) {
                    resolve(gp);
                } else {
                    resolve(null);
                }
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}
