/**
 * Civic Email Support Module
 * Handles email functionality for civic submissions
 */

import { isEmailEnabled, getRelevantEmails, isValidEmail, prepareEmailData } from './email-authorities.js';
import { isInGBA } from './utils.js';
import { findWardForCurrentGPS, findCorpForCurrentGPS } from './validation.js';

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

// Display ward and corporation info on success screen
export async function displaySuccessLocationInfo() {
    const successInfoDiv = document.getElementById('successLocationInfo');
    if (!successInfoDiv) return;

    if (!window.currentGPS || !isInGBA(window.currentGPS.lat, window.currentGPS.lon)) {
        successInfoDiv.style.display = 'none';
        return;
    }

    const [{ wardNo, wardName }, { corpName }] = await Promise.all([
        findWardForCurrentGPS(),
        findCorpForCurrentGPS()
    ]);

    if (!wardNo && !corpName) {
        successInfoDiv.style.display = 'none';
        return;
    }

    let html = '';

    if (wardNo && wardName) {
        html += `<div><strong>📋 Ward:</strong> ${wardNo} - ${wardName}</div>`;
    }

    if (corpName) {
        html += `<div><strong>🏛️ Corporation:</strong> ${corpName}</div>`;
    }

    // Add Google Maps link
    const lat = window.currentGPS.lat;
    const lon = window.currentGPS.lon;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    html += `<div><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: none;"><strong>🗺️ View on Google Maps</strong></a></div>`;

    // Add helpline info
    html += `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);"><strong>For urgent civic issues, call:</strong> <a href="tel:1533" style="color: var(--primary-color); text-decoration: none;">☎️ 1533</a></div>`;

    successInfoDiv.innerHTML = html;
    successInfoDiv.style.display = 'block';
}

// Prepare civic email data for submission
export function prepareCivicEmailData(reportData, userEmail) {
    return prepareEmailData(reportData, { userEmail, flowType: 'civic' });
}
