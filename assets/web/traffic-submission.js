import { getConfig } from './config.js';
import { findTrafficPSForLocation } from './traffic-validation.js';

let CONFIG = null;
import { findCorpForCurrentGPS } from './validation.js';
import { showStatus, showSuccessScreen, updateSubmitButtonState } from './ui.js';
import { isValidNumber, isInGBA, pointInRing } from './utils.js';
import { blurFacesInImage } from '../js/face-blur.js';
import { initEmailModule, prepareEmailData, isEmailEnabled, getRelevantEmails, isValidEmail } from './email-authorities.js';

let wardPolygons = null;

async function loadWardPolygons() {
    if (wardPolygons !== null) return wardPolygons;
    try {
        if (!CONFIG) CONFIG = await getConfig();
        const res = await fetch(CONFIG.WARD_KML_URL);
        if (!res.ok) return wardPolygons = [];
        const kmlText = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, "application/xml");
        const placemarks = Array.from(xml.getElementsByTagName("Placemark"));
        wardPolygons = placemarks.map(pm => {
            const simpleData = pm.getElementsByTagName("SimpleData");
            let wardNo = "", wardName = "";
            for (const sd of simpleData) {
                const nameAttr = sd.getAttribute("name");
                if (nameAttr === "ward_id") wardNo = sd.textContent.trim();
                else if (nameAttr === "ward_name") wardName = sd.textContent.trim();
            }
            const coordsNode = pm.getElementsByTagName("coordinates")[0];
            if (!coordsNode) return null;
            const ring = coordsNode.textContent.trim()
                .split(/\s+/)
                .map(pair => pair.split(",").map(Number))
                .map(([lon, lat]) => [lon, lat]);
            return { wardNo, wardName, ring };
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

export async function submitTraffic() {
    // Validate location
    if (!window.currentGPS || !isValidNumber(window.currentGPS.lat) || !isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        showStatus("❌ Location must be inside Bengaluru boundary.", "error");
        return;
    }

    if (!window.currentImageFile) {
        showStatus("❌ Please upload an image first.", "error");
        return;
    }


    const trafficCategory = document.getElementById("trafficCategory")?.value;
    if (!trafficCategory) {
        showStatus("❌ Please select a traffic issue type.", "error");
        return;
    }

    const submitBtn = document.getElementById("trafficSubmit");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Reporting...";
        submitBtn.classList.add("loading");
    }

    showStatus("📤 Reporting traffic issue to @BlrCityPolice...", "info");

    // Allow UI to update
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Get form values (already validated above)
    const trafficDesc = document.getElementById("trafficDesc")?.value.trim() || "";

    // Image is already blurred from upload
    const imageToSubmit = window.currentImageFile;

    // Check if user wants to email authorities
    const emailCheckbox = document.getElementById("emailAuthoritiesCheck");
    const shouldEmail = emailCheckbox && emailCheckbox.checked;

    // Check if user wants CC
    const ccCheckbox = document.getElementById("ccMeCheck");
    const userEmailInput = document.getElementById("userEmailInput");
    const userEmail = (ccCheckbox && ccCheckbox.checked && userEmailInput) ? userEmailInput.value.trim() : "";

    // Validate user email if CC is requested
    if (shouldEmail && ccCheckbox && ccCheckbox.checked) {
        if (!userEmail || !isValidEmail(userEmail)) {
            showStatus("❌ Please enter a valid email address for CC.", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "🚦 Report";
                submitBtn.classList.remove("loading");
            }
            return;
        }
    }

    // Find traffic PS, ward, and corporation for this location
    const [
        { trafficPS, psName },
        { wardNo, wardName },
        { corpName, corpHandle }
    ] = await Promise.all([
        findTrafficPSForLocation(),
        findWardForCurrentGPS(),
        findCorpForCurrentGPS()
    ]);

    // Prepare form data
    const formData = new FormData();
    formData.append("image", imageToSubmit);
    formData.append("lat", window.currentGPS.lat.toFixed(6));
    formData.append("lon", window.currentGPS.lon.toFixed(6));
    formData.append("category", trafficCategory);
    formData.append("description", trafficDesc);
    formData.append("trafficPS", trafficPS || "");
    formData.append("psName", psName || "");
    formData.append("wardNo", wardNo || "");
    formData.append("wardName", wardName || "");
    formData.append("corpName", corpName || "");
    formData.append("corpHandle", corpHandle || "");
    formData.append("sendEmail", shouldEmail ? "true" : "false");

    // If email is requested, add email data
    if (shouldEmail && isEmailEnabled()) {
        const reportData = {
            category: trafficCategory,
            description: trafficDesc,
            location: trafficDesc || "Location on map",
            wardNo: wardNo,
            wardName: wardName,
            trafficPS: psName,
            coordinates: {
                lat: window.currentGPS.lat.toFixed(6),
                lon: window.currentGPS.lon.toFixed(6)
            },
            timestamp: new Date().toLocaleString()
        };

        const emailData = prepareEmailData(reportData, { userEmail: userEmail });
        if (emailData) {
            formData.append("emailRecipients", JSON.stringify(emailData.to));
            formData.append("emailSubject", emailData.subject);
            formData.append("emailBody", emailData.body);
            if (emailData.cc && emailData.cc.length > 0) {
                formData.append("emailCC", JSON.stringify(emailData.cc));
            }
        }
    }

    let wasSuccess = false;

    try {
        if (!CONFIG) CONFIG = await getConfig();
        const res = await fetch(CONFIG.TRAFFIC_API_URL, { method: "POST", body: formData });
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

            ['uploadOptions', 'locationInfo', 'imageConfirm'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            const mapEl = document.getElementById('map');
            if (mapEl) mapEl.style.display = 'none';

            // Reset globals
            window.currentImageFile = null;
            window.currentGPS = null;

            // Clear form fields
            const categoryEl = document.getElementById('trafficCategory');
            const descEl = document.getElementById('trafficDesc');
            if (categoryEl) categoryEl.value = '';
            if (descEl) descEl.value = '';

            const previewEl = document.getElementById("preview");
            if (previewEl) previewEl.src = '';

            const confirmEl = document.getElementById("confirmImageCheck");
            if (confirmEl) confirmEl.checked = false;

            // Hide search wrapper
            const searchWrapper = document.getElementById('gbaSearchWrapper');
            if (searchWrapper) searchWrapper.style.display = 'none';

            showStatus("", "");
            showSuccessScreen();

            // Display tweet link if available
            if (url && document.getElementById("tweetLinkContainer")) {
                document.getElementById("tweetLinkContainer").innerHTML = `
                    <p class="map-message">Traffic issue reported! <a href="${url}" target="_blank">View on X</a></p>
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
            showStatus(`❌ Failed to report: ${data.message || data.error || res.status}<br>${tryAgainText}`, "error");
            attachRetryHandler();
        }
    } catch (e) {
        const tryAgainText = getTryAgainButtonText();
        showStatus(`❌ Submission failed: ${e.message}<br>${tryAgainText}`, "error");
        attachRetryHandler();
        console.error("Traffic submission error:", e);
    } finally {
        // Re-enable button if not successful
        if (!wasSuccess && submitBtn && !document.getElementById("successScreen")?.style.display === 'block') {
            submitBtn.classList.remove("loading");
            submitBtn.textContent = "🚦 Report";
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
        console.log('Retry button found:', retryBtn);
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                console.log('Retry button clicked - keeping image and GPS');

                // Hide the retry button
                retryBtn.remove();

                // Clear error status and reset submit button
                showStatus('📸 Ready to submit', 'info');

                // Re-enable submit button
                const submitBtn = document.getElementById('trafficSubmit');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🚦 Report';
                    submitBtn.classList.remove('loading');
                }

                updateSubmitButtonState();
            });
        }
    }, 100);
}

// Update email recipients list based on current location
export async function updateEmailRecipients() {
    console.log('📧 updateEmailRecipients called');

    const emailOption = document.getElementById('emailOption');
    const emailDetails = document.getElementById('emailDetails');
    const emailRecipients = document.getElementById('emailRecipients');
    const emailList = document.getElementById('emailList');
    const emailCheckbox = document.getElementById('emailAuthoritiesCheck');

    console.log('📧 Email elements:', {
        emailOption: !!emailOption,
        emailDetails: !!emailDetails,
        hasGPS: !!window.currentGPS,
        isEnabled: isEmailEnabled()
    });

    if (!emailOption) {
        console.warn('❌ emailOption element not found');
        return;
    }

    if (!isEmailEnabled()) {
        console.log('📧 Email feature disabled in config');
        emailOption.style.display = 'none';
        return;
    }

    // Show email option if we have a valid location
    if (window.currentGPS && isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        console.log('✅ Showing email option');
        // Always show the email option container to prevent button jumping
        emailOption.style.display = 'block';

        // Show/hide email details when checkbox is checked
        if (emailCheckbox && emailCheckbox.checked) {
            if (emailDetails) emailDetails.style.display = 'block';

            if (emailRecipients && emailList) {
                const [{ trafficPS, psName }, { wardNo, wardName }] = await Promise.all([
                    findTrafficPSForLocation(),
                    findWardForCurrentGPS()
                ]);

                console.log('📧 Location data:', { trafficPS, psName, wardNo, wardName });
                const emails = getRelevantEmails({ wardNo, trafficPS: trafficPS });
                console.log('📧 Found emails:', emails);

                if (emails.length > 0) {
                    emailList.innerHTML = emails.map(email => `<li>📧 ${email}</li>`).join('');
                } else {
                    emailList.innerHTML = '<li>⚠️ No email addresses configured for this location</li>';
                }
            }
        } else {
            if (emailDetails) emailDetails.style.display = 'none';
        }
    } else {
        emailOption.style.display = 'none';
    }
}
