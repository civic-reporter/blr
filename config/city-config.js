class CityConfigManager {
    constructor() {
        this.config = null;
        this.cityId = null;
    }

    async loadConfig(cityId = null) {
        try {
            const basePath = this._getBasePath();
            console.log('Base path:', basePath);

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
        return this.getConfig().localization;
    }

    getCityName(useLocal = false) {
        const config = this.getConfig();
        return useLocal && config.cityNameLocal ? config.cityNameLocal : config.cityName;
    }

    getBasePath() {
        return this._getBasePath();
    }

    _getBasePath() {
        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop();
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

        let relativePath = '';
        if (currentDir.includes('/cities/')) {
            const afterCities = currentDir.substring(currentDir.lastIndexOf('/cities/') + 1);
            const segments = afterCities.split('/').filter(s => s.length > 0);
            relativePath = '../'.repeat(segments.length);
        }

        console.log('Current path:', currentPath);
        console.log('Current dir:', currentDir);
        console.log('Calculated base path:', relativePath);

        return relativePath;
    }
}

const cityConfig = new CityConfigManager();

export default cityConfig;
export { CityConfigManager };
