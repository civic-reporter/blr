// gps.js — Lambda GPS extraction (CommonJS for GitHub Pages)
const GPS_CONFIG = {
    API_GPS_URL: "https://c543fafez6.execute-api.ap-south-1.amazonaws.com/zenc/gps"
};

let gpsExtractionInProgress = false;

// Make functions globally available
window.extractGPSFromLambda = async function (imageFile) {
    if (!imageFile || gpsExtractionInProgress) return null;

    gpsExtractionInProgress = true;

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
        showStatus("🔍 Extracting GPS from photo...", "info");

        const res = await fetch(GPS_CONFIG.API_GPS_URL, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (res.ok && data.success && data.gps) {
            showStatus(`✅ Photo GPS: ${data.gps.lat.toFixed(6)}, ${data.gps.lon.toFixed(6)}`, "success");
            return data.gps;
        } else {
            showStatus("ℹ️ No GPS in photo. Use map/browser location.", "info");
            return null;
        }
    } catch (e) {
        console.warn("Lambda GPS extraction failed:", e);
        showStatus("ℹ️ GPS check unavailable. Use map location.", "info");
        return null;
    } finally {
        gpsExtractionInProgress = false;
    }
};

window.getBestGPS = async function (imageFile = null) {
    if (imageFile) {
        const lambdaGPS = await window.extractGPSFromLambda(imageFile);
        if (lambdaGPS) return lambdaGPS;
    }

    if (navigator.geolocation) {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }

    return null;
};
