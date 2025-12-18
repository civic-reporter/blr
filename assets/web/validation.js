import { CONFIG } from './config.js';
import { pointInRing, isValidNumber, loadGeoLayers } from './utils.js';

let corpPolygons = null;
let constPolygons = null;
let wardPolygons = null;

export function isInGBA(lat, lon) {
    return CONFIG.GBA_BBOX.south <= lat && lat <= CONFIG.GBA_BBOX.north &&
        CONFIG.GBA_BBOX.west <= lon && lon <= CONFIG.GBA_BBOX.east;
}

function corpHandleForName(name) {
    switch (name) {
        case "Central": return "@BCCCofficial";
        case "East": return "@EASTCITYCORP";
        case "West": return "@BWCCofficial";
        case "North": return "@BNCCofficial";
        case "South": return "@comm_blr_south";
        default: return "";
    }
}

export async function loadCorpPolygons() {
    if (corpPolygons) return corpPolygons;
    console.log('🔄 Loading corp polygons from:', CONFIG.MAP_KML_URL);
    const feats = await loadGeoLayers(CONFIG.MAP_KML_URL);
    console.log('✅ Loaded', feats.length, 'corp polygon features');
    corpPolygons = feats.map(f => {
        const p = f.props || {};
        const corpName = (p.NewCorp || p.corp || p.CORP || p.name || "").toString();
        return { corp: corpName, ring: f.ring };
    }).filter(Boolean);
    return corpPolygons;
}

export async function validateLocationForCoords(testGPS) {
    if (!testGPS || !isValidNumber(testGPS.lat) || !isValidNumber(testGPS.lon)) return false;
    try {
        const polys = await loadCorpPolygons();
        return polys.some(p => p.ring && p.ring.length >= 3 && pointInRing(testGPS.lon, testGPS.lat, p.ring));
    } catch (e) {
        console.warn("Location validation failed:", e);
        return false;
    }
}

export async function findCorpForCurrentGPS() {
    if (!window.currentGPS) return { corpName: "", corpHandle: "" };
    const polys = await loadCorpPolygons();
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { corpName: p.corp || "", corpHandle: corpHandleForName(p.corp) };
        }
    }
    return { corpName: "", corpHandle: "" };
}
