import { CONFIG } from './config.js';
import { pointInRing } from './utils.js';
import { CONFIG as config } from './config.js';

let corpPolygons = null;
let constPolygons = null;
let wardPolygons = null;

export function isInGBA(lat, lon) {
    return CONFIG.GBA_BBOX.south <= lat && lat <= CONFIG.GBA_BBOX.north &&
        CONFIG.GBA_BBOX.west <= lon && CONFIG.GBA_BBOX.east;
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
    const res = await fetch(CONFIG.MAP_KML_URL);
    if (!res.ok) throw new Error("map.kml not found");
    const kmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
    corpPolygons = placemarks.map(pm => {
        const simpleData = pm.getElementsByTagName("SimpleData");
        let corpName = "";
        for (const sd of simpleData) {
            if (sd.getAttribute("name") === "NewCorp") {
                corpName = sd.textContent.trim();
            }
        }
        const coordsNode = pm.getElementsByTagName("coordinates")[0];
        if (!coordsNode) return null;
        const ring = coordsNode.textContent.trim()
            .split(/\s+/)
            .map(pair => pair.split(",").map(Number))
            .map(([lon, lat]) => [lon, lat]);
        return { corp: corpName, ring };
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
