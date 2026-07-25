// GPS module - SYNTAX FIXED
import { getConfig } from './config.js';
import { showStatus, showLocation, updateSubmitButtonState, updateLocationConfirmVisibility } from './ui.js';

const EXIF_HEAD_BYTES = 512 * 1024;
const EXIFR_OPTIONS = { gps: true, reviveValues: true, mergeOutput: false };

function bufferToBinary(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return binary;
}

function normalizeGpsResult(result) {
    if (!result) return null;

    const lat = Number(
        result.latitude ??
        result.lat ??
        result.GPSLatitude ??
        result[0]
    );
    const lon = Number(
        result.longitude ??
        result.lon ??
        result.GPSLongitude ??
        result[1]
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    return { lat, lon };
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

async function extractGpsWithExifr(fileOrBlob) {
    if (typeof exifr === 'undefined' || !fileOrBlob) return null;

    const attempts = [
        () => exifr.gps(fileOrBlob),
        () => exifr.parse(fileOrBlob, EXIFR_OPTIONS),
        () => exifr.parse(fileOrBlob, { ...EXIFR_OPTIONS, tiff: true, ifd0: false, exif: true })
    ];

    for (const attempt of attempts) {
        try {
            const result = await attempt();
            const gps = normalizeGpsResult(result);
            if (gps) {
                console.log('✅ exifr GPS parsed:', gps.lat.toFixed(5), gps.lon.toFixed(5));
                return gps;
            }
        } catch (e) {
            console.warn('exifr GPS parse attempt failed:', e);
        }
    }

    return null;
}

async function extractGpsWithPiexifFromBuffer(buffer) {
    if (!buffer || typeof piexif === 'undefined') return null;

    try {
        return parseExifGps(piexif.load(bufferToBinary(buffer)));
    } catch (e) {
        return null;
    }
}

async function extractGpsWithPiexif(file) {
    if (!file || typeof piexif === 'undefined') return null;

    try {
        const headBuffer = await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer();
        let gps = await extractGpsWithPiexifFromBuffer(headBuffer);
        if (gps) return gps;

        if (file.size > EXIF_HEAD_BYTES) {
            gps = await extractGpsWithPiexifFromBuffer(await file.arrayBuffer());
        }
    } catch (e) {
        console.warn('piexif GPS parse failed:', e);
    }

    return null;
}

async function readExifGpsFromFile(file) {
    if (!file) return null;

    const exifrGps = await extractGpsWithExifr(file);
    if (exifrGps) return exifrGps;

    return extractGpsWithPiexif(file);
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
        updateSubmitButtonState();
        updateLocationConfirmVisibility();
        return null;
    }

    window.currentGPS = { lat, lon };
    window.gpsFromPhotoExif = true;
    window.gpsManuallySet = false;
    updateSubmitButtonState();
    updateLocationConfirmVisibility();
    showStatus(`✅ Photo GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");

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
    if (!file) return null;

    console.log('🔍 EXIF parse from file:', file.name, file.type, file.size);
    const gps = await readExifGpsFromFile(file);
    if (!gps) {
        console.warn('⚠️ No GPS metadata found in uploaded file');
        return null;
    }

    return applyExtractedGps(gps.lat, gps.lon);
}

export async function extractGPSFromExif(dataUrl) {
    console.log("🔍 EXIF parse from data URL fallback");

    try {
        if (typeof piexif !== 'undefined') {
            const gps = parseExifGps(piexif.load(dataUrl));
            if (gps) {
                return applyExtractedGps(gps.lat, gps.lon);
            }
        }
    } catch (e) {
        console.error("🚨 EXIF data URL parse error:", e);
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
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    });
}
