/**
 * Email Authorities Module
 * Handles optional email notifications to authorities based on ward and traffic PS mappings
 */

let emailAuthoritiesConfig = null;
let emailConfigPromise = null;

/**
 * Load email authorities configuration
 */
async function loadEmailConfig() {
    if (emailConfigPromise) return emailConfigPromise;

    emailConfigPromise = fetch('../../config/cities/blr-email-authorities.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load email config: ${response.status}`);
            }
            return response.json();
        })
        .then(config => {
            emailAuthoritiesConfig = config;
            console.log('✅ Email authorities config loaded');
            return config;
        })
        .catch(error => {
            console.error('❌ Failed to load email authorities config:', error);
            emailAuthoritiesConfig = null;
            throw error;
        });

    return emailConfigPromise;
}

/**
 * Get email addresses for a specific ward
 * @param {string} wardNo - Ward number
 * @returns {Array<string>} Array of email addresses
 */
function getWardEmails(wardNo) {
    if (!emailAuthoritiesConfig || !wardNo) return [];

    const wardData = emailAuthoritiesConfig.wardEmails[wardNo];
    return wardData ? wardData.emails : [];
}

/**
 * Get email addresses for a specific traffic police station
 * @param {string} psName - Police station name
 * @returns {Array<string>} Array of email addresses
 */
function getTrafficPSEmails(psName) {
    if (!emailAuthoritiesConfig || !psName) return [];

    const psData = emailAuthoritiesConfig.trafficPSEmails[psName];
    return psData ? psData.emails : [];
}

/**
 * Get contact information for a specific traffic police station
 * @param {string} psName - Police station name
 * @returns {Object|null} Object containing emails, mobile, and landline, or null if not found
 */
export function getTrafficPSContactInfo(psName) {
    console.log('🔍 getTrafficPSContactInfo called with:', psName);
    console.log('🔍 emailAuthoritiesConfig loaded:', !!emailAuthoritiesConfig);

    if (!emailAuthoritiesConfig || !psName) {
        console.log('🔍 No config or psName, returning null');
        return null;
    }

    // Try different name variations to match
    const namesToTry = [
        psName,
        psName.replace(' PS', ' Traffic PS'),  // "Whitefield PS" -> "Whitefield Traffic PS"
        psName.replace('Traffic PS', 'PS'),     // "Whitefield Traffic PS" -> "Whitefield PS"
        psName + ' Traffic PS',                 // Add if missing
        psName.replace(/\s+PS$/, '') + ' Traffic PS'  // Clean and add
    ];

    console.log('🔍 Trying name variations:', namesToTry);

    let psData = null;
    let matchedName = null;

    for (const name of namesToTry) {
        if (emailAuthoritiesConfig.trafficPSEmails[name]) {
            psData = emailAuthoritiesConfig.trafficPSEmails[name];
            matchedName = name;
            break;
        }
    }

    console.log('🔍 PS data found:', !!psData, 'using name:', matchedName);

    if (!psData) return null;

    return {
        emails: psData.emails || [],
        mobile: psData.mobile || null,
        landline: psData.landline || null
    };
}

/**
 * Get all relevant email addresses based on ward and traffic PS
 * @param {Object} locationData - Object containing wardNo and trafficPS
 * @param {string} flowType - 'civic' or 'traffic'
 * @returns {Array<string>} Array of unique email addresses
 */
export function getRelevantEmails(locationData = {}, flowType = 'traffic') {
    const { wardNo, trafficPS } = locationData;
    const emails = new Set();

    if (!emailAuthoritiesConfig) {
        console.warn('Email config not loaded');
        return [];
    }

    let settings = emailAuthoritiesConfig.emailSettings || {};

    // Support new format with separate civic/traffic settings
    if (settings[flowType]) {
        settings = settings[flowType];
    }

    // Add ward emails if enabled
    if (settings.includeWardEmail && wardNo) {
        getWardEmails(wardNo).forEach(email => emails.add(email));
    }

    // Add traffic PS emails if enabled
    if (settings.includeTrafficPSEmail && trafficPS) {
        getTrafficPSEmails(trafficPS).forEach(email => emails.add(email));
    }

    // Add default emails if enabled
    if (settings.includeDefaultEmail) {
        const defaultEmails = emailAuthoritiesConfig.defaultEmails || {};

        // For traffic flow, use trafficControl; for civic, use GBAemail
        if (flowType === 'traffic' && defaultEmails.trafficControl) {
            defaultEmails.trafficControl.forEach(email => emails.add(email));
        } else if (flowType === 'civic' && defaultEmails.GBAemail) {
            defaultEmails.GBAemail.forEach(email => emails.add(email));
        } else {
            // Legacy: include all defaults
            Object.values(defaultEmails).forEach(emailList => {
                emailList.forEach(email => emails.add(email));
            });
        }
    }

    return Array.from(emails);
}

/**
 * Format email subject
 * @param {string} category - Issue category
 * @param {string} location - Location description
 * @param {string} flowType - 'civic' or 'traffic'
 * @returns {string} Formatted subject line
 */
export function formatEmailSubject(category, location, flowType = 'traffic') {
    let settings = emailAuthoritiesConfig?.emailSettings || {};

    // Support new format with separate civic/traffic settings
    if (settings[flowType]) {
        settings = settings[flowType];
    }

    const prefix = settings.subjectPrefix || (flowType === 'civic' ? '[Civic Report]' : '[Traffic Report]');
    const categoryText = category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `${prefix} ${categoryText} - ${location}`;
}

/**
 * Format email body
 * @param {Object} reportData - Report data
 * @returns {string} Formatted email body
 */
export function formatEmailBody(reportData) {
    const {
        category,
        description,
        location,
        wardNo,
        wardName,
        trafficPS,
        timestamp,
        coordinates,
        tweetUrl
    } = reportData;

    let body = `Traffic Issue Report\n`;
    body += `======================\n\n`;
    body += `Issue Type: ${category}\n`;
    if (description) body += `Description: ${description}\n`;
    body += `\nLocation Details:\n`;
    body += `- Address: ${location}\n`;
    if (coordinates) {
        const mapUrl = `https://maps.google.com/?q=${coordinates.lat},${coordinates.lon}&ll=${coordinates.lat},${coordinates.lon}&z=18`;
        body += `- View on Google Maps: ${mapUrl}\n`;
    }
    if (wardNo && wardName) body += `- Ward: ${wardNo} (${wardName})\n`;
    if (trafficPS) body += `- Traffic PS: ${trafficPS}\n`;
    body += `\nReported: ${timestamp || new Date().toLocaleString()}\n`;
    if (tweetUrl) body += `\nTwitter Post: ${tweetUrl}\n`;
    body += `\n---\n`;
    body += `This report was submitted via Nāgarika Dhvani civic platform.\n`;

    return body;
}

/**
 * Check if email feature is enabled
 * @param {string} flowType - 'civic' or 'traffic'
 * @returns {boolean}
 */
export function isEmailEnabled(flowType = 'traffic') {
    if (!emailAuthoritiesConfig) return false;

    const settings = emailAuthoritiesConfig.emailSettings;
    if (!settings) return false;

    // New format with separate civic/traffic settings
    if (settings[flowType]) {
        return settings[flowType].enabled === true;
    }

    // Legacy format (backward compatibility)
    return settings.enabled === true;
}

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Initialize email module
 */
export async function initEmailModule() {
    try {
        await loadEmailConfig();
        return true;
    } catch (error) {
        console.error('Failed to initialize email module:', error);
        return false;
    }
}

/**
 * Prepare email data for backend
 * @param {Object} reportData - Report data
 * @param {Object} options - Additional options (userEmail for CC, flowType)
 * @returns {Object|null} Email data ready to send or null if email disabled
 */
export function prepareEmailData(reportData, options = {}) {
    const flowType = options.flowType || 'traffic';

    if (!isEmailEnabled(flowType)) {
        return null;
    }

    const emails = getRelevantEmails({
        wardNo: reportData.wardNo,
        trafficPS: reportData.trafficPS
    }, flowType);

    if (emails.length === 0) {
        console.warn('No relevant emails found for location');
        return null;
    }

    // Use category for traffic, issueType for civic
    const category = reportData.category || reportData.issueType || 'Issue';
    const location = reportData.location || reportData.description || 'Location on map';

    const emailData = {
        to: emails,
        subject: formatEmailSubject(category, location, flowType),
        body: formatEmailBody(reportData),
        attachments: reportData.imageData ? [{
            filename: flowType === 'civic' ? 'civic-issue.jpg' : 'traffic-issue.jpg',
            data: reportData.imageData,
            contentType: 'image/jpeg'
        }] : []
    };

    // Add user email to CC if provided
    if (options.userEmail && isValidEmail(options.userEmail)) {
        emailData.cc = [options.userEmail];
    }

    return emailData;
}

/**
 * Get email configuration (for debugging/info display)
 */
export function getEmailConfig() {
    return emailAuthoritiesConfig;
}

export default {
    initEmailModule,
    getRelevantEmails,
    prepareEmailData,
    isEmailEnabled,
    formatEmailSubject,
    formatEmailBody,
    getEmailConfig,
    isValidEmail
};
