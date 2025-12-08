/* config.js
 * Global constants & configuration for GBA Civic Reporter
 */

window.GBA_CONFIG = {
    DEFAULT_CENTER: [12.9716, 77.5946],  // Bengaluru
    DEFAULT_ZOOM: 11,

    TILE_LAYER: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

    // Optional KML boundary for validation
    BOUNDARY_KML_URL: "assets/data/map.kml",  // Change if needed

    MARKER_ICON: {
        radius: 6,
        color: "#ff0000",
        fillColor: "#ff6666",
        fillOpacity: 0.9,
    }
};
