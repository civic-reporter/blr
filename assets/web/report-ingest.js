/**
 * Optional civic report ingest hook for static heatmap pipeline.
 */

import { getConfig } from './config.js';
import { normalizeSubmission } from './heatmap-aggregate.js';

export function buildCivicSubmission(reportData) {
    return normalizeSubmission({
        type: 'civic',
        lat: Number(reportData.coordinates?.lat),
        lon: Number(reportData.coordinates?.lon),
        issue_type: reportData.issueType,
        description: reportData.description || '',
        ward_no: reportData.wardNo || '',
        ward_name: reportData.wardName || '',
        corp_name: reportData.corpName || '',
        constituency: reportData.constituency || '',
        timestamp: new Date().toISOString()
    });
}

export async function recordCivicReport(reportData) {
    const submission = buildCivicSubmission(reportData);
    const config = await getConfig();

    const ingestUrl = config.SUBMISSIONS_INGEST_URL || config.API_GATEWAY_URL;
    if (!ingestUrl) {
        return { recorded: false, reason: 'not-configured' };
    }

    try {
        const response = await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission),
            keepalive: true
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return { recorded: true };
    } catch (error) {
        console.warn('Civic report ingest failed:', error);
        return { recorded: false, reason: error.message };
    }
}
