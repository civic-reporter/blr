/* map.js
 * Initializes Leaflet map, adds markers, and exposes map helpers.
 */

window.GBA_MAP = {
    map: null,
    markers: [],

    init() {
        this.map = L.map('map').setView(
            GBA_CONFIG.DEFAULT_CENTER,
            GBA_CONFIG.DEFAULT_ZOOM
        );

        L.tileLayer(GBA_CONFIG.TILE_LAYER, {
            maxZoom: 20,
        }).addTo(this.map);

        return this.map;
    },

    addMarker(lat, lon, popupText = "") {
        const marker = L.circleMarker([lat, lon], GBA_CONFIG.MARKER_ICON);
        marker.addTo(this.map);
        if (popupText) marker.bindPopup(popupText);
        this.markers.push(marker);
        return marker;
    },

    center(lat, lon, zoom = 16) {
        this.map.setView([lat, lon], zoom);
    }
};
