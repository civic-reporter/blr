import cityConfig from '../../config/city-config.js';

let CONFIG = null;
let MLA_HANDLES = null;
let configPromise = null;

function startConfigLoad() {
    if (configPromise) return configPromise;

    console.log('⏳ Starting config initialization...');
    configPromise = cityConfig.loadConfig()
        .then(() => {
            console.log('✅ City config loaded successfully');
            const config = cityConfig.getConfig();
            const apis = cityConfig.getAPIs();
            const boundaries = cityConfig.getBoundaryFiles();
            const basePath = cityConfig.getBasePath();

            CONFIG = {
                API_GATEWAY_URL: apis.civicApi,
                TRAFFIC_API_URL: apis.trafficApi,
                GOOGLE_MAPS_API_KEY: apis.googleMapsKey,

                MAP_KML_URL: basePath + boundaries.mapKml,
                CONST_KML_URL: basePath + boundaries.constKml,
                WARD_KML_URL: basePath + boundaries.wardKml,
                TRAFFIC_KML_URL: basePath + boundaries.trafficKml,

                GBA_BBOX: cityConfig.getBBox()
            };

            MLA_HANDLES = config.socialMedia.mlaHandles;

            console.log('✅ CONFIG initialized:');
            console.log('  MAP_KML_URL:', CONFIG.MAP_KML_URL);
            console.log('  WARD_KML_URL:', CONFIG.WARD_KML_URL);
            console.log('  CONST_KML_URL:', CONFIG.CONST_KML_URL);
            console.log('  TRAFFIC_KML_URL:', CONFIG.TRAFFIC_KML_URL);

            return CONFIG;
        })
        .catch(error => {
            console.error('❌ Failed to load city config:', error);
            throw error;
        });

    return configPromise;
}

export async function getConfig() {
    if (!CONFIG) {
        await startConfigLoad();
    }
    return CONFIG;
}

export async function getMlaHandles() {
    if (!MLA_HANDLES) {
        await startConfigLoad();
    }
    return MLA_HANDLES;
}

export { CONFIG, MLA_HANDLES, cityConfig, configPromise };
