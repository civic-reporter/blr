// GPS module - SYNTAX FIXED
import { getConfig } from './config.js';
import { showStatus, showLocation, updateSubmitButtonState, updateLocationConfirmVisibility } from './ui.js';
import { validateLocationForCoords } from './validation.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

const EXIF_HEAD_BYTES = 512 * 1024;
const EXIFR_OPTIONS = { gps: true, reviveValues: true, mergeOutput: false, translateKeys: true };

function notifyCivicLocationUpdated() {
    window.dispatchEvent(new CustomEvent('civicLocationUpdated'));
}

// Why the photo did or did not yield coordinates. Drives the location panel copy,
// which has to explain platform behaviour the parser cannot work around.
export const GPS_SOURCE = {
    NONE: 'none',
    PHOTO: 'photo',
    LIVE: 'live',
    MANUAL: 'manual',
    STRIPPED: 'stripped',
    NO_LOCATION_TAG: 'no-location-tag',
    OUTSIDE_BOUNDARY: 'outside-boundary'
};

let gpsSource = GPS_SOURCE.NONE;

function setGpsSource(source) {
    gpsSource = source;
    window.gpsSource = source;
    document.dispatchEvent(new CustomEvent('civic:gps-source', { detail: { source } }));
}

export function getGpsSource() {
    return gpsSource;
}

export function resetGpsSource() {
    setGpsSource(GPS_SOURCE.NONE);
}

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

    // exifr nests the GPS block when mergeOutput is disabled.
    if (result.gps && typeof result.gps === 'object') {
        const nested = normalizeGpsResult(result.gps);
        if (nested) return nested;
    }

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

// Distinguishes "the picker handed us a metadata-free copy" from "the camera never
// recorded a location", which need very different advice.
async function hasAnyExifMetadata(fileOrBuffer) {
    const exifr = getExifr();
    if (!exifr || !fileOrBuffer) return false;

    try {
        const meta = await exifr.parse(fileOrBuffer, {
            tiff: true,
            ifd0: true,
            exif: true,
            mergeOutput: true
        });
        return !!meta && Object.keys(meta).length > 0;
    } catch (e) {
        console.warn('EXIF presence check failed:', e);
        return false;
    }
}

async function readExifFromFile(file) {
    if (!file) return { gps: null, hasExif: false };

    // Blob first: exifr streams just the header chunk out of it, whereas an
    // ArrayBuffer forces the whole photo into memory. Phone photos run to 10MB+.
    let gps = await extractGpsWithExifr(file, null) ||
        await extractGpsWithPiexif(file, null);
    if (gps) return { gps, hasExif: true };

    let buffer = null;
    try {
        buffer = await readFileBuffer(file);
    } catch (e) {
        console.warn('Could not read file into a buffer for EXIF:', e);
    }

    if (buffer) {
        gps = await extractGpsWithExifr(null, buffer) ||
            await extractGpsWithPiexif(null, buffer);
        if (gps) return { gps, hasExif: true };
    }

    return { gps: null, hasExif: await hasAnyExifMetadata(file) };
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
    setGpsSource(GPS_SOURCE.MANUAL);
    updateLocationConfirmVisibility();
}

// Live GPS is the device's location, not the photo's, so it still needs the
// "does this pin match the photo?" confirmation that manual pins get.
export function markLiveGps() {
    window.gpsFromPhotoExif = false;
    window.gpsManuallySet = true;
    setGpsSource(GPS_SOURCE.LIVE);
    updateLocationConfirmVisibility();
}

async function applyExtractedGps(lat, lon) {
    if (!(await isInGbaBbox(lat, lon))) {
        window.currentGPS = null;
        window.gpsFromPhotoExif = false;
        setGpsSource(GPS_SOURCE.OUTSIDE_BOUNDARY);
        showStatus(`❌ ${t('gpsOutsideBoundary', getCurrentLanguage())}`, "error");
        showLocation();
        updateSubmitButtonState();
        updateLocationConfirmVisibility();
        return null;
    }

    window.currentGPS = { lat, lon };
    window.gpsFromPhotoExif = true;
    window.gpsManuallySet = false;
    setGpsSource(GPS_SOURCE.PHOTO);
    updateSubmitButtonState();
    updateLocationConfirmVisibility();
    notifyCivicLocationUpdated();
    // The location panel says the same thing, but it lives in step 2. This is the
    // only confirmation visible while the user is still on the photo step.
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
    const { gps, hasExif } = await readExifFromFile(file);

    if (!gps) {
        console.warn('⚠️ No GPS metadata found in uploaded file (hasExif:', hasExif, ')');
        setGpsSource(hasExif ? GPS_SOURCE.NO_LOCATION_TAG : GPS_SOURCE.STRIPPED);
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

function readCurrentPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ ok: false, reason: 'unsupported' });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
                ok: true,
                coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
                accuracy: pos.coords.accuracy
            }),
            (err) => resolve({
                ok: false,
                reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
            }),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    });
}

function isValidCoordinatePair(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) &&
        Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function parseCoordinateInput(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    const labeled = trimmed.match(
        /lat(?:itude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)[^\d-]+lon(?:gitude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
    );
    if (labeled) {
        const lat = parseFloat(labeled[1]);
        const lon = parseFloat(labeled[2]);
        if (isValidCoordinatePair(lat, lon)) return { lat, lon };
    }

    const decimal = trimmed.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
    if (decimal) {
        const lat = parseFloat(decimal[1]);
        const lon = parseFloat(decimal[2]);
        if (isValidCoordinatePair(lat, lon)) return { lat, lon };
    }

    return null;
}

export async function applyPastedCoordinates(text) {
    const coords = parseCoordinateInput(text);
    if (!coords) {
        return { ok: false, reason: 'invalid' };
    }

    const { lat, lon } = coords;
    if (!(await isInGbaBbox(lat, lon))) {
        return { ok: false, reason: 'outside' };
    }

    if (!(await validateLocationForCoords(coords))) {
        return { ok: false, reason: 'outside' };
    }

    window.currentGPS = { lat, lon };
    markManualGps();

    if (window.map) {
        window.map.setView([lat, lon], 17);
        if (window.placeMarker) window.placeMarker();
    }

    showLocation();
    updateSubmitButtonState();
    updateLocationConfirmVisibility();
    notifyCivicLocationUpdated();

    if (window.updateReportPreview) window.updateReportPreview();
    if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
    if (window.isCivicFlow && window.updateCivicEmailRecipients) {
        window.updateCivicEmailRecipients();
    }

    return { ok: true, coords: { lat, lon } };
}

export async function getLiveGPSIfInGBA() {
    console.log("📍 Live GPS fallback...");
    const result = await readCurrentPosition();
    if (!result.ok) return null;
    return (await isInGbaBbox(result.coords.lat, result.coords.lon)) ? result.coords : null;
}

// Triggered only by the user pressing "use my current location", so a denied
// permission prompt is meaningful feedback rather than a silent failure.
export async function requestLiveGpsFromUser() {
    const result = await readCurrentPosition();

    if (!result.ok) {
        return { ok: false, reason: result.reason };
    }

    const { lat, lon } = result.coords;
    if (!(await isInGbaBbox(lat, lon))) {
        return { ok: false, reason: 'outside' };
    }

    window.currentGPS = { lat, lon };
    markLiveGps();

    if (window.map) {
        window.map.setView([lat, lon], 17);
        if (window.placeMarker) window.placeMarker();
    }

    showLocation();
    updateSubmitButtonState();
    updateLocationConfirmVisibility();
    notifyCivicLocationUpdated();

    if (window.updateReportPreview) window.updateReportPreview();
    if (window.updateCivicWhatsAppOption) window.updateCivicWhatsAppOption();
    if (window.isCivicFlow && window.updateCivicEmailRecipients) {
        window.updateCivicEmailRecipients();
    }

    return { ok: true, coords: { lat, lon }, accuracy: result.accuracy };
}
