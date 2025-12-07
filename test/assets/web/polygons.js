/* polygons.js
 * Loads KML boundary polygons & checks if a point is inside Bengaluru GBA zone.
 */

window.GBA_POLYGONS = {
    boundaryLayer: null,
    boundaryPolygons: [],

    /* Load KML file and convert to Leaflet layers */
    async loadBoundary(map) {
        try {
            const response = await fetch(GBA_CONFIG.BOUNDARY_KML_URL);
            const text = await response.text();

            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "text/xml");
            const placemarks = xml.getElementsByTagName("Placemark");

            this.boundaryPolygons = [];

            for (let pm of placemarks) {
                const coords = pm.getElementsByTagName("coordinates")[0];
                if (!coords) continue;

                const raw = coords.textContent.trim().split(" ");
                const latlngs = raw.map((c) => {
                    const [lon, lat] = c.split(",").map(Number);
                    return [lat, lon];
                });

                const polygon = L.polygon(latlngs, { color: "#0066cc", weight: 2, fillOpacity: 0.1 });
                polygon.addTo(map);
                this.boundaryPolygons.push(polygon);
            }

        } catch (err) {
            console.error("KML Load Error", err);
        }
    },

    /* Check if a point lies inside any polygon */
    isInside(lat, lon) {
        if (!this.boundaryPolygons.length) return true; // No boundary loaded

        const point = L.latLng(lat, lon);
        return this.boundaryPolygons.some(poly => poly.getBounds().contains(point));
    }
};
