// GPS module - COMPLETE (EXIF + Live GPS fallback)
import { showStatus, showLocation, updateTweetButtonState } from './ui.js';
import { isInGBA } from './utils.js';

// ✅ piexif is GLOBAL - loaded via <script> in index.html
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

            console.log("✅ GPS extracted:", lat.toFixed(4), lon.toFixed(4));
            window.currentGPS = { lat, lon };

            // ✅ SIMPLE: Just tweet state + show location
            updateTweetButtonState();  // Pure DOM - tweet green!
            showStatus(`✅ GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");
            showLocation();  // Map handles marker automatically

            if (!isInGBA(lat, lon)) {
                showStatus("⚠️ Outside GBA - use map", "warning");
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
    console.log("📍 Attempting live GPS fallback...");
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.error("❌ Browser lacks geolocation API");
            return resolve(null);
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const gp = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
                console.log("📍 Live GPS success:", gp.lat.toFixed(6), gp.lon.toFixed(6), `±${gp.accuracy}m`);

                if (isInGBA(gp.lat, gp.lon)) {
                    resolve(gp);
                } else {
                    console.warn("🚫 Live GPS outside GBA bounds");
                    resolve(null);
                }
            },
            (err) => {
                console.error("❌ Live GPS failed:", err.code, err.message);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 60000
            }
        );
    });
}
