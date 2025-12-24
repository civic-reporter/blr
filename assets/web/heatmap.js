/**
 * Heat Map Module
 * Retrieves logs from S3 via Lambda and displays heat map on the map
 */

import { getConfig } from './config.js';
import { showStatus } from './ui.js';

let CONFIG = null;
let heatmapLayer = null;
let markerClusterGroup = null;

// Initialize heat map module
export async function initHeatMap() {
    CONFIG = await getConfig();
    console.log('🔥 Heat map module initialized');
}

/**
 * Fetch logs from Lambda endpoint
 * @param {Object} filters - Filter options {type, start_date, end_date, issue_type}
 * @returns {Promise<Object>} Heat map data
 */
export async function fetchHeatMapData(filters = {}) {
    const {
        type = 'both',
        start_date = null,
        end_date = null,
        issue_type = null
    } = filters;

    try {
        showStatus('📊 Loading heat map data...', 'info');

        // Build query parameters
        const params = new URLSearchParams();
        params.append('type', type);

        if (start_date) {
            params.append('start_date', start_date);
        }
        if (end_date) {
            params.append('end_date', end_date);
        }
        if (issue_type) {
            params.append('issue_type', issue_type);
        }

        // Call Lambda endpoint (configure in config.js)
        const response = await fetch(`${CONFIG.HEATMAP_API_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch heat map data');
        }

        showStatus(`✅ Loaded ${data.count} submissions`, 'success');

        return data;
    } catch (error) {
        console.error('❌ Error fetching heat map data:', error);
        showStatus(`❌ Failed to load heat map: ${error.message}`, 'error');
        throw error;
    }
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
        radius: 25,
        blur: 35,
        maxZoom: 17,
        max: 10,  // Max intensity for color scaling
        gradient: {
            0.0: 'blue',
            0.3: 'cyan',
            0.5: 'lime',
            0.7: 'yellow',
            1.0: 'red'
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

/**
 * Create a marker for a heat map point
 */
function createHeatMapMarker(point) {
    // Color based on intensity
    let color = '#4CAF50';
    if (point.intensity >= 10) {
        color = '#F44336';  // Red for high intensity
    } else if (point.intensity >= 5) {
        color = '#FF9800';  // Orange for medium intensity
    } else if (point.intensity >= 3) {
        color = '#FFC107';  // Amber for low-medium intensity
    }

    // Create custom icon
    const icon = L.divIcon({
        className: 'heatmap-marker',
        html: `<div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
        ">${point.intensity}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([point.lat, point.lon], { icon });

    // Create popup with details
    const popup = createHeatMapPopup(point);
    marker.bindPopup(popup);

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
            <div style="border-top: 1px solid #eee; padding: 8px 0; font-size: 12px;">
                <div><strong>${sub.issue_type}</strong></div>
                <div style="color: #666;">${new Date(sub.timestamp).toLocaleString()}</div>
                <div style="margin-top: 4px;">${sub.description || 'No description'}</div>
            </div>
        `)
        .join('');

    return `
        <div style="min-width: 250px; max-width: 350px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">
                📍 ${point.intensity} Report${point.intensity > 1 ? 's' : ''}
            </h3>
            
            <div style="margin-bottom: 10px;">
                <strong>Primary Issue:</strong> ${point.issue_type}
            </div>
            
            ${issueCountsHtml ? `
                <div style="margin-bottom: 10px;">
                    <strong>Issue Breakdown:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${issueCountsHtml}
                    </ul>
                </div>
            ` : ''}
            
            <div style="margin-bottom: 10px;">
                <strong>Location:</strong><br>
                ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
                <a href="https://www.google.com/maps?q=${point.lat},${point.lon}" 
                   target="_blank" 
                   style="margin-left: 10px;">View on Google Maps</a>
            </div>
            
            <div style="margin-bottom: 10px;">
                <strong>Most Recent:</strong><br>
                ${new Date(point.recent_timestamp).toLocaleString()}
            </div>
            
            ${submissionsHtml ? `
                <div style="margin-top: 15px; border-top: 2px solid #ddd; padding-top: 10px;">
                    <strong>Recent Submissions:</strong>
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
    try {
        const data = await fetchHeatMapData(filters);
        renderHeatMap(data.heat_map_points);
        return data;
    } catch (error) {
        console.error('❌ Failed to load heat map:', error);
        throw error;
    }
}
