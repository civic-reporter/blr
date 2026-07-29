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

function normalizePhoneNumber(number) {
    return String(number || '').replace(/\D/g, '');
}

function normalizeIssueType(value) {
    return String(value || '').trim().toLowerCase();
}

function getSelectedIssueType() {
    return document.getElementById('issueType')?.value || '';
}

function resolveWhatsAppTarget(issueType, config) {
    const routes = config?.routes || [];
    const normalized = normalizeIssueType(issueType);

    for (const route of routes) {
        const types = (route.issueTypes || []).map((entry) => normalizeIssueType(entry));
        if (normalized && types.includes(normalized)) {
            return {
                number: route.number,
                displayNumber: route.displayNumber || route.number?.replace(/^91/, '') || '',
                displayLabel: route.displayLabel || config.displayLabel || 'GBA Grievance Desk Report'
            };
        }
    }

    return {
        number: config.number,
        displayNumber: config.displayNumber || config.number?.replace(/^91/, '') || '',
        displayLabel: config.displayLabel || 'GBA Grievance Desk Report'
    };
}

export async function getWhatsAppTargetForIssue(issueType = getSelectedIssueType()) {
    const config = await loadWhatsAppConfig();
    return resolveWhatsAppTarget(issueType, config);
}

export async function isWhatsAppEnabled() {
    const config = await loadWhatsAppConfig();
    return !!(config.enabled && config.number);
}

export async function getWhatsAppDisplayNumber(issueType) {
    const target = await getWhatsAppTargetForIssue(issueType);
    return target.displayNumber || target.number?.replace(/^91/, '') || '';
}

export async function getWhatsAppTargetLabel(issueType) {
    const config = await loadWhatsAppConfig();
    const target = resolveWhatsAppTarget(issueType ?? getSelectedIssueType(), config);
    const number = target.displayNumber || target.number?.replace(/^91/, '') || '';
    const lang = getCurrentLanguage();
    const label = target.displayLabel || t('whatsappTargetName', lang) || config.displayLabel || 'GBA Grievance Desk Report';
    if (number && label.includes(number)) return label;
    return number ? `${label} (${number})` : label;
}

export async function getWhatsAppNumber(issueType) {
    const target = await getWhatsAppTargetForIssue(issueType);
    return target.number || '';
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

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// WhatsApp standard text message limit (per Google/WhatsApp docs).
export const WHATSAPP_MESSAGE_MAX = 65536;

function buildWhatsAppMessage(reportData, { includeDetailsLine = true } = {}) {
    const lang = getCurrentLanguage();
    const wardLabel = t('previewWardLabel', lang) || 'Ward';
    const lines = [`Issue: ${reportData.issueType || 'Not specified'}`];

    if (includeDetailsLine || reportData.description) {
        lines.push(`Details: ${reportData.description || ''}`);
    }

    if (reportData.coordinates) {
        lines.push(`Location: ${reportData.coordinates.lat}, ${reportData.coordinates.lon}`);
        lines.push(`Maps: https://www.google.com/maps?q=${reportData.coordinates.lat},${reportData.coordinates.lon}`);
    }

    if (reportData.wardNo || reportData.wardName) {
        lines.push(`${wardLabel}: ${[reportData.wardNo, reportData.wardName].filter(Boolean).join(' - ')}`);
    }

    if (reportData.oldWardNo || reportData.oldWardName) {
        lines.push(`Legacy ward: ${[reportData.oldWardNo, reportData.oldWardName].filter(Boolean).join(' - ')}`);
    }

    if (reportData.corpName) {
        lines.push(`Corporation: ${reportData.corpName}`);
    }

    if (reportData.constituency) {
        lines.push(`Constituency: ${reportData.constituency}`);
    }

    if (reportData.mlaName) {
        lines.push(`MLA: ${reportData.mlaName}`);
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
            const { getCityFeatures } = await import('./config.js');
            const features = await getCityFeatures();
            const [
                { acName, mlaName },
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
                corpName,
                constituency: acName,
                mlaName
            });
            if (features.showOldWard !== false) {
                reportData.oldWardNo = oldWardNo;
                reportData.oldWardName = oldWardName;
            }
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

export async function formatReportSuccessContent(issueType) {
    const lang = getCurrentLanguage();
    const config = await loadWhatsAppConfig();
    const target = resolveWhatsAppTarget(issueType, config);
    const displayNumber = target.displayNumber || target.number?.replace(/^91/, '') || '';
    const deskName = target.displayLabel || t('whatsappTargetName', lang);

    return {
        deskName,
        displayNumber,
        destinationLine: displayNumber
            ? t('issueReportedDestination', lang)
                .replace('{desk}', deskName)
                .replace('{number}', displayNumber)
            : t('issueReportedSimple', lang),
        followUpLine: t('issueReportedFollowUp', lang)
    };
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
    const target = resolveWhatsAppTarget(reportData?.issueType, config);
    if (!config.enabled || !target.number) return { mode: 'disabled' };

    const displayNumber = target.displayNumber || target.number.replace(/^91/, '');
    const file = toImageFile(imageFile);
    const chatMessage = buildWhatsAppMessage(reportData);

    if (file && isMobileDevice()) {
        downloadImageFile(file);
        await new Promise(resolve => setTimeout(resolve, 450));
    }

    openWhatsAppChat(target.number, chatMessage);

    return {
        mode: file ? 'direct-with-photo' : 'direct',
        hintKey: file ? 'whatsappDirectWithPhoto' : 'whatsappReviewAndSend',
        displayNumber,
        targetNumber: target.number
    };
}

export function setupWhatsAppSuccessBox({ reportData, imageFile, displayNumber }) {
    const lang = getCurrentLanguage();
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    box.classList.remove('is-hidden');
    box.innerHTML = `
        <p class="civic-whatsapp-resend-hint">${escapeHtml(t('issueReportedResendHint', lang))}</p>
        <div class="civic-whatsapp-actions">
            <button type="button" id="whatsappResendBtn" class="success-btn civic-success-btn civic-whatsapp-btn">
                <i class="fab fa-whatsapp"></i>
                <span>${escapeHtml(t('sendWhatsApp', lang))}</span>
            </button>
        </div>
    `;
    document.getElementById('whatsappResendBtn')?.addEventListener('click', async () => {
        await shareViaWhatsApp(reportData, imageFile);
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function renderSuccessScreenContent(issueType) {
    const lang = getCurrentLanguage();
    const { destinationLine, followUpLine } = await formatReportSuccessContent(issueType);

    const titleEl = document.querySelector('#successScreen .success-title');
    const messageEl = document.getElementById('successMessage');
    const destinationEl = document.getElementById('successReportDestination');

    if (titleEl) {
        titleEl.textContent = t('issuePostedSuccess', lang);
    }
    if (messageEl) {
        messageEl.textContent = followUpLine;
    }
    if (destinationEl) {
        destinationEl.textContent = destinationLine;
        destinationEl.classList.remove('is-hidden');
    }
}

export async function renderWhatsAppSuccess(reportData, imageFile) {
    const box = document.getElementById('whatsappSuccessBox');
    if (!box) return;

    const result = await shareViaWhatsApp(reportData, imageFile);
    if (result.mode === 'disabled') return;

    const displayNumber = result.displayNumber || await getWhatsAppDisplayNumber(reportData?.issueType);
    setupWhatsAppSuccessBox({
        reportData,
        imageFile,
        displayNumber
    });
    await renderSuccessScreenContent(reportData?.issueType);
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
        numberDisplay.textContent = await getWhatsAppTargetLabel(getSelectedIssueType());
    }
}
