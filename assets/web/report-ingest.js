/**
 * Optional civic report ingest hook for static heatmap pipeline.
 */

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
    return { recorded: false, reason: 'disabled' };
}
