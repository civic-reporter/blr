/* main.js
 * Wires events, initializes map, loads boundary, handles image uploads.
 */

window.addEventListener("DOMContentLoaded", async () => {
    // Initialize map
    const map = GBA_MAP.init();

    // Load KML boundary polygons
    await GBA_POLYGONS.loadBoundary(map);

    // File upload handler
    const input = document.getElementById("fileInput");

    input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            const dataURL = e.target.result;
            const gps = GBA_EXIF.extractGPS(dataURL);

            if (!gps) {
                GBA_UI.highlightInvalid();
                GBA_UI.showGPSOutput("No GPS data found in this image.");
                return;
            }

            const { lat, lon } = gps;

            // Boundary validation
            const inside = GBA_POLYGONS.isInside(lat, lon);

            if (!inside) {
                GBA_UI.highlightInvalid();
                GBA_UI.showGPSOutput(`GPS Location: ${lat}, ${lon} (Outside GBA)`);
            } else {
                GBA_UI.highlightValid();
                GBA_UI.showGPSOutput(`GPS Location: ${lat}, ${lon}`);
            }

            // Add marker & center map
            GBA_MAP.addMarker(lat, lon, "Photo Location");
            GBA_MAP.center(lat, lon);
        };

        reader.readAsDataURL(file);
    });
});
