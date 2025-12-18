// Configuration - Dynamically loaded from city config
import cityConfig from '../config/city-config.js';

// Initialize city configuration
await cityConfig.loadConfig();

const config = cityConfig.getConfig();
const apis = cityConfig.getAPIs();
const boundaries = cityConfig.getBoundaryFiles();

// Export configuration for backward compatibility
export const CONFIG = {
    // API endpoints
    API_GATEWAY_URL: apis.civicApi,
    TRAFFIC_API_URL: apis.trafficApi,
    GOOGLE_MAPS_API_KEY: apis.googleMapsKey,

    // Jurisdiction data files
    MAP_KML_URL: boundaries.mapKml,
    CONST_KML_URL: boundaries.constKml,
    WARD_KML_URL: boundaries.wardKml,
    TRAFFIC_KML_URL: boundaries.trafficKml,

    // Geographic boundary
    GBA_BBOX: cityConfig.getBBox()
};

// Export MLA handles
export const MLA_HANDLES = config.socialMedia.mlaHandles;

// Export city configuration manager for direct access
export { cityConfig };
