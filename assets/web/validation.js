import { getConfig } from './config.js';
import { pointInRing, isValidNumber, loadGeoLayers } from './utils.js';

let CONFIG = null;

let corpPolygons = null;
let constPolygons = null;
let wardPolygons = null;
let oldWardPolygons = null;

const EMPTY_WARD = { wardNo: "", wardName: "", oldWardNo: "", oldWardName: "" };

function normalizeWardNo(raw) {
    if (!raw) return "";
    const n = parseFloat(String(raw).trim());
    return Number.isFinite(n) ? String(Math.round(n)) : String(raw).trim();
}

function ringFromPlacemark(pm) {
    const coordsNode = pm.getElementsByTagName("coordinates")[0];
    if (!coordsNode) return null;
    return coordsNode.textContent.trim()
        .split(/\s+/)
        .map(pair => pair.split(",").map(Number))
        .map(([lon, lat]) => [lon, lat]);
}

function findWardInPolygons(polys, lon, lat) {
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { wardNo: p.wardNo, wardName: p.wardName };
        }
    }
    return { wardNo: "", wardName: "" };
}

export function isInGBA(lat, lon) {
    return CONFIG.GBA_BBOX.south <= lat && lat <= CONFIG.GBA_BBOX.north &&
        CONFIG.GBA_BBOX.west <= lon && lon <= CONFIG.GBA_BBOX.east;
}

function corpHandleForName(name) {
    switch (name) {
        case "Central": return "@BCCCofficial";
        case "East": return "@BECCUPDATES";
        case "West": return "@BWCCofficial";
        case "North": return "@BNCCofficial";
        case "South": return "@comm_blr_south";
        default: return "";
    }
}

export async function loadCorpPolygons() {
    if (corpPolygons) return corpPolygons;
    if (!CONFIG) CONFIG = await getConfig();
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

export async function loadWardPolygons() {
    if (wardPolygons !== null) return wardPolygons;
    try {
        if (!CONFIG) CONFIG = await getConfig();
        const res = await fetch(CONFIG.WARD_KML_URL);
        if (!res.ok) return wardPolygons = [];
        const kmlText = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, "application/xml");
        const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
        wardPolygons = placemarks.map(pm => {
            const simpleData = pm.getElementsByTagName("SimpleData");
            let wardNo = "", wardName = "";
            for (const sd of simpleData) {
                const nameAttr = sd.getAttribute("name");
                if (nameAttr === "ward_id") wardNo = normalizeWardNo(sd.textContent);
                else if (nameAttr === "ward_name") wardName = sd.textContent.trim();
            }
            const ring = ringFromPlacemark(pm);
            if (!ring) return null;
            return { wardNo, wardName, ring };
        }).filter(Boolean);
        return wardPolygons;
    } catch (e) {
        console.warn("Ward polygons failed:", e);
        return wardPolygons = [];
    }
}

export async function loadOldWardPolygons() {
    if (oldWardPolygons !== null) return oldWardPolygons;
    try {
        if (!CONFIG) CONFIG = await getConfig();
        if (!CONFIG.OLD_WARD_KML_URL) return oldWardPolygons = [];
        const res = await fetch(CONFIG.OLD_WARD_KML_URL);
        if (!res.ok) return oldWardPolygons = [];
        const kmlText = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, "application/xml");
        const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
        oldWardPolygons = placemarks.map(pm => {
            const simpleData = pm.getElementsByTagName("SimpleData");
            let wardNo = "", wardName = "";
            for (const sd of simpleData) {
                const nameAttr = sd.getAttribute("name");
                if (nameAttr === "WARD_NO") wardNo = normalizeWardNo(sd.textContent);
                else if (nameAttr === "WARD_NAME") wardName = sd.textContent.trim();
            }
            const ring = ringFromPlacemark(pm);
            if (!ring) return null;
            return { wardNo, wardName, ring };
        }).filter(Boolean);
        return oldWardPolygons;
    } catch (e) {
        console.warn("Old ward polygons failed:", e);
        return oldWardPolygons = [];
    }
}

export async function findWardForCurrentGPS() {
    if (!window.currentGPS) return { ...EMPTY_WARD };
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;
    const [newPolys, oldPolys] = await Promise.all([
        loadWardPolygons(),
        loadOldWardPolygons()
    ]);
    const newWard = findWardInPolygons(newPolys, lon, lat);
    const oldWard = findWardInPolygons(oldPolys, lon, lat);
    return {
        wardNo: newWard.wardNo,
        wardName: newWard.wardName,
        oldWardNo: oldWard.wardNo,
        oldWardName: oldWard.wardName
    };
}
