import { getConfig, getMlaHandles } from '../web/config.js';

function setLoadingState(isLoading) {
    const button = document.getElementById('loadLeaderboardBtn');
    if (!button) {
        return;
    }

    const label = button.querySelector('.btn-label');
    button.disabled = isLoading;
    button.classList.toggle('loading', isLoading);
    label.textContent = isLoading ? 'Loading leaderboard...' : 'Reload leaderboard';
}

function renderEmptyState(tableId, colspan, message) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colspan}">${message}</td></tr>`;
}

function normalizeHandle(handle) {
    if (!handle) {
        return '';
    }

    return handle.startsWith('@') ? handle : `@${handle}`;
}

function renderWardLeaderboard(data) {
    const tbody = document.querySelector('#ward-table tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmptyState('ward-table', 5, 'No data available');
        return;
    }

    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.ward_name || 'Unknown'}</td>
            <td>${row.corp_name || 'Unknown'}</td>
            <td>${row.constituency || 'Unknown'}</td>
            <td>${row.count || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderConstituencyLeaderboard(data) {
    const tbody = document.querySelector('#constituency-table tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmptyState('constituency-table', 3, 'No data available');
        return;
    }

    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.constituency || 'Unknown'}</td>
            <td>${row.count || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMlaLeaderboard(data, mlaHandles) {
    const tbody = document.querySelector('#mla-table tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmptyState('mla-table', 4, 'No data available');
        return;
    }

    data.forEach((row, idx) => {
        const constituency = row.constituency || 'Unknown';
        const handle = normalizeHandle(mlaHandles?.[constituency] || '');
        const handleCell = handle
            ? `<a href="https://x.com/${handle.replace('@', '')}" target="_blank" rel="noopener noreferrer">${handle}</a>`
            : 'Unavailable';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${constituency}</td>
            <td>${handleCell}</td>
            <td>${row.count || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchAndRenderLeaderboards() {
    setLoadingState(true);

    try {
        const [config, mlaHandles] = await Promise.all([getConfig(), getMlaHandles()]);
        const response = await fetch(`${config.HEATMAP_API_URL}?type=civic`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load leaderboard data');
        }

        renderWardLeaderboard(data.ward_leaderboard);
        renderConstituencyLeaderboard(data.constituency_leaderboard);
        renderMlaLeaderboard(data.mla_leaderboard, mlaHandles);
    } catch (error) {
        renderEmptyState('ward-table', 5, 'Failed to load data');
        renderEmptyState('constituency-table', 3, 'Failed to load data');
        renderEmptyState('mla-table', 4, 'Failed to load data');
        console.error('Leaderboard fetch error:', error);
    } finally {
        setLoadingState(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loadButton = document.getElementById('loadLeaderboardBtn');
    if (loadButton) {
        loadButton.addEventListener('click', fetchAndRenderLeaderboards);
    }

    fetchAndRenderLeaderboards();
});
