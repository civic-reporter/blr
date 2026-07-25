/**
 * Civic WhatsApp notification support
 * Shares the same issue photo via Web Share (mobile) or download + wa.me (desktop).
 */

import { cityConfig } from './config.js';
import { isInGBA } from './utils.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

let whatsappConfig = null;
let lastWhatsAppPayload = null;

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

function buildWhatsAppMessage(reportData, { includeRecipient = false, displayNumber = '' } = {}) {
    const lines = [
        '*Civic Issue Report*',
        'Nāgarika Dhvani',
        '',
        `Issue: ${reportData.issueType || 'Not specified'}`
    ];

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

    if (reportData.tweetUrl) {
        lines.push(`Posted on X: ${reportData.tweetUrl}`);
    }

    if (includeRecipient && displayNumber) {
        lines.push('', `Send to WhatsApp: +91 ${displayNumber}`);
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
    const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
}

async function tryWebShareWithPhoto(file, message) {
    if (!file || !navigator.share) return false;

    const shareData = { text: message, files: [file], title: 'Civic Issue Report' };
    if (navigator.canShare && !navigator.canShare(shareData)) return false;

    try {
        await navigator.share(shareData);
        return true;
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn('Web Share with photo failed:', e);
        return false;
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

    lastWhatsAppPayload = { reportData, imageFile: file };

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

        downloadImageFile(file);
        openWhatsAppChat(config.number, chatMessage);
        return { mode: 'download', hintKey: 'whatsappDownloadAttach' };
    }

    openWhatsAppChat(config.number, chatMessage);
    return { mode: 'text', hintKey: 'whatsappSuccessHint' };
}

function bindWhatsAppResendButton(reportData, imageFile) {
    const btn = document.getElementById('whatsappResendBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const result = await shareViaWhatsApp(reportData, imageFile);
        const hintEl = document.getElementById('whatsappSuccessHint');
        if (hintEl && result.hintKey) {
            hintEl.textContent = t(result.hintKey, getCurrentLanguage());
        }
    });
}

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    box.classList.remove('is-hidden');
    box.innerHTML = `
        <p id="whatsappSuccessHint" class="map-message">${t(result.hintKey, lang)}</p>
        <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
            <i class="fab fa-whatsapp"></i>
            <span>${t('sendWhatsApp', lang)}</span>
        </button>
    `;

    bindWhatsAppResendButton(reportData, imageFile);
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
