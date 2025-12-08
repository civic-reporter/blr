/* ui.js
 * Reusable UI helpers for the GBA Civic Reporter.
 */

window.GBA_UI = {
    showGPSOutput(text) {
        const box = document.getElementById("gpsOutput");
        box.style.display = "block";
        box.textContent = text;
    },

    hideGPSOutput() {
        const box = document.getElementById("gpsOutput");
        box.style.display = "none";
        box.textContent = "";
    },

    alertError(msg) {
        alert(msg);
    },

    highlightInvalid() {
        const box = document.getElementById("gpsOutput");
        box.style.background = "#ffe6e6";
        box.style.borderLeft = "4px solid #cc0000";
    },

    highlightValid() {
        const box = document.getElementById("gpsOutput");
        box.style.background = "#e6ffec";
        box.style.borderLeft = "4px solid #00aa44";
    }
};
