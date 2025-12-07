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

        /* -----------------------------------------
         * ADD LEAFLET SEARCH CONTROL (OPTION 1)
         * ----------------------------------------- */
        if (L.Control.Geocoder) {
            const geocoder = L.Control.geocoder({
                defaultMarkGeocode: false,
                collapsed: true,     // shows a search icon
                placeholder: "Search…" // optional
            })
                .on("markgeocode", (e) => {
                    const result = e.geocode;

                    // Zoom to bounding box
                    if (result.bbox) {
                        this.map.fitBounds(result.bbox);
                    } else {
                        this.map.setView(result.center, 17);
                    }

                    // Add marker at result
                    L.marker(result.center)
                        .addTo(this.map)
                        .bindPopup(result.name)
                        .openPopup();
                })
                .addTo(this.map);
        } else {
            console.warn("Leaflet Control Geocoder script not loaded.");
        }

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
