// leaderboard.js
// Fetches leaderboard data and populates the tables


// Utility to get city from query param, default to 'blr'
function getCity() {
    const params = new URLSearchParams(window.location.search);
    return params.get('city') || 'blr';
}

function renderLeaderboard(tableId, data, labelKey) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No data available</td></tr>';
        return;
    }
    data.forEach((row, idx) => {
        const label = row[labelKey] || '(Unknown)';
        const count = row.count || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx + 1}</td><td>${label}</td><td>${count}</td>`;
        tbody.appendChild(tr);
    });
}

function fetchAndRenderLeaderboards() {
    const city = getCity();
    // Pass city as query param to API
    fetch(`/lambda/retrieve-logs-lambda?city=${encodeURIComponent(city)}`)
        .then(res => res.json())
        .then(data => {
            renderLeaderboard('mla-table', data.mla_leaderboard, 'mla_handle');
            renderLeaderboard('constituency-table', data.constituency_leaderboard, 'constituency');
            renderLeaderboard('ward-table', data.ward_leaderboard, 'ward');
            // Optionally update page title/heading
            document.querySelector('h1').textContent = `🚨 Civic Issue Leaderboard – ${city.toUpperCase()}`;
        })
        .catch(err => {
            document.querySelectorAll('tbody').forEach(tb => {
                tb.innerHTML = '<tr><td colspan="3">Failed to load data</td></tr>';
            });
            console.error('Leaderboard fetch error:', err);
        });
}

document.addEventListener('DOMContentLoaded', fetchAndRenderLeaderboards);
