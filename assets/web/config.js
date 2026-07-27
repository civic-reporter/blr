import cityConfig from '../../config/city-config.js';

let CONFIG = null;
let MLA_HANDLES = null;
let MLA_NAMES = null;
let CITY_FEATURES = null;
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

            const localization = cityConfig.getLocalization();
            window.__cityLanguages = localization.availableLanguages || ['en'];
            window.__cityDefaultLang = localization.defaultLanguage || 'en';
            window.__cityStrings = localization.strings || {};
            window.__cityId = cityConfig.getCityId();
            window.__cityHomePath = config.pages?.home || 'index.html';

            CONFIG = {
                API_GATEWAY_URL: apis.civicApi || null,
                TRAFFIC_API_URL: apis.trafficApi || null,
                GOOGLE_MAPS_API_KEY: apis.googleMapsKey,
                HEATMAP_API_URL: apis.heatmapApi || null,
                HEATMAP_DATA_URL: apis.heatmapApi
                    ? null
                    : (apis.heatmapData ? basePath + apis.heatmapData : null),
                SUBMISSIONS_INGEST_URL: apis.submissionsIngestUrl || null,

                MAP_KML_URL: basePath + boundaries.mapKml,
                CONST_KML_URL: basePath + boundaries.constKml,
                WARD_KML_URL: basePath + boundaries.wardKml,
                OLD_WARD_KML_URL: boundaries.oldWardKml ? basePath + boundaries.oldWardKml : null,
                TRAFFIC_KML_URL: boundaries.trafficKml ? basePath + boundaries.trafficKml : null,
                MAP_DEFAULTS: cityConfig.getMapDefaults(),

                GBA_BBOX: cityConfig.getBBox(),
                WHATSAPP: cityConfig.getWhatsApp(),
                CITY_FEATURES: config.features || {}
            };

            MLA_HANDLES = config.socialMedia.mlaHandles;
            MLA_NAMES = config.socialMedia.mlaNames || {};
            CITY_FEATURES = config.features || {};
            window.__cityFeatures = CITY_FEATURES;

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

export async function getMlaNames() {
    if (!MLA_NAMES) {
        await startConfigLoad();
    }
    return MLA_NAMES;
}

export async function getCityFeatures() {
    if (!CITY_FEATURES) {
        await startConfigLoad();
    }
    return CITY_FEATURES || {};
}

export { CONFIG, MLA_HANDLES, MLA_NAMES, CITY_FEATURES, cityConfig, configPromise };

// Start loading city config as soon as this module is imported.
startConfigLoad();
