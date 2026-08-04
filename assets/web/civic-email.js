/**
 * Civic Email Support Module
 * Handles email functionality for civic submissions
 */

import { isEmailEnabled, getRelevantEmails, isValidEmail, prepareEmailData } from './email-authorities.js';
import { isInGBA } from './utils.js';
import { findWardForCurrentGPS, findCorpForCurrentGPS } from './validation.js';
import { cityConfig } from './config.js';
import { t, getCurrentLanguage } from '../js/i18n.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function getEscalationForCorp(corpName) {
    if (!corpName) return null;
    try {
        await cityConfig.loadConfig();
        const map = cityConfig.getConfig().escalationContacts || {};
        return map[corpName] || null;
    } catch (e) {
        console.warn('Could not load escalation contacts:', e);
        return null;
    }
}

function renderContactItem(contact) {
    const role = escapeHtml(contact.role || '');
    const name = escapeHtml(contact.name || '');
    const phone = String(contact.phone || '').replace(/\D/g, '');
    const phoneDisplay = escapeHtml(contact.phone || '');
    const email = escapeHtml(contact.email || '');

    const phoneLink = phone
        ? `<a href="tel:${phone}" class="escalation-link">${phoneDisplay}</a>`
        : '';
    const emailLink = contact.email
        ? `<a href="mailto:${email}" class="escalation-link">${email}</a>`
        : '';

    const meta = [phoneLink, emailLink].filter(Boolean).join(' · ');

    return `
        <li class="escalation-contact">
            <span class="escalation-role">${role}</span>
            <span class="escalation-name">${name}</span>
            ${meta ? `<span class="escalation-meta">${meta}</span>` : ''}
        </li>
    `;
}

function renderZoneSections(zones, lang) {
    if (!Array.isArray(zones) || !zones.length) return '';

    return zones.map((zone) => {
        const zoneId = escapeHtml(zone.id || '');
        const office = escapeHtml(zone.office || '');
        const contacts = Array.isArray(zone.contacts) ? zone.contacts : [];
        if (!contacts.length) return '';

        const heading = office
            ? `${zoneId}: ${office}`
            : zoneId || t('escalationZoneOfficers', lang);

        return `
            <div class="escalation-zone">
                <p class="escalation-zone-title">${heading}</p>
                <ul class="escalation-list">${contacts.map(renderContactItem).join('')}</ul>
            </div>
        `;
    }).join('');
}

function renderEscalationContacts(escalation, lang) {
    const corpContacts = Array.isArray(escalation?.contacts) ? escalation.contacts : [];
    const zones = Array.isArray(escalation?.zones) ? escalation.zones : [];
    if (!corpContacts.length && !zones.length) return '';

    const title = escapeHtml(t('escalationContactsTitle', lang));
    const hint = escapeHtml(t('escalationContactsHint', lang));
    const corpLabel = escapeHtml(escalation.label || '');
    const corpSectionTitle = escapeHtml(t('escalationCorpOfficers', lang));

    const corpRows = corpContacts.map(renderContactItem).join('');
    const zoneHtml = renderZoneSections(zones, lang);

    return `
        <div class="escalation-contacts">
            <p class="escalation-title"><strong>${title}</strong>${corpLabel ? ` · ${corpLabel}` : ''}</p>
            <p class="escalation-hint">${hint}</p>
            ${corpRows ? `
            <div class="escalation-zone">
                <p class="escalation-zone-title">${corpSectionTitle}</p>
                <ul class="escalation-list">${corpRows}</ul>
            </div>` : ''}
            ${zoneHtml}
        </div>
    `;
}

// Update email recipients list based on current location for civic flow
export async function updateCivicEmailRecipients() {
    console.log('📧 updateCivicEmailRecipients called');

    const emailOption = document.getElementById('emailOption');
    const emailDetails = document.getElementById('emailDetails');
    const emailRecipients = document.getElementById('emailRecipients');
    const emailList = document.getElementById('emailList');
    const emailCheckbox = document.getElementById('emailAuthoritiesCheck');

    console.log('📧 Email elements:', {
        emailOption: !!emailOption,
        emailDetails: !!emailDetails,
        hasGPS: !!window.currentGPS,
        isEnabled: isEmailEnabled('civic')
    });

    if (!emailOption) {
        console.warn('❌ emailOption element not found');
        return;
    }

    if (!isEmailEnabled('civic')) {
        console.log('📧 Email feature disabled in config for civic');
        emailOption.style.display = 'none';
        return;
    }

    // Show email option if we have a valid location
    if (window.currentGPS && isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        emailOption.style.display = 'block';

        if (emailCheckbox && emailCheckbox.checked) {
            if (emailDetails) emailDetails.style.display = 'block';

            if (emailRecipients && emailList) {
                const { wardNo, wardName } = await findWardForCurrentGPS();

                const emails = getRelevantEmails({ wardNo }, 'civic');

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

// Display ward, corporation, and corp escalation contacts on the success screen
export async function displaySuccessLocationInfo() {
    const successInfoDiv = document.getElementById('successLocationInfo');
    if (!successInfoDiv) return;

    if (!window.currentGPS || !isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        successInfoDiv.classList.add('is-hidden');
        successInfoDiv.style.display = 'none';
        return;
    }

    const lang = getCurrentLanguage();
    const [{ wardNo, wardName, oldWardNo, oldWardName }, { corpName }] = await Promise.all([
        findWardForCurrentGPS(),
        findCorpForCurrentGPS()
    ]);
    const escalation = await getEscalationForCorp(corpName);

    if (!wardNo && !oldWardNo && !corpName && !escalation) {
        successInfoDiv.classList.add('is-hidden');
        successInfoDiv.style.display = 'none';
        return;
    }

    let html = '<div class="success-location-card">';

    if (wardNo || wardName) {
        html += `<div class="success-location-row"><strong>📋 GBA Ward:</strong> ${escapeHtml([wardNo, wardName].filter(Boolean).join(' - '))}</div>`;
    }

    if (oldWardNo || oldWardName) {
        html += `<div class="success-location-row"><strong>📋 BBMP Ward:</strong> ${escapeHtml([oldWardNo, oldWardName].filter(Boolean).join(' - '))}</div>`;
    }

    if (corpName) {
        html += `<div class="success-location-row"><strong>🏛️ Corporation:</strong> ${escapeHtml(corpName)}</div>`;
    }

    const lat = window.currentGPS.lat;
    const lon = window.currentGPS.lon;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    html += `<div class="success-location-maps"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><strong>🗺️ View on Google Maps</strong></a></div>`;

    html += `<div class="success-helpline"><strong>For urgent civic issues, call:</strong> <a href="tel:1533">☎️ 1533</a></div>`;
    html += '<small class="success-helpline-note">Call to officially register your complaint with authorities</small>';

    html += renderEscalationContacts(escalation, lang);

    html += '</div>';

    successInfoDiv.innerHTML = html;
    successInfoDiv.classList.remove('is-hidden');
    successInfoDiv.style.display = 'block';
}

// Prepare civic email data for submission
export function prepareCivicEmailData(reportData, userEmail) {
    return prepareEmailData(reportData, { userEmail, flowType: 'civic' });
}
