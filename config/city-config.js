class CityConfigManager {
    constructor() {
        this.config = null;
        this.cityId = null;
    }

    _detectCityIdFromPath() {
        const path = window.location.pathname.toLowerCase();
        const rootMatch = path.match(/\/(kochi|tvm)(?:\/|$)/);
        if (rootMatch) return rootMatch[1];
        const citiesMatch = path.match(/\/cities\/(blr|kochi|tvm)(?:\/|$)/);
        if (citiesMatch) return citiesMatch[1];
        return null;
    }

    async loadConfig(cityId = null) {
        try {
            const basePath = this._getBasePath();
            console.log('Base path:', basePath);

            if (!cityId) {
                cityId = this._detectCityIdFromPath();
            }

            if (!cityId) {
                const activeUrl = `${basePath}config/active-city.json`;
                console.log('Fetching active city from:', activeUrl);
                const activeResponse = await fetch(activeUrl);
                if (!activeResponse.ok) {
                    throw new Error(`Failed to fetch active city config: ${activeResponse.status}`);
                }
                const activeData = await activeResponse.json();
                cityId = activeData.activeCity;
            }

            const configUrl = `${basePath}config/cities/${cityId}.json`;
            console.log('Fetching city config from:', configUrl);
            const configResponse = await fetch(configUrl);
            if (!configResponse.ok) {
                throw new Error(`City configuration not found: ${cityId} (${configResponse.status})`);
            }

            this.config = await configResponse.json();
            this.cityId = cityId;

            console.log(`✅ Loaded configuration for ${this.config.cityName}`);
            return this.config;
        } catch (error) {
            console.error('Failed to load city configuration:', error);
            throw error;
        }
    }

    getConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.');
        }
        return this.config;
    }

    getCityId() {
        return this.cityId;
    }

    getBBox() {
        return this.getConfig().boundaries.bbox;
    }

    isInBoundary(lat, lon) {
        const bbox = this.getBBox();
        return bbox.south <= lat && lat <= bbox.north &&
            bbox.west <= lon && lon <= bbox.east;
    }

    getAPIs() {
        return this.getConfig().apis;
    }

    getBoundaryFiles() {
        return this.getConfig().boundaries;
    }

    getSocialMedia() {
        return this.getConfig().socialMedia;
    }

    getRepresentativeHandle(constituency) {
        const handles = this.getSocialMedia().mlaHandles;
        return handles[constituency] || this.getSocialMedia().defaultHandle;
    }

    getIssueCategories(type = 'civic') {
        return this.getConfig().issueCategories[type] || [];
    }

    getLocalization() {
        return this.getConfig().localization || { defaultLanguage: 'en', availableLanguages: ['en'] };
    }

    getCityName(useLocal = false) {
        const config = this.getConfig();
        return useLocal && config.cityNameLocal ? config.cityNameLocal : config.cityName;
    }

    getMapDefaults() {
        const config = this.getConfig();
        if (config.mapDefaults) return config.mapDefaults;
        const bbox = this.getBBox();
        return {
            lat: (bbox.south + bbox.north) / 2,
            lon: (bbox.west + bbox.east) / 2,
            zoom: 12
        };
    }

    getWhatsApp() {
        return this.getConfig().whatsapp || null;
    }

    getBasePath() {
        return this._getBasePath();
    }

    _getBasePath() {
        const currentPath = window.location.pathname;
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

        if (currentDir.includes('/cities/')) {
            const afterCities = currentDir.substring(currentDir.lastIndexOf('/cities/') + 1);
            const segments = afterCities.split('/').filter(s => s.length > 0);
            return '../'.repeat(segments.length);
        }

        if (this._detectCityIdFromPath() && !currentDir.includes('/cities/')) {
            return '../';
        }

        return '';
    }
}

const cityConfig = new CityConfigManager();

export default cityConfig;
export { CityConfigManager };
