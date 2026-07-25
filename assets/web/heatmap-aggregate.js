/**
 * Client-side aggregation for static submissions.json heatmap data.
 */

import { t } from '../js/i18n.js';

let cachedSubmissions = null;
let cachedUpdatedAt = null;
let cachedUrl = null;

function parseTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeSubmission(raw) {
    const lat = Number(raw.lat ?? raw.latitude ?? raw.coordinates?.lat);
    const lon = Number(raw.lon ?? raw.longitude ?? raw.coordinates?.lon);
    const timestamp = raw.timestamp || raw.created_at || new Date().toISOString();

    return {
        id: raw.id || `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: raw.type || raw.report_type || 'civic',
        lat,
        lon,
        issue_type: raw.issue_type || raw.issueType || 'Other',
        description: raw.description || '',
        ward_no: raw.ward_no ?? raw.wardNo ?? '',
        ward_name: raw.ward_name ?? raw.wardName ?? '',
        corp_name: raw.corp_name ?? raw.corpName ?? '',
        constituency: raw.constituency || '',
        timestamp
    };
}

export async function loadSubmissionsPayload(config) {
    const url = config.HEATMAP_DATA_URL;
    if (!url) {
        throw new Error('Static heatmap data URL is not configured');
    }

    if (cachedSubmissions && cachedUrl === url) {
        return {
            submissions: cachedSubmissions,
            updated_at: cachedUpdatedAt
        };
    }

    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error(`Failed to load submissions (${response.status})`);
    }

    const payload = await response.json();
    cachedSubmissions = (payload.submissions || []).map(normalizeSubmission);
    cachedUpdatedAt = payload.updated_at || null;
    cachedUrl = url;

    return {
        submissions: cachedSubmissions,
        updated_at: cachedUpdatedAt
    };
}

export async function loadSubmissions(config) {
    const payload = await loadSubmissionsPayload(config);
    return payload.submissions;
}

export function formatDataUpdatedAt(isoString, lang = 'en') {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(lang === 'kn' ? 'kn-IN' : 'en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export function renderDataLastUpdated(updatedAt, elementId = 'dataLastUpdated', lang = 'en') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const formatted = formatDataUpdatedAt(updatedAt, lang);
    if (!formatted) {
        el.textContent = '';
        el.classList.add('is-hidden');
        return;
    }

    el.textContent = t('dataLastUpdated', lang).replace('{time}', formatted);
    el.classList.remove('is-hidden');
}

export async function showStaticDataLastUpdated(config, elementId = 'dataLastUpdated', lang = 'en') {
    const payload = await loadSubmissionsPayload(config);
    renderDataLastUpdated(payload.updated_at, elementId, lang);
    return payload.updated_at;
}

export function filterSubmissions(submissions, filters = {}) {
    const {
        type = 'both',
        start_date = null,
        end_date = null,
        issue_type = null,
        corporation = null,
        ward = null
    } = filters;

    let filtered = submissions;

    if (type && type !== 'both') {
        filtered = filtered.filter((item) => item.type === type);
    }

    if (start_date) {
        const start = parseTimestamp(`${start_date}T00:00:00`);
        if (start) {
            filtered = filtered.filter((item) => {
                const ts = parseTimestamp(item.timestamp);
                return ts && ts >= start;
            });
        }
    }

    if (end_date) {
        const end = parseTimestamp(`${end_date}T23:59:59.999`);
        if (end) {
            filtered = filtered.filter((item) => {
                const ts = parseTimestamp(item.timestamp);
                return ts && ts <= end;
            });
        }
    }

    if (issue_type) {
        filtered = filtered.filter((item) => item.issue_type === issue_type);
    }

    if (corporation) {
        filtered = filtered.filter((item) => item.corp_name === corporation);
    }

    if (ward) {
        filtered = filtered.filter((item) =>
            String(item.ward_no) === String(ward) ||
            item.ward_name === ward
        );
    }

    return filtered;
}

export function aggregateHeatMapPoints(submissions) {
    const clusters = new Map();

    submissions.forEach((submission) => {
        if (!Number.isFinite(submission.lat) || !Number.isFinite(submission.lon)) {
            return;
        }

        const key = `${submission.lat.toFixed(4)},${submission.lon.toFixed(4)}`;
        if (!clusters.has(key)) {
            clusters.set(key, {
                lat: submission.lat,
                lon: submission.lon,
                intensity: 0,
                issue_type: submission.issue_type,
                issue_counts: {},
                submissions: [],
                recent_timestamp: submission.timestamp
            });
        }

        const cluster = clusters.get(key);
        cluster.intensity += 1;
        cluster.issue_counts[submission.issue_type] =
            (cluster.issue_counts[submission.issue_type] || 0) + 1;
        cluster.submissions.push({
            issue_type: submission.issue_type,
            timestamp: submission.timestamp,
            description: submission.description
        });

        if (new Date(submission.timestamp) > new Date(cluster.recent_timestamp)) {
            cluster.recent_timestamp = submission.timestamp;
            cluster.issue_type = submission.issue_type;
        }
    });

    return Array.from(clusters.values())
        .map((cluster) => ({
            ...cluster,
            submissions: cluster.submissions
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
        }))
        .sort((a, b) => b.intensity - a.intensity);
}

export function buildWardLeaderboard(submissions) {
    const counts = new Map();

    submissions.forEach((submission) => {
        const key = [
            submission.ward_no || '',
            submission.ward_name || '',
            submission.corp_name || '',
            submission.constituency || ''
        ].join('|');

        if (!counts.has(key)) {
            counts.set(key, {
                ward_no: submission.ward_no || '',
                ward_name: submission.ward_name || 'Unknown',
                corp_name: submission.corp_name || 'Unknown',
                constituency: submission.constituency || 'Unknown',
                count: 0
            });
        }

        counts.get(key).count += 1;
    });

    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export function buildConstituencyLeaderboard(submissions) {
    const counts = new Map();

    submissions.forEach((submission) => {
        const name = submission.constituency || 'Unknown';
        counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([constituency, count]) => ({ constituency, count }))
        .sort((a, b) => b.count - a.count);
}

export function buildMlaLeaderboard(submissions) {
    return buildConstituencyLeaderboard(submissions).map(({ constituency, count }) => ({
        constituency,
        count
    }));
}

export function buildHeatmapPayload(submissions, filters = {}) {
    const filtered = filterSubmissions(submissions, filters);

    return {
        success: true,
        source: 'static',
        count: filtered.length,
        heat_map_points: aggregateHeatMapPoints(filtered),
        ward_leaderboard: buildWardLeaderboard(filtered),
        constituency_leaderboard: buildConstituencyLeaderboard(filtered),
        mla_leaderboard: buildMlaLeaderboard(filtered)
    };
}

export async function fetchStaticHeatMapData(config, filters = {}) {
    const payload = await loadSubmissionsPayload(config);
    const result = buildHeatmapPayload(payload.submissions, filters);
    result.updated_at = payload.updated_at;
    return result;
}
