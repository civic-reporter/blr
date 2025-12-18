import { getConfig } from './config.js';

let CONFIG = null;

export function isValidNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
}

export async function isInGBA(lat, lon) {
    if (!CONFIG) CONFIG = await getConfig();
    return CONFIG.GBA_BBOX.south <= lat && lat <= CONFIG.GBA_BBOX.north &&
        CONFIG.GBA_BBOX.west <= lon && CONFIG.GBA_BBOX.east;
}

export function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export async function compressImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            const size = Math.min(1024 / img.width, 1024 / img.height, 1);
            canvas.width = img.width * size;
            canvas.height = img.height * size;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        };
        img.src = URL.createObjectURL(file);
    });
}

// Load polygon features from either GeoJSON or KML, returning a unified shape.
// Output: Array of { ring: Array<[lon, lat]>, props: Record<string, string|number> }
export async function loadGeoLayers(url) {
    console.log('📍 Loading geo layer from:', url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error('❌ Failed to load geo layer:', url, 'Status:', res.status);
        throw new Error(`Failed to load: ${url} (${res.status})`);
    }
    console.log('✅ Geo layer loaded successfully:', url);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Prefer JSON path by extension or content-type
    const looksJson = /json/.test(contentType) || /\.geojson$|\.json$/i.test(url);
    if (looksJson) {
        const gj = await res.json();
        const features = Array.isArray(gj.features) ? gj.features : [];
        const out = [];
        for (const f of features) {
            const g = f && f.geometry;
            if (!g || !g.type || !g.coordinates) continue;
            const props = f.properties || {};
            if (g.type === 'Polygon') {
                const outer = g.coordinates && g.coordinates[0];
                if (Array.isArray(outer) && outer.length >= 3) out.push({ ring: outer.map(([x, y]) => [x, y]), props });
            } else if (g.type === 'MultiPolygon') {
                for (const poly of g.coordinates || []) {
                    const outer = poly && poly[0];
                    if (Array.isArray(outer) && outer.length >= 3) out.push({ ring: outer.map(([x, y]) => [x, y]), props });
                }
            }
        }
        return out;
    }

    const kmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, 'application/xml');
    const placemarks = Array.from(xml.getElementsByTagName('Placemark'));
    const out = [];
    for (const pm of placemarks) {
        const props = {};
        const simple = pm.getElementsByTagName('SimpleData');
        for (const sd of simple) {
            const key = sd.getAttribute('name') || '';
            if (key) props[key] = sd.textContent ? sd.textContent.trim() : '';
        }
        const coordsNode = pm.getElementsByTagName('coordinates')[0];
        if (!coordsNode) continue;
        const ring = coordsNode.textContent.trim()
            .split(/\s+/)
            .map(pair => pair.split(',').map(Number))
            .map(([lon, lat]) => [lon, lat]);
        if (ring.length >= 3) out.push({ ring, props });
    }
    return out;
}
