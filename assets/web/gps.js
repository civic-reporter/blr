// GPS module - COMPLETE (EXIF + Live GPS fallback)
import { showStatus, showLocation, updateTweetButtonState } from './ui.js';
import { isInGBA } from './utils.js';

// ✅ piexif is GLOBAL - loaded via <script> in index.html
export async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse start", dataUrl ? `[${dataUrl.length} chars]` : "NO DATA");

    try {
        if (typeof piexif === 'undefined') {
            console.error("🚨 piexif.js NOT LOADED - check index.html");
            throw new Error("piexif not available");
        }

        const exif = piexif.load(dataUrl);
        const gps = exif.GPS || {};
        const latArr = gps[piexif.GPSIFD.GPSLatitude];
        const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
        const lonArr = gps[piexif.GPSIFD.GPSLongitude];
        const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef];

        console.log("📸 EXIF GPS raw:", { latArr, lonArr, latRef, lonRef });

        if (latArr && lonArr && latRef && lonRef) {
            const lat = piexif.GPSHelper.dmsRationalToDeg(latArr, latRef);
            const lon = piexif.GPSHelper.dmsRationalToDeg(lonArr, lonRef);

            console.log("✅ EXIF GPS extracted:", lat.toFixed(6), lon.toFixed(6));

            window.currentGPS = { lat, lon };
            updateTweetButtonState();
            showStatus(`✅ GPS from photo: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");

            // ✅ WAIT FOR MAP THEN CENTER + MARKER
            const waitForMap = setInterval(() => {
                if (window.map && typeof placeMarker === 'function') {
                    clearInterval(waitForMap);
                    window.map.setView([lat, lon], 16);
                    placeMarker();
                    console.log("🎯 GPS marker loaded:", lat.toFixed(4), lon.toFixed(4));
                }
            }, 100);

            showLocation();

            if (!isInGBA(lat, lon)) {
                showStatus("⚠️ Outside GBA - drag marker inside", "warning");
            } else {
                showStatus(`✅ GBA GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");
            }

            return { lat, lon };
        } else {
            console.log("ℹ️ No EXIF GPS arrays found");
        }
    } catch (e) {
        console.error("🚨 EXIF parse ERROR:", e.message, e.stack);
    }

    // No GPS fallback → force map/search
    console.log("ℹ️ No EXIF GPS → show map for manual selection");
    showLocation();
    showStatus("ℹ️ No GPS in photo. Use search or tap/drag map to set location.", "info");
    if (window.tweetBtn) window.tweetBtn.disabled = true;
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
