import { getConfig, getMlaHandles } from '../web/config.js';
import { t, getCurrentLanguage } from './i18n.js';
import { fetchHeatMapData } from '../web/heatmap.js';
import { showApiDataLastUpdated, showStaticDataLastUpdated } from '../web/heatmap-aggregate.js';

function tr(key) {
    return t(key, getCurrentLanguage());
}

function setLoadingState(isLoading) {
    const button = document.getElementById('loadLeaderboardBtn');
    if (!button) {
        return;
    }

    const label = button.querySelector('.btn-label');
    button.disabled = isLoading;
    button.classList.toggle('loading', isLoading);
    label.textContent = isLoading ? tr('leaderboardLoading') : tr('reloadLeaderboard');
}

function renderEmptyState(tableId, colspan, message) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;color:var(--x-text-secondary);padding:2rem;">${message}</td></tr>`;
}

function rankCell(idx) {
    const medals = ['🥇', '🥈', '🥉'];
    if (idx < 3) return `<td class="rank-cell medal">${medals[idx]}</td>`;
    return `<td class="rank-cell">${idx + 1}</td>`;
}

function countBadge(count) {
    return `<span class="issue-count-badge">${count || 0}</span>`;
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
        renderEmptyState('ward-table', 5, tr('noDataAvailable'));
        return;
    }

    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        if (idx < 3) tr.classList.add('top-rank');
        tr.innerHTML = `
            ${rankCell(idx)}
            <td>${row.ward_name || tr('unknown')}</td>
            <td>${row.corp_name || tr('unknown')}</td>
            <td>${row.constituency || tr('unknown')}</td>
            <td class="count-cell">${countBadge(row.count)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderConstituencyLeaderboard(data) {
    const tbody = document.querySelector('#constituency-table tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmptyState('constituency-table', 3, tr('noDataAvailable'));
        return;
    }

    data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        if (idx < 3) tr.classList.add('top-rank');
        tr.innerHTML = `
            ${rankCell(idx)}
            <td>${row.constituency || tr('unknown')}</td>
            <td class="count-cell">${countBadge(row.count)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMlaLeaderboard(data, mlaHandles) {
    const tbody = document.querySelector('#mla-table tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        renderEmptyState('mla-table', 4, tr('noDataAvailable'));
        return;
    }

    data.forEach((row, idx) => {
        const constituency = row.constituency || tr('unknown');
        const handle = normalizeHandle(mlaHandles?.[constituency] || '');
        const handleCell = handle
            ? `<a href="https://x.com/${handle.replace('@', '')}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt" style="margin-right:4px;font-size:0.85em;"></i>${handle}</a>`
            : '<span style="color:var(--x-text-secondary)">—</span>';

        const tr = document.createElement('tr');
        if (idx < 3) tr.classList.add('top-rank');
        tr.innerHTML = `
            ${rankCell(idx)}
            <td>${constituency}</td>
            <td>${handleCell}</td>
            <td class="count-cell">${countBadge(row.count)}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchAndRenderLeaderboards() {
    setLoadingState(true);

    try {
        const [config, mlaHandles] = await Promise.all([getConfig(), getMlaHandles()]);

        if (config.HEATMAP_API_URL) {
            const data = await fetchHeatMapData({ type: 'civic' });
            renderWardLeaderboard(data.ward_leaderboard);
            renderConstituencyLeaderboard(data.constituency_leaderboard);
            renderMlaLeaderboard(data.mla_leaderboard, mlaHandles);
            showApiDataLastUpdated(data, 'dataLastUpdated', getCurrentLanguage());
            return;
        }

        if (config.HEATMAP_DATA_URL) {
            const { fetchStaticHeatMapData } = await import('../web/heatmap-aggregate.js');
            const data = await fetchStaticHeatMapData(config, { type: 'civic' });
            renderWardLeaderboard(data.ward_leaderboard);
            renderConstituencyLeaderboard(data.constituency_leaderboard);
            renderMlaLeaderboard(data.mla_leaderboard, mlaHandles);
            if (data.updated_at) {
                await showStaticDataLastUpdated(config, 'dataLastUpdated', getCurrentLanguage());
            }
            return;
        }

        throw new Error('Leaderboard data source is not configured');
    } catch (error) {
        renderEmptyState('ward-table', 5, tr('failedToLoadData'));
        renderEmptyState('constituency-table', 3, tr('failedToLoadData'));
        renderEmptyState('mla-table', 4, tr('failedToLoadData'));
        console.error('Leaderboard fetch error:', error);
    } finally {
        setLoadingState(false);
    }
}

window.addEventListener('languageChanged', () => {
    fetchAndRenderLeaderboards();
});

document.addEventListener('DOMContentLoaded', () => {
    const loadButton = document.getElementById('loadLeaderboardBtn');
    if (loadButton) {
        loadButton.addEventListener('click', fetchAndRenderLeaderboards);
    }
    fetchAndRenderLeaderboards();
});
