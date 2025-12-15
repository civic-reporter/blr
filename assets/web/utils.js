// Utility functions
import { CONFIG } from './config.js';

export function isValidNumber(x) {
    return typeof x === "number" && Number.isFinite(x);
}

export function isInGBA(lat, lon) {
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
