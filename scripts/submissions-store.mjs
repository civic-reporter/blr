import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBMISSIONS_PATH = join(__dirname, '../data/cities/blr/submissions.json');

function readStore() {
    const raw = readFileSync(SUBMISSIONS_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.submissions)) {
        throw new Error('submissions.json must contain a submissions array');
    }
    return data;
}

function writeStore(data) {
    data.updated_at = new Date().toISOString();
    writeFileSync(SUBMISSIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeSubmission(raw) {
    const lat = Number(raw.lat ?? raw.latitude ?? raw.coordinates?.lat);
    const lon = Number(raw.lon ?? raw.longitude ?? raw.coordinates?.lon);

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
        timestamp: raw.timestamp || raw.created_at || new Date().toISOString()
    };
}

function validateSubmission(submission) {
    if (!Number.isFinite(submission.lat) || !Number.isFinite(submission.lon)) {
        throw new Error('Submission must include valid lat/lon');
    }
    if (!submission.issue_type) {
        throw new Error('Submission must include issue_type');
    }
}

export function appendSubmission(rawSubmission) {
    const submission = normalizeSubmission(rawSubmission);
    validateSubmission(submission);

    const store = readStore();
    const existingIds = new Set(store.submissions.map((item) => item.id));
    if (existingIds.has(submission.id)) {
        console.log(`Skipping duplicate submission id=${submission.id}`);
        return store;
    }

    store.submissions.push(submission);
    store.submissions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    writeStore(store);
    console.log(`Appended submission id=${submission.id} (total=${store.submissions.length})`);
    return store;
}

export function validateStore() {
    const store = readStore();
    store.submissions = store.submissions.map(normalizeSubmission);
    store.submissions.forEach(validateSubmission);

    const seen = new Set();
    store.submissions = store.submissions.filter((submission) => {
        if (seen.has(submission.id)) {
            return false;
        }
        seen.add(submission.id);
        return true;
    });

    writeStore(store);
    console.log(`Validated ${store.submissions.length} submissions`);
    return store;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const command = process.argv[2];

    if (command === 'validate') {
        validateStore();
    } else if (command === 'append') {
        const payload = process.argv[3] || process.env.CLIENT_PAYLOAD;
        if (!payload) {
            throw new Error('Usage: node scripts/submissions-store.mjs append \'<json>\'');
        }
        appendSubmission(JSON.parse(payload));
    } else {
        throw new Error('Usage: node scripts/submissions-store.mjs <validate|append>');
    }
}
