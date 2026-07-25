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

function buildWhatsAppMessage(reportData) {
    const lines = [`Issue: ${reportData.issueType || 'Not specified'}`];

    if (reportData.description) {
        lines.push(`Details: ${reportData.description}`);
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

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    const displayNumber = result.displayNumber || await getWhatsAppDisplayNumber();
    box.classList.remove('is-hidden');
    box.innerHTML = `
        <p id="whatsappSuccessHint" class="map-message civic-whatsapp-hint">${formatWhatsAppHint(result.hintKey, displayNumber)}</p>
        <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
            <i class="fab fa-whatsapp"></i>
            <span>${t('sendWhatsApp', lang)}</span>
        </button>
    `;

    document.getElementById('whatsappResendBtn')?.addEventListener('click', async () => {
        const retry = await shareViaWhatsApp(reportData, imageFile);
        const hintEl = document.getElementById('whatsappSuccessHint');
        if (hintEl && retry.hintKey) {
            hintEl.textContent = formatWhatsAppHint(retry.hintKey, retry.displayNumber || displayNumber);
        }
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
