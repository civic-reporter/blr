import cityConfig from '../../config/city-config.js';

console.log('⏳ Starting config initialization...');

try {
    await cityConfig.loadConfig();
    console.log('✅ City config loaded successfully');
} catch (error) {
    console.error('❌ Failed to load city config:', error);
    throw error;
}

const config = cityConfig.getConfig();
const apis = cityConfig.getAPIs();
const boundaries = cityConfig.getBoundaryFiles();
const basePath = cityConfig.getBasePath();

console.log('⏳ Building CONFIG object...');

export const CONFIG = {
    API_GATEWAY_URL: apis.civicApi,
    TRAFFIC_API_URL: apis.trafficApi,
    GOOGLE_MAPS_API_KEY: apis.googleMapsKey,

    MAP_KML_URL: basePath + boundaries.mapKml,
    CONST_KML_URL: basePath + boundaries.constKml,
    WARD_KML_URL: basePath + boundaries.wardKml,
    TRAFFIC_KML_URL: basePath + boundaries.trafficKml,

    GBA_BBOX: cityConfig.getBBox()
};

console.log('✅ CONFIG initialized:');
console.log('  MAP_KML_URL:', CONFIG.MAP_KML_URL);
console.log('  WARD_KML_URL:', CONFIG.WARD_KML_URL);
console.log('  CONST_KML_URL:', CONFIG.CONST_KML_URL);
console.log('  TRAFFIC_KML_URL:', CONFIG.TRAFFIC_KML_URL);

export const MLA_HANDLES = config.socialMedia.mlaHandles;

export { cityConfig };
