/**
 * Civic WhatsApp notification support
 * Opens WhatsApp chat with pre-filled report details to a configured number.
 */

import { cityConfig } from './config.js';
import { isInGBA } from './utils.js';

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

function buildWhatsAppMessage(reportData) {
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
        lines.push(`Ward: ${[reportData.wardNo, reportData.wardName].filter(Boolean).join(' - ')}`);
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

    lines.push('', 'Please see the attached photo of the issue.');
    return lines.join('\n');
}

export async function shareViaWhatsApp(reportData) {
    const config = await loadWhatsAppConfig();
    if (!config.enabled || !config.number) return false;

    const message = buildWhatsAppMessage(reportData);
    const waUrl = `https://wa.me/${config.number}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    return true;
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
