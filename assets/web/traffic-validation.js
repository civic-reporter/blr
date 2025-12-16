// Traffic PS Validation - loads traffic police station boundaries from blr-traffic.kml
import { CONFIG } from './config.js';
import { pointInRing, isValidNumber, loadGeoLayers } from './utils.js';

let trafficPSPolygons = null;

export async function loadTrafficPSPolygons() {
    if (trafficPSPolygons) return trafficPSPolygons;

    try {
        const feats = await loadGeoLayers(CONFIG.TRAFFIC_KML_URL);
        trafficPSPolygons = feats.map(f => {
            const p = f.props || {};
            // Extract traffic PS name and code from properties
            const trafficPS = (p.Traffic_PS || p.traffic_ps || p.name || "").toString();
            const psName = (p.PS_BOUNDName || p.ps_boundname || "").toString();
            const psCode = (p.PS_BOUNDCode || p.ps_boundcode || "").toString();
            return { trafficPS, psName, psCode, ring: f.ring };
        }).filter(Boolean);
        console.log("✅ Loaded", trafficPSPolygons.length, "traffic PS boundaries");
        return trafficPSPolygons;
    } catch (e) {
        console.warn("Failed to load traffic PS polygons:", e);
        return trafficPSPolygons = [];
    }
}

export async function findTrafficPSForLocation() {
    if (!window.currentGPS) return { trafficPS: "", psName: "" };

    const polys = await loadTrafficPSPolygons();
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;

    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { trafficPS: p.trafficPS, psName: p.psName, psCode: p.psCode };
        }
    }

    return { trafficPS: "", psName: "" };
}

export async function validateLocationForTraffic(testGPS) {
    if (!testGPS || !isValidNumber(testGPS.lat) || !isValidNumber(testGPS.lon)) return false;
    try {
        const polys = await loadTrafficPSPolygons();
        return polys.some(p => p.ring && p.ring.length >= 3 && pointInRing(testGPS.lon, testGPS.lat, p.ring));
    } catch (e) {
        console.warn("Traffic location validation failed:", e);
        return false;
    }
}
