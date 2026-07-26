/**
 * Heat Map Module
 * Loads report data from the AWS heatmap API (or static submissions.json fallback).
 */

import { getConfig } from './config.js';
import { showStatus } from './ui.js';
import { fetchStaticHeatMapData, renderDataLastUpdated, showApiDataLastUpdated, showStaticDataLastUpdated } from './heatmap-aggregate.js';
import { getCurrentLanguage } from '../js/i18n.js';

let CONFIG = null;
let heatmapLayer = null;
let markerClusterGroup = null;

// Initialize heat map module
export async function initHeatMap() {
    CONFIG = await getConfig();
    console.log('🔥 Heat map module initialized');

    if (CONFIG.HEATMAP_DATA_URL) {
        await showStaticDataLastUpdated(CONFIG, 'dataLastUpdated', getCurrentLanguage());
    }
}

/**
 * Fetch logs from Lambda endpoint
 * @param {Object} filters - Filter options {type, start_date, end_date, issue_type, corporation, ward}
 * @returns {Promise<Object>} Heat map data
 */
export async function fetchHeatMapData(filters = {}) {
    if (!CONFIG) {
        CONFIG = await getConfig();
    }

    if (CONFIG.HEATMAP_API_URL) {
        return fetchHeatMapDataFromApi(CONFIG, filters);
    }

    if (CONFIG.HEATMAP_DATA_URL) {
        return fetchStaticHeatMapData(CONFIG, filters);
    }

    throw new Error('Heatmap data source is not configured');
}

async function fetchHeatMapDataFromApi(config, filters = {}) {
    const {
        type = 'both',
        start_date = null,
        end_date = null,
        issue_type = null,
        corporation = null,
        ward = null
    } = filters;

    const params = new URLSearchParams();
    params.append('type', type);

    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (issue_type) params.append('issue_type', issue_type);
    if (corporation) params.append('corporation', corporation);
    if (ward) params.append('ward', ward);

    const response = await fetch(`${config.HEATMAP_API_URL}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to fetch heat map data');
    }

    return data;
}

/**
 * Render heat map on the map
 * @param {Array} heatMapPoints - Array of heat map points from API
 */
export function renderHeatMap(heatMapPoints) {
    if (!window.map) {
        console.error('❌ Map not initialized');
        return;
    }

    // Clear existing heat map
    clearHeatMap();

    if (!heatMapPoints || heatMapPoints.length === 0) {
        showStatus('ℹ️ No data to display', 'info');
        return;
    }

    console.log(`🔥 Rendering heat map with ${heatMapPoints.length} points`);

    // Check if Leaflet.heat plugin is available
    if (typeof L.heatLayer !== 'undefined') {
        renderLeafletHeatMap(heatMapPoints);
    } else {
        // Fallback to marker clusters if heat map plugin not available
        console.warn('⚠️ Leaflet.heat not available, using marker clusters');
        renderMarkerClusters(heatMapPoints);
    }
}

/**
 * Render heat map using Leaflet.heat plugin
 */
function renderLeafletHeatMap(heatMapPoints) {
    // Convert to Leaflet.heat format: [lat, lon, intensity]
    const heatData = heatMapPoints.map(point => [
        point.lat,
        point.lon,
        point.intensity
    ]);

    // Create heat map layer
    heatmapLayer = L.heatLayer(heatData, {
        radius: 28,
        blur: 32,
        maxZoom: 17,
        max: 10,
        gradient: {
            0.0: '#4CAF50',
            0.3: '#8BC34A',
            0.45: '#FFC107',
            0.65: '#FF9800',
            1.0: '#F44336'
        }
    }).addTo(window.map);

    // Add clickable markers for details
    addHeatMapMarkers(heatMapPoints);
}

/**
 * Render marker clusters (fallback if heat map plugin not available)
 */
function renderMarkerClusters(heatMapPoints) {
    // Check if MarkerCluster plugin is available
    if (typeof L.markerClusterGroup === 'undefined') {
        console.error('❌ Neither Leaflet.heat nor MarkerCluster available');
        showStatus('❌ Heat map plugin not loaded', 'error');
        return;
    }

    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 80,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });

    heatMapPoints.forEach(point => {
        const marker = createHeatMapMarker(point);
        markerClusterGroup.addLayer(marker);
    });

    window.map.addLayer(markerClusterGroup);
}

/**
 * Add clickable markers for heat map points
 */
function addHeatMapMarkers(heatMapPoints) {
    // Limit markers to top hotspots to avoid clutter
    const topHotspots = heatMapPoints.slice(0, 50);

    topHotspots.forEach(point => {
        const marker = createHeatMapMarker(point);
        marker.addTo(window.map);
    });
}

function getIntensityClass(intensity) {
    if (intensity >= 10) return 'high';
    if (intensity >= 5) return 'medium-high';
    if (intensity >= 3) return 'medium';
    return 'low';
}

/**
 * Create a marker for a heat map point
 */
function createHeatMapMarker(point) {
    const intensityClass = getIntensityClass(point.intensity);

    const icon = L.divIcon({
        className: 'heatmap-marker',
        html: `<div class="heatmap-marker-dot heatmap-marker-dot--${intensityClass}">${point.intensity}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([point.lat, point.lon], { icon });
    marker.bindPopup(createHeatMapPopup(point));
    return marker;
}

/**
 * Create popup content for heat map point
 */
function createHeatMapPopup(point) {
    const issueCountsHtml = Object.entries(point.issue_counts || {})
        .map(([type, count]) => `<li><strong>${type}:</strong> ${count}</li>`)
        .join('');

    const submissionsHtml = (point.submissions || [])
        .slice(0, 5)
        .map(sub => `
            <div class="heatmap-popup-submission">
                <strong>${sub.issue_type}</strong>
                <time>${new Date(sub.timestamp).toLocaleString()}</time>
                <div>${sub.description || 'No description'}</div>
            </div>
        `)
        .join('');

    return `
        <div class="heatmap-popup">
            <h3 class="heatmap-popup-title">${point.intensity} report${point.intensity > 1 ? 's' : ''}</h3>

            <div class="heatmap-popup-section">
                <strong>Primary issue</strong>
                ${point.issue_type}
            </div>

            ${issueCountsHtml ? `
                <div class="heatmap-popup-section">
                    <strong>Issue breakdown</strong>
                    <ul class="heatmap-popup-list">${issueCountsHtml}</ul>
                </div>
            ` : ''}

            <div class="heatmap-popup-section">
                <strong>Location</strong>
                ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
                <a class="heatmap-popup-link" href="https://www.google.com/maps?q=${point.lat},${point.lon}" target="_blank" rel="noopener noreferrer">View on Google Maps</a>
            </div>

            <div class="heatmap-popup-section">
                <strong>Most recent</strong>
                ${new Date(point.recent_timestamp).toLocaleString()}
            </div>

            ${submissionsHtml ? `
                <div class="heatmap-popup-submissions">
                    <strong>Recent submissions</strong>
                    ${submissionsHtml}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Clear existing heat map from the map
 */
export function clearHeatMap() {
    if (heatmapLayer) {
        window.map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    if (markerClusterGroup) {
        window.map.removeLayer(markerClusterGroup);
        markerClusterGroup = null;
    }

    // Remove all heatmap markers
    window.map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.icon?.options?.className === 'heatmap-marker') {
            window.map.removeLayer(layer);
        }
    });

    console.log('🧹 Heat map cleared');
}

/**
 * Load heat map with filters
 * @param {Object} filters - Filter options
 */
export async function loadHeatMap(filters = {}) {
    // Show persistent loading message and disable button
    const loadBtn = document.getElementById('loadHeatMapBtn');
    if (loadBtn) loadBtn.disabled = true;
    showStatus('📊 Loading heatmap...', 'info');
    try {
        const data = await fetchHeatMapData(filters);
        let heatMapPoints = data.heat_map_points || [];
        if (filters.wardRings && Array.isArray(filters.wardRings) && filters.wardRings.length) {
            heatMapPoints = heatMapPoints.filter((point) =>
                isPointInsideAnyWardRing(point.lat, point.lon, filters.wardRings)
            );
        }

        renderHeatMap(heatMapPoints);
        // Fit map to selected viewport when provided, else fall back to city bounds
        if (window.map) {
            if (filters.viewportBounds) {
                const bounds = L.latLngBounds(
                    L.latLng(filters.viewportBounds.south, filters.viewportBounds.west),
                    L.latLng(filters.viewportBounds.north, filters.viewportBounds.east)
                );
                window.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
            } else if (CONFIG && CONFIG.GBA_BBOX) {
                const bbox = CONFIG.GBA_BBOX;
                const bounds = L.latLngBounds(
                    L.latLng(bbox.south, bbox.west),
                    L.latLng(bbox.north, bbox.east)
                );
                window.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
            }
        }
        // Hide loading message after rendering
        const countForDisplay = filters.wardRings ? heatMapPoints.length : data.count;
        showStatus(`✅ Loaded ${countForDisplay} submissions`, 'success');
        if (data.updated_at || data.date_range?.end) {
            showApiDataLastUpdated(data, 'dataLastUpdated', getCurrentLanguage());
        }
        if (loadBtn) loadBtn.disabled = false;

        window.dispatchEvent(new CustomEvent('heatMapLoaded', {
            detail: heatMapPoints
        }));

        return {
            ...data,
            heat_map_points: heatMapPoints,
            count: countForDisplay
        };
    } catch (error) {
        console.error('❌ Failed to load heat map:', error);
        showStatus(`❌ Failed to load heat map: ${error.message}`, 'error');
        if (loadBtn) loadBtn.disabled = false;
        throw error;
    }
}

function isPointInsideAnyWardRing(lat, lon, wardRings) {
    return wardRings.some((ring) => isPointInsideRing(lat, lon, ring));
}

function isPointInsideRing(lat, lon, ring) {
    if (!Array.isArray(ring) || ring.length < 3) {
        return false;
    }

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const yi = ring[i][0];
        const xi = ring[i][1];
        const yj = ring[j][0];
        const xj = ring[j][1];

        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}
