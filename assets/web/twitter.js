import { getConfig, getMlaHandles } from './config.js';
import { findCorpForCurrentGPS } from './validation.js';

let CONFIG = null;
let MLA_HANDLES = null;
import { showStatus, showSuccessScreen, updateTweetButtonState } from './ui.js';
import { isValidNumber, isInGBA, pointInRing, loadGeoLayers } from './utils.js';

let wardPolygons = null;
let constPolygons = null;

async function loadWardPolygons() {
    if (wardPolygons !== null) return wardPolygons;
    try {
        if (!CONFIG) CONFIG = await getConfig();
        const feats = await loadGeoLayers(CONFIG.WARD_KML_URL);
        wardPolygons = feats.map(f => {
            const p = f.props || {};
            const wardNo = (p.ward_id || p.WARD_ID || p.wardNo || "").toString();
            const wardName = (p.ward_name || p.WARD_NAME || p.name || "").toString();
            return { wardNo, wardName, ring: f.ring };
        }).filter(Boolean);
        return wardPolygons;
    } catch (e) {
        console.warn("Ward polygons failed:", e);
        return wardPolygons = [];
    }
}

async function findWardForCurrentGPS() {
    if (!window.currentGPS) return { wardNo: "", wardName: "" };
    const polys = await loadWardPolygons();
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { wardNo: p.wardNo, wardName: p.wardName };
        }
    }
    return { wardNo: "", wardName: "" };
}

async function loadConstituencyPolygons() {
    if (constPolygons !== null) return constPolygons;
    try {
        if (!CONFIG) CONFIG = await getConfig();
        const feats = await loadGeoLayers(CONFIG.CONST_KML_URL);
        constPolygons = feats.map(f => {
            const p = f.props || {};
            const acName = (p.AC_NAME || p.ac_name || p.name || "").toString();
            return { acName, ring: f.ring };
        }).filter(Boolean);
        return constPolygons;
    } catch (e) {
        console.warn("Constituency polygons failed:", e);
        return constPolygons = [];
    }
}

async function findConstituencyForCurrentGPS() {
    if (!window.currentGPS) return { acName: "", mlaHandle: "" };
    if (!MLA_HANDLES) MLA_HANDLES = await getMlaHandles();
    const polys = await loadConstituencyPolygons();
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            const handleUser = MLA_HANDLES[p.acName] || "";
            const handle = handleUser ? "@" + handleUser : "";
            return { acName: p.acName, mlaHandle: handle };
        }
    }
    return { acName: "", mlaHandle: "" };
}

export async function shareToGBA() {
    if (!window.currentGPS || !isValidNumber(window.currentGPS.lat) || !isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        showStatus("❌ Location must be inside GBA boundary.", "error");
        return;
    }
    if (!window.currentImageFile) {
        showStatus("❌ Please upload an image first.", "error");
        return;
    }

    // Validate issue type selection
    const issueType = document.getElementById("issueType")?.value;
    if (!issueType) {
        showStatus("❌ Please select an issue type.", "error");
        return;
    }

    if (window.tweetBtn) {
        window.tweetBtn.disabled = true;
        window.tweetBtn.textContent = "Posting...";
        window.tweetBtn.classList.add("loading");
    }
    showStatus("📤 Uploading issue to @zenc_civic...", "info");

    await new Promise(resolve => requestAnimationFrame(resolve));

    const desc = document.getElementById("issueDesc")?.value.trim() || "";

    const [
        { acName, mlaHandle },
        { corpName, corpHandle },
        { wardNo, wardName }
    ] = await Promise.all([
        findConstituencyForCurrentGPS(),
        findCorpForCurrentGPS(),
        findWardForCurrentGPS()
    ]);

    const formData = new FormData();
    formData.append("image", window.currentImageFile);
    formData.append("lat", window.currentGPS.lat.toFixed(6));
    formData.append("lon", window.currentGPS.lon.toFixed(6));
    formData.append("issueType", issueType);
    formData.append("description", desc);
    formData.append("corpHandle", corpHandle || "");
    formData.append("corpName", corpName || "");
    formData.append("wardNo", wardNo || "");
    formData.append("wardName", wardName || "");
    formData.append("constituency", acName);
    formData.append("mlaHandle", mlaHandle);

    let wasSuccess = false;

    try {
        if (!CONFIG) CONFIG = await getConfig();
        const res = await fetch(CONFIG.API_GATEWAY_URL, { method: "POST", body: formData });
        const raw = await res.text();
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            throw new Error("Bad JSON from API: " + raw.slice(0, 200));
        }

        if (res.ok && data.success) {
            wasSuccess = true;
            const url = data.tweetUrl || data.tweet_url || "";

            ['uploadOptions', 'locationInfo', 'imageConfirm', 'tweetBtnContainer'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            document.querySelectorAll('.form-group').forEach(el => el.style.display = 'none');
            const mapEl = document.getElementById('map');
            if (mapEl) mapEl.style.display = 'none';

            window.currentImageFile = null;
            window.currentGPS = null;
            const issueTypeEl = document.getElementById('issueType');
            const issueDescEl = document.getElementById('issueDesc');
            if (issueTypeEl) issueTypeEl.value = '';
            if (issueDescEl) issueDescEl.value = '';
            const previewEl = document.getElementById("preview");
            if (previewEl) previewEl.src = '';
            const confirmEl = document.getElementById("confirmImageCheck");
            if (confirmEl) confirmEl.checked = false;
            const searchWrapper = document.getElementById('gbaSearchWrapper');
            if (searchWrapper) searchWrapper.style.display = 'none';

            showStatus("", "");
            showSuccessScreen();

            if (url && document.getElementById("tweetLinkContainer")) {
                document.getElementById("tweetLinkContainer").innerHTML = `
                    <p class="map-message">Tweet posted! <a href="${url}" target="_blank">View on X</a></p>
                    <button id="copyTweetBtn" class="copy-btn">📋 Copy Tweet URL</button>
                `;
                setTimeout(() => {
                    const copyBtn = document.getElementById('copyTweetBtn');
                    if (copyBtn) {
                        copyBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(url).then(() => {
                                copyBtn.textContent = '✅ Copied!';
                                setTimeout(() => copyBtn.textContent = '📋 Copy Tweet URL', 2000);
                            });
                        });
                    }
                }, 50);
            }
            return;
        } else {
            const tryAgainText = getTryAgainButtonText();
            showStatus(`❌ Failed to post: ${data.message || data.error || res.status}<br>${tryAgainText}`, "error");
            attachRetryHandler();
        }
    } catch (e) {
        const tryAgainText = getTryAgainButtonText();
        showStatus(`❌ Submission failed: ${e.message}<br>${tryAgainText}`, "error");
        attachRetryHandler();
        console.error("Post error:", e);
    } finally {
        const tweetContainer = document.getElementById('tweetBtnContainer');
        const successVisible = document.getElementById("successScreen") &&
            document.getElementById("successScreen").style.display === 'block';

        if (!wasSuccess && window.tweetBtn && tweetContainer && tweetContainer.style.display !== 'none' && !successVisible) {
            window.tweetBtn.classList.remove("loading");
            window.tweetBtn.textContent = "🚨 Post Issue via @zenc_civic";
            window.tweetBtn.disabled = false;
            updateTweetButtonState();
        }
    }
}

function getTryAgainButtonText() {
    const lang = localStorage.getItem('language') || 'en';
    const text = lang === 'kn' ? 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' : 'Try Again';
    return `<button id="errorRetryBtn" class="upload-btn" style="margin-top:10px">🔁 ${text}</button>`;
}

function attachRetryHandler() {
    setTimeout(() => {
        const retryBtn = document.getElementById('errorRetryBtn');
        console.log('Retry button found:', retryBtn);
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                console.log('Retry button clicked - keeping image and GPS');

                // Hide the retry button
                retryBtn.remove();

                // Clear error status and reset tweet button
                showStatus('📸 Ready to submit', 'info');

                // Re-enable tweet button
                if (window.tweetBtn) {
                    window.tweetBtn.disabled = false;
                    window.tweetBtn.textContent = '🐦 Report to @zenc_civic';
                    window.tweetBtn.classList.remove('loading');
                }

                updateTweetButtonState();
            });
        }
    }, 100);
}
