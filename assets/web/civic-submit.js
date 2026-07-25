import { getConfig, getMlaHandles } from './config.js';
import { findCorpForCurrentGPS, findWardForCurrentGPS } from './validation.js';

let CONFIG = null;
let MLA_HANDLES = null;
import { showStatus, showSuccessScreen, updateSubmitButtonState } from './ui.js';
import { isValidNumber, pointInRing, loadGeoLayers } from './utils.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

let constPolygons = null;

// Constituency names in const.kml do not always match mlaHandles keys exactly.
const AC_NAME_ALIASES = {
    "Yeshwanthapura": "Yeshwanthpur",
    "Vijayanagar": "Vijayanagara",
    "Govindarajanagar": "Govindaraja Nagar",
    "Chamrajapet": "Chamrajpet",
    "Padmanabanagar": "Padmanabhanagar",
    "Bangalore South": "Bengaluru South",
    "C.V. RamannNagar": "C. V. Raman Nagar"
};

function lookupMlaHandle(acName) {
    if (!acName || !MLA_HANDLES) return "";
    const handleUser = MLA_HANDLES[acName] || MLA_HANDLES[AC_NAME_ALIASES[acName]] || "";
    return handleUser ? "@" + handleUser : "";
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

export async function findConstituencyForCurrentGPS() {
    if (!window.currentGPS) return { acName: "", mlaHandle: "" };
    if (!MLA_HANDLES) MLA_HANDLES = await getMlaHandles();
    const polys = await loadConstituencyPolygons();
    const lon = window.currentGPS.lon, lat = window.currentGPS.lat;
    for (const p of polys) {
        if (p.ring && p.ring.length >= 3 && pointInRing(lon, lat, p.ring)) {
            return { acName: p.acName, mlaHandle: lookupMlaHandle(p.acName) };
        }
    }
    return { acName: "", mlaHandle: "" };
}

export async function shareToGBA() {
    const lang = getCurrentLanguage();
    const { isWhatsAppEnabled, shareViaWhatsApp, formatWhatsAppHint, getWhatsAppDisplayNumber } = await import('./civic-whatsapp.js');

    if (!(await isWhatsAppEnabled())) {
        showStatus(`❌ ${t('whatsappDisabled', lang)}`, "error");
        return;
    }

    if (!window.currentGPS || !isValidNumber(window.currentGPS.lat) || !isValidNumber(window.currentGPS.lon)) {
        showStatus("❌ Location must be inside GBA boundary.", "error");
        return;
    }
    if (!window.currentImageFile) {
        showStatus("❌ Please upload an image first.", "error");
        return;
    }

    const issueType = document.getElementById("issueType")?.value;
    if (!issueType) {
        showStatus("❌ Please select an issue type.", "error");
        return;
    }

    const desc = document.getElementById("issueDesc")?.value.trim() || "";
    if (!desc) {
        showStatus(`❌ ${t('issueDetailsRequired', lang)}`, "error");
        return;
    }

    const submitBtn = window.submitBtn;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t('sendingWhatsApp', lang);
        submitBtn.classList.add("loading");
    }
    showStatus(t('openingWhatsApp', lang), "info");

    await new Promise(resolve => requestAnimationFrame(resolve));

    const [
        { acName },
        { corpName },
        { wardNo, wardName, oldWardNo, oldWardName }
    ] = await Promise.all([
        findConstituencyForCurrentGPS(),
        findCorpForCurrentGPS(),
        findWardForCurrentGPS()
    ]);

    const reportData = {
        issueType,
        description: desc,
        wardNo,
        wardName,
        oldWardNo,
        oldWardName,
        corpName,
        constituency: acName,
        coordinates: {
            lat: window.currentGPS.lat.toFixed(6),
            lon: window.currentGPS.lon.toFixed(6)
        }
    };

    const savedImageFile = window.currentImageFile;
    const savedGPS = window.currentGPS ? { ...window.currentGPS } : null;
    let wasSuccess = false;

    try {
        const result = await shareViaWhatsApp(reportData, savedImageFile);
        if (result.mode === 'disabled') {
            showStatus(`❌ ${t('whatsappDisabled', lang)}`, "error");
            attachRetryHandler();
            return;
        }

        const displayNumber = result.displayNumber || await getWhatsAppDisplayNumber();
        wasSuccess = true;
        clearCivicDraft();

        const { recordCivicReport } = await import('./report-ingest.js');
        recordCivicReport(reportData);

        ['uploadOptions', 'locationInfo', 'imageConfirm'].forEach(id => {
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
        const locationConfirmEl = document.getElementById("confirmLocationCheck");
        if (locationConfirmEl) locationConfirmEl.checked = false;
        const searchWrapper = document.getElementById('gbaSearchWrapper');
        if (searchWrapper) searchWrapper.style.display = 'none';

        showStatus("", "");
        showSuccessScreen();

        window.currentGPS = savedGPS;

        if (window.displaySuccessLocationInfo) {
            window.displaySuccessLocationInfo();
        }

        const box = document.getElementById('whatsappSuccessBox');
        if (box) {
            box.classList.remove('is-hidden');
            box.innerHTML = `
                <p id="whatsappSuccessHint" class="map-message civic-whatsapp-hint">${formatWhatsAppHint(result.hintKey, displayNumber)}</p>
                <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
                    <i class="fab fa-whatsapp"></i>
                    <span>${t('sendWhatsApp', lang)}</span>
                </button>
            `;
            document.getElementById('whatsappResendBtn')?.addEventListener('click', async () => {
                const retry = await shareViaWhatsApp(reportData, savedImageFile);
                const hintEl = document.getElementById('whatsappSuccessHint');
                if (hintEl && retry.hintKey) {
                    hintEl.textContent = formatWhatsAppHint(
                        retry.hintKey,
                        retry.displayNumber || displayNumber
                    );
                }
            });
        }
    } catch (e) {
        showStatus(`❌ ${e.message}<br>${getTryAgainButtonText()}`, "error");
        attachRetryHandler();
        console.error("WhatsApp submit error:", e);
    } finally {
        const successVisible = document.getElementById("successScreen") &&
            !document.getElementById("successScreen").classList.contains('is-hidden');

        if (!wasSuccess && submitBtn && !successVisible) {
            submitBtn.classList.remove("loading");
            submitBtn.textContent = t('postIssue', lang);
            submitBtn.disabled = false;
            updateSubmitButtonState();
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
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                showStatus('', '');
                shareToGBA();
            });
        }
    }, 100);
}

const CIVIC_DRAFT_KEY = 'civic_report_draft';

export function saveCivicDraft() {
    try {
        const issueType = document.getElementById('issueType')?.value || '';
        const issueDesc = document.getElementById('issueDesc')?.value || '';
        const draft = {
            issueType,
            issueDesc,
            lat: window.currentGPS?.lat ?? null,
            lon: window.currentGPS?.lon ?? null,
            savedAt: Date.now()
        };
        localStorage.setItem(CIVIC_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
        console.warn('Could not save civic draft:', e);
    }
}

export function restoreCivicDraft() {
    try {
        const raw = localStorage.getItem(CIVIC_DRAFT_KEY);
        if (!raw) return false;

        const draft = JSON.parse(raw);
        const issueTypeEl = document.getElementById('issueType');
        const issueDescEl = document.getElementById('issueDesc');

        if (issueTypeEl && draft.issueType) issueTypeEl.value = draft.issueType;
        if (issueDescEl && draft.issueDesc) {
            issueDescEl.value = draft.issueDesc;
            const countEl = document.getElementById('issueDescCount');
            if (countEl) countEl.textContent = `${draft.issueDesc.length} / 120`;
        }

        return !!(draft.issueType || draft.issueDesc);
    } catch (e) {
        console.warn('Could not restore civic draft:', e);
        return false;
    }
}

export function clearCivicDraft() {
    try {
        localStorage.removeItem(CIVIC_DRAFT_KEY);
    } catch (e) {
        console.warn('Could not clear civic draft:', e);
    }
}
