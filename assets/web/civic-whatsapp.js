/**
 * Civic WhatsApp notification support
 * Shares photo + complaint via Web Share when supported, otherwise downloads
 * civic-issue.jpg and opens wa.me with pre-filled text.
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

function toImageFile(imageFile) {
    if (!imageFile) return null;
    if (imageFile instanceof File) {
        if (imageFile.type === 'image/jpeg') return imageFile;
        return new File([imageFile], imageFile.name || 'civic-issue.jpg', { type: 'image/jpeg' });
    }
    if (imageFile instanceof Blob) {
        return new File([imageFile], 'civic-issue.jpg', { type: 'image/jpeg' });
    }
    return null;
}

function normalizePhoneNumber(number) {
    return String(number || '').replace(/\D/g, '');
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function buildWhatsAppMessage(reportData, { includeRecipient = false, displayNumber = '' } = {}) {
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

    if (includeRecipient && displayNumber) {
        lines.push('', `Send to WhatsApp: ${displayNumber}`);
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

async function tryWebShareWithPhoto(file, message) {
    if (!file || typeof navigator.share !== 'function') return false;

    const shareData = {
        files: [file],
        text: message,
        title: 'Civic Issue Report'
    };

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
        return false;
    }

    try {
        await navigator.share(shareData);
        return true;
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn('Web Share with photo failed:', e);
        return false;
    }
}

function openWhatsAppFallback(config, file, chatMessage) {
    if (file) {
        downloadImageFile(file);
    }

    const openChat = () => openWhatsAppChat(config.number, chatMessage);
    if (file && isMobileDevice()) {
        setTimeout(openChat, 450);
    } else {
        openChat();
    }
}

export async function shareViaWhatsApp(reportData, imageFile) {
    const config = await loadWhatsAppConfig();
    if (!config.enabled || !config.number) return { mode: 'disabled' };

    const displayNumber = await getWhatsAppDisplayNumber();
    const file = toImageFile(imageFile);
    const chatMessage = buildWhatsAppMessage(reportData);
    const shareMessage = buildWhatsAppMessage(reportData, {
        includeRecipient: true,
        displayNumber
    });

    if (file) {
        try {
            const shared = await tryWebShareWithPhoto(file, shareMessage);
            if (shared) {
                return { mode: 'share', hintKey: 'whatsappShareWithPhoto' };
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                return { mode: 'cancelled', hintKey: 'whatsappCancelled' };
            }
        }

        openWhatsAppFallback(config, file, chatMessage);
        return { mode: 'download', hintKey: 'whatsappDownloadAttach' };
    }

    openWhatsAppChat(config.number, chatMessage);
    return { mode: 'text', hintKey: 'whatsappReviewAndSend' };
}

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    box.classList.remove('is-hidden');
    box.innerHTML = `
        <p id="whatsappSuccessHint" class="map-message civic-whatsapp-hint">${t(result.hintKey, lang)}</p>
        <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
            <i class="fab fa-whatsapp"></i>
            <span>${t('sendWhatsApp', lang)}</span>
        </button>
    `;

    document.getElementById('whatsappResendBtn')?.addEventListener('click', async () => {
        const retry = await shareViaWhatsApp(reportData, imageFile);
        const hintEl = document.getElementById('whatsappSuccessHint');
        if (hintEl && retry.hintKey) {
            hintEl.textContent = t(retry.hintKey, getCurrentLanguage());
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
