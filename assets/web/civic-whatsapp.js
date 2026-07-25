/**
 * Civic WhatsApp notification support
 * Opens wa.me to the configured number with a pre-filled complaint message.
 * When a photo is present, saves civic-issue.jpg for the user to attach in WhatsApp.
 */

import { cityConfig } from './config.js';
import { isInGBA } from './utils.js';
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

function toImageFile(imageFile) {
    if (!imageFile) return null;
    if (imageFile instanceof File) return imageFile;
    if (imageFile instanceof Blob) {
        return new File([imageFile], 'civic-issue.jpg', { type: imageFile.type || 'image/jpeg' });
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

function downloadImageFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'civic-issue.jpg';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function openWhatsAppChat(number, message) {
    const phone = normalizePhoneNumber(number);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    if (isMobileDevice()) {
        window.location.assign(url);
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}

export async function shareViaWhatsApp(reportData, imageFile) {
    const config = await loadWhatsAppConfig();
    if (!config.enabled || !config.number) return { mode: 'disabled' };

    const file = toImageFile(imageFile);
    const message = buildWhatsAppMessage(reportData);

    if (file) {
        downloadImageFile(file);
    }

    const openChat = () => openWhatsAppChat(config.number, message);

    if (file && isMobileDevice()) {
        // Give the browser a moment to start saving the image before switching to WhatsApp.
        setTimeout(openChat, 450);
    } else {
        openChat();
    }

    return {
        mode: file ? 'chat-with-photo' : 'chat',
        hintKey: file ? 'whatsappReviewAndAttach' : 'whatsappReviewAndSend'
    };
}

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    box.classList.remove('is-hidden');
    box.innerHTML = `<p id="whatsappSuccessHint" class="map-message civic-whatsapp-hint">${t(result.hintKey, lang)}</p>`;
}

export async function updateCivicWhatsAppOption() {
    const whatsappOption = document.getElementById('whatsappOption');
    const numberDisplay = document.getElementById('whatsappNumberDisplay');

    if (!whatsappOption) return;

    const enabled = await isWhatsAppEnabled();
    if (!enabled) {
        whatsappOption.classList.add('is-hidden');
        whatsappOption.style.display = 'none';
        return;
    }

    if (window.currentGPS && isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        whatsappOption.classList.remove('is-hidden');
        whatsappOption.style.display = 'block';
        if (numberDisplay) {
            numberDisplay.textContent = await getWhatsAppDisplayNumber();
        }
    } else {
        whatsappOption.classList.add('is-hidden');
        whatsappOption.style.display = 'none';
    }
}
