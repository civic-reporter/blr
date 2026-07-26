/**
 * Civic WhatsApp notification support
 * Opens WhatsApp directly to the configured number with a pre-filled complaint.
 * Saves civic-issue.jpg for quick attach when the browser cannot embed media in wa.me links.
 */

import { cityConfig } from './config.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

let whatsappConfig = null;

async function loadWhatsAppConfig() {
    if (whatsappConfig !== null) return whatsappConfig;
    try {
        await cityConfig.loadConfig();
        whatsappConfig = cityConfig.getConfig().whatsapp || { enabled: false };
    } catch (e) {
        console.warn('WhatsApp config unavailable:', e);
        whatsappConfig = { enabled: false };
    }
    return whatsappConfig;
}

export async function isWhatsAppEnabled() {
    const config = await loadWhatsAppConfig();
    return !!(config.enabled && config.number);
}

export async function getWhatsAppDisplayNumber() {
    const config = await loadWhatsAppConfig();
    return config.displayNumber || config.number?.replace(/^91/, '') || '';
}

export async function getWhatsAppNumber() {
    const config = await loadWhatsAppConfig();
    return config.number || '';
}

function buildUniqueImageFilename(baseName = 'civic-issue') {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `${baseName}-${stamp}.jpg`;
}

function toImageFile(imageFile) {
    const filename = buildUniqueImageFilename();
    if (!imageFile) return null;
    if (imageFile instanceof File) {
        if (imageFile.type === 'image/jpeg') {
            return new File([imageFile], filename, { type: 'image/jpeg' });
        }
        return new File([imageFile], filename, { type: 'image/jpeg' });
    }
    if (imageFile instanceof Blob) {
        return new File([imageFile], filename, { type: 'image/jpeg' });
    }
    return null;
}

function normalizePhoneNumber(number) {
    return String(number || '').replace(/\D/g, '');
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// WhatsApp standard text message limit (per Google/WhatsApp docs).
export const WHATSAPP_MESSAGE_MAX = 65536;

function buildWhatsAppMessage(reportData, { includeDetailsLine = true } = {}) {
    const lines = [`Issue: ${reportData.issueType || 'Not specified'}`];

    if (includeDetailsLine || reportData.description) {
        lines.push(`Details: ${reportData.description || ''}`);
    }

    if (reportData.coordinates) {
        lines.push(`Location: ${reportData.coordinates.lat}, ${reportData.coordinates.lon}`);
        lines.push(`Maps: https://www.google.com/maps?q=${reportData.coordinates.lat},${reportData.coordinates.lon}`);
    }

    if (reportData.wardNo || reportData.wardName) {
        lines.push(`GBA ward: ${[reportData.wardNo, reportData.wardName].filter(Boolean).join(' - ')}`);
    }

    if (reportData.oldWardNo || reportData.oldWardName) {
        lines.push(`BBMP ward: ${[reportData.oldWardNo, reportData.oldWardName].filter(Boolean).join(' - ')}`);
    }

    if (reportData.corpName) {
        lines.push(`Corporation: ${reportData.corpName}`);
    }

    if (reportData.constituency) {
        lines.push(`Constituency: ${reportData.constituency}`);
    }

    return lines.join('\n');
}

export function getWhatsAppMessageLength(reportData) {
    return buildWhatsAppMessage(reportData).length;
}

export function getWhatsAppDescriptionLimit(reportData) {
    const overhead = buildWhatsAppMessage({ ...reportData, description: '' }, { includeDetailsLine: true }).length;
    return Math.max(0, WHATSAPP_MESSAGE_MAX - overhead);
}

export function validateWhatsAppMessageLength(reportData) {
    const message = buildWhatsAppMessage(reportData);
    if (message.length <= WHATSAPP_MESSAGE_MAX) {
        return { ok: true, length: message.length, limit: WHATSAPP_MESSAGE_MAX };
    }

    return {
        ok: false,
        length: message.length,
        limit: WHATSAPP_MESSAGE_MAX,
        maxDescription: getWhatsAppDescriptionLimit(reportData)
    };
}

export async function buildReportDataPreview(description = '') {
    const issueType = document.getElementById('issueType')?.value || '';
    const coords = window.currentGPS
        ? {
            lat: window.currentGPS.lat.toFixed(6),
            lon: window.currentGPS.lon.toFixed(6)
        }
        : null;

    const reportData = {
        issueType,
        description,
        coordinates: coords,
        wardNo: '',
        wardName: '',
        oldWardNo: '',
        oldWardName: '',
        corpName: '',
        constituency: ''
    };

    if (coords) {
        try {
            const { findConstituencyForCurrentGPS } = await import('./civic-submit.js');
            const { findCorpForCurrentGPS, findWardForCurrentGPS } = await import('./validation.js');
            const [
                { acName },
                { corpName },
                { wardNo, wardName, oldWardNo, oldWardName }
            ] = await Promise.all([
                findConstituencyForCurrentGPS(),
                findCorpForCurrentGPS(),
                findWardForCurrentGPS()
            ]);
            Object.assign(reportData, {
                wardNo,
                wardName,
                oldWardNo,
                oldWardName,
                corpName,
                constituency: acName
            });
        } catch (error) {
            console.warn('Could not resolve ward preview for WhatsApp limit:', error);
        }
    }

    return reportData;
}

export async function updateIssueDescriptionLimit() {
    const issueDesc = document.getElementById('issueDesc');
    const issueDescCount = document.getElementById('issueDescCount');
    if (!issueDesc || !issueDescCount) return;

    const reportData = await buildReportDataPreview(issueDesc.value);
    const maxDescription = getWhatsAppDescriptionLimit(reportData);
    const messageLength = getWhatsAppMessageLength(reportData);

    issueDesc.maxLength = maxDescription;
    const descLength = issueDesc.value.length;
    if (descLength > maxDescription) {
        issueDesc.value = issueDesc.value.slice(0, maxDescription);
    }

    issueDescCount.textContent = `${issueDesc.value.length} / ${maxDescription}`;
    issueDescCount.classList.toggle('char-count-warn', messageLength > WHATSAPP_MESSAGE_MAX - 40 || issueDesc.value.length > maxDescription * 0.85);

    const totalCounter = document.getElementById('issueDescTotalCount');
    if (totalCounter) {
        const lang = getCurrentLanguage();
        totalCounter.textContent = t('whatsappMessageTotal', lang)
            .replace('{current}', String(messageLength))
            .replace('{max}', String(WHATSAPP_MESSAGE_MAX));
        totalCounter.classList.toggle('char-count-warn', messageLength > WHATSAPP_MESSAGE_MAX);
    }
}

export function formatWhatsAppHint(key, displayNumber) {
    return t(key, getCurrentLanguage()).replace(/\{number\}/g, displayNumber || '');
}

function downloadImageFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || buildUniqueImageFilename();
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function openWhatsAppChat(number, message) {
    const phone = normalizePhoneNumber(number);
    const encoded = encodeURIComponent(message);
    const webUrl = `https://wa.me/${phone}?text=${encoded}`;

    if (isMobileDevice()) {
        // whatsapp:// opens the app chat directly to the configured number.
        const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`;
        window.location.href = appUrl;
        setTimeout(() => {
            if (!document.hidden) {
                window.location.assign(webUrl);
            }
        }, 1200);
        return;
    }

    window.open(webUrl, '_blank', 'noopener,noreferrer');
}

export async function shareViaWhatsApp(reportData, imageFile) {
    const config = await loadWhatsAppConfig();
    if (!config.enabled || !config.number) return { mode: 'disabled' };

    const displayNumber = await getWhatsAppDisplayNumber();
    const file = toImageFile(imageFile);
    const chatMessage = buildWhatsAppMessage(reportData);

    if (file && isMobileDevice()) {
        downloadImageFile(file);
        await new Promise(resolve => setTimeout(resolve, 450));
    }

    openWhatsAppChat(config.number, chatMessage);

    return {
        mode: file ? 'direct-with-photo' : 'direct',
        hintKey: file ? 'whatsappDirectWithPhoto' : 'whatsappReviewAndSend',
        displayNumber
    };
}

export function setupWhatsAppSuccessBox({ reportData, imageFile, hintKey, displayNumber, onConfirmed }) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    let logged = false;

    box.classList.remove('is-hidden');
    box.innerHTML = `
        <p id="whatsappSuccessHint" class="map-message civic-whatsapp-hint">${formatWhatsAppHint(hintKey, displayNumber)}</p>
        <p class="civic-whatsapp-confirm-hint">${t('whatsappConfirmSentHint', lang)}</p>
        <div class="civic-whatsapp-actions">
            <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
                <i class="fab fa-whatsapp"></i>
                <span>${t('sendWhatsApp', lang)}</span>
            </button>
            <button type="button" id="whatsappConfirmSentBtn" class="success-btn civic-success-btn civic-whatsapp-confirm-btn">
                <i class="fas fa-check"></i>
                <span>${t('whatsappConfirmSent', lang)}</span>
            </button>
        </div>
        <p id="whatsappLoggedHint" class="civic-whatsapp-logged is-hidden"></p>
    `;

    document.getElementById('whatsappResendBtn')?.addEventListener('click', async () => {
        const retry = await shareViaWhatsApp(reportData, imageFile);
        const hintEl = document.getElementById('whatsappSuccessHint');
        if (hintEl && retry.hintKey) {
            hintEl.textContent = formatWhatsAppHint(retry.hintKey, retry.displayNumber || displayNumber);
        }
    });

    document.getElementById('whatsappConfirmSentBtn')?.addEventListener('click', async () => {
        if (logged || !onConfirmed) return;

        const confirmBtn = document.getElementById('whatsappConfirmSentBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('loading');
            confirmBtn.querySelector('span').textContent = t('whatsappLogging', lang);
        }

        try {
            const result = await onConfirmed(reportData);
            if (result?.recorded === false) {
                throw new Error(result.reason || 'not-recorded');
            }

            logged = true;

            const loggedHint = document.getElementById('whatsappLoggedHint');
            if (loggedHint) {
                loggedHint.textContent = t('whatsappLoggedSuccess', lang);
                loggedHint.classList.remove('is-hidden');
            }

            if (confirmBtn) {
                confirmBtn.classList.remove('loading');
                confirmBtn.classList.add('is-hidden');
            }
        } catch (error) {
            console.warn('WhatsApp confirm logging failed:', error);
            logged = false;

            const loggedHint = document.getElementById('whatsappLoggedHint');
            if (loggedHint) {
                loggedHint.textContent = t('whatsappLogFailed', lang);
                loggedHint.classList.remove('is-hidden');
            }

            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.classList.remove('loading');
                confirmBtn.querySelector('span').textContent = t('whatsappConfirmSent', lang);
            }
        }
    });
}

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    const displayNumber = result.displayNumber || await getWhatsAppDisplayNumber();
    setupWhatsAppSuccessBox({
        reportData,
        imageFile,
        hintKey: result.hintKey,
        displayNumber
    });
}

export async function updateCivicWhatsAppOption() {
    const whatsappOption = document.getElementById('whatsappOption');
    const numberDisplay = document.getElementById('whatsappNumberDisplay');

    if (!whatsappOption) return;

    const enabled = await isWhatsAppEnabled();
    const hasGps = !!(window.currentGPS &&
        typeof window.currentGPS.lat === 'number' &&
        typeof window.currentGPS.lon === 'number');

    if (!enabled || !hasGps) {
        whatsappOption.classList.add('is-hidden');
        whatsappOption.style.display = 'none';
        return;
    }

    whatsappOption.classList.remove('is-hidden');
    whatsappOption.style.display = 'block';
    if (numberDisplay) {
        numberDisplay.textContent = await getWhatsAppDisplayNumber();
    }
}
