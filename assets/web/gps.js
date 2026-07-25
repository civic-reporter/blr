// GPS module - SYNTAX FIXED
import { getConfig } from './config.js';
import { showStatus, showLocation, updateSubmitButtonState, updateLocationConfirmVisibility } from './ui.js';

const EXIF_HEAD_BYTES = 512 * 1024;
const EXIFR_OPTIONS = { gps: true, reviveValues: true, mergeOutput: false, translateKeys: true };

function getExifr() {
    return globalThis.exifr;
}

function getPiexif() {
    return globalThis.piexif;
}

function bufferToBinary(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return binary;
}

function dmsToDecimal(value, ref) {
    if (value == null) return NaN;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
    }

    if (Array.isArray(value)) {
        const deg = Number(value[0]) || 0;
        const min = Number(value[1]) || 0;
        const sec = Number(value[2]) || 0;
        let decimal = deg + (min / 60) + (sec / 3600);
        if (ref === 'S' || ref === 'W') decimal *= -1;
        return decimal;
    }

    return NaN;
}

function normalizeGpsResult(result) {
    if (!result) return null;

    if (typeof result.lat === 'number' && typeof result.lon === 'number') {
        return normalizeGpsResult({ latitude: result.lat, longitude: result.lon });
    }

    const latRef = result.GPSLatitudeRef || result.latitudeRef;
    const lonRef = result.GPSLongitudeRef || result.longitudeRef;

    let lat = Number(
        result.latitude ??
        result.lat ??
        result.GPSLatitude ??
        result[0]
    );
    let lon = Number(
        result.longitude ??
        result.lon ??
        result.GPSLongitude ??
        result[1]
    );

    if (!Number.isFinite(lat) && (result.GPSLatitude || Array.isArray(result.latitude))) {
        lat = dmsToDecimal(result.GPSLatitude || result.latitude, latRef);
    }
    if (!Number.isFinite(lon) && (result.GPSLongitude || Array.isArray(result.longitude))) {
        lon = dmsToDecimal(result.GPSLongitude || result.longitude, lonRef);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    return { lat, lon };
}

function parseExifGps(exif) {
    const piexif = getPiexif();
    if (!exif || !piexif) return null;

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

async function readFileBuffer(file) {
    if (!file) return null;

    try {
        if (typeof file.arrayBuffer === 'function') {
            return await file.arrayBuffer();
        }
    } catch (e) {
        console.warn('file.arrayBuffer failed, retrying via FileReader:', e);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractGpsWithExifr(fileOrBlob, buffer) {
    const exifr = getExifr();
    if (!exifr || (!fileOrBlob && !buffer)) return null;

    const inputs = [];
    if (buffer) inputs.push(buffer);
    if (fileOrBlob && fileOrBlob !== buffer) inputs.push(fileOrBlob);

    const attempts = [];
    for (const input of inputs) {
        attempts.push(
            () => exifr.gps(input),
            () => exifr.parse(input, EXIFR_OPTIONS),
            () => exifr.parse(input, { ...EXIFR_OPTIONS, tiff: true, ifd0: false, exif: true }),
            () => exifr.parse(input, { ...EXIFR_OPTIONS, mergeOutput: true })
        );
    }

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
    const piexif = getPiexif();
    if (!buffer || !piexif) return null;

    try {
        return parseExifGps(piexif.load(bufferToBinary(buffer)));
    } catch (e) {
        return null;
    }
}

async function extractGpsWithPiexif(file, buffer) {
    const piexif = getPiexif();
    if (!piexif) return null;

    try {
        if (buffer) {
            const headBuffer = buffer.byteLength > EXIF_HEAD_BYTES
                ? buffer.slice(0, EXIF_HEAD_BYTES)
                : buffer;
            let gps = await extractGpsWithPiexifFromBuffer(headBuffer);
            if (gps) return gps;

            if (buffer.byteLength > EXIF_HEAD_BYTES) {
                gps = await extractGpsWithPiexifFromBuffer(buffer);
                if (gps) return gps;
            }
        }

        if (file && typeof file.slice === 'function') {
            const headBuffer = await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer();
            let gps = await extractGpsWithPiexifFromBuffer(headBuffer);
            if (gps) return gps;

            if (file.size > EXIF_HEAD_BYTES) {
                gps = await extractGpsWithPiexifFromBuffer(await readFileBuffer(file));
            }
            if (gps) return gps;
        }
    } catch (e) {
        console.warn('piexif GPS parse failed:', e);
    }

    return null;
}

async function readExifGpsFromFile(file) {
    if (!file) return null;

    const buffer = await readFileBuffer(file);
    const exifrGps = await extractGpsWithExifr(file, buffer);
    if (exifrGps) return exifrGps;

    return extractGpsWithPiexif(file, buffer);
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
        const piexif = getPiexif();
        if (piexif) {
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
