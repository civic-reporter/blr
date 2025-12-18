# Configuration Guide: Multi-City Setup

This guide explains how to configure the application for any municipality or city.

## Directory Structure

```
config/
  cities/
    bangalore.json      # Bengaluru configuration
    mysore.json        # Example: Mysore configuration
    delhi.json         # Example: Delhi configuration
  city-config.js       # City configuration loader
```

## Adding a New City

### 1. Create City Configuration File

Create a new JSON file in `config/cities/` (e.g., `mysore.json`):

```json
{
  "cityId": "mysore",
  "cityName": "Mysore",
  "cityNameLocal": "ಮೈಸೂರು",
  "tagline": "Mysore's Civic Reporting Platform",
  "taglineLocal": "ಮೈಸೂರು ನಾಗರಿಕ ವರದಿ ವೇದಿಕೆ",
  
  "boundaries": {
    "bbox": {
      "south": 12.20,
      "north": 12.40,
      "west": 76.55,
      "east": 76.75
    },
    "mapKml": "assets/data/cities/mysore/map.kml",
    "constKml": "assets/data/cities/mysore/constituencies.kml",
    "wardKml": "assets/data/cities/mysore/wards.kml",
    "trafficKml": "assets/data/cities/mysore/traffic.kml"
  },
  
  "apis": {
    "civicApi": "https://your-api-gateway.com/mysore-civic",
    "trafficApi": "https://your-api-gateway.com/mysore-traffic",
    "googleMapsKey": "YOUR_GOOGLE_API_KEY"
  },
  
  "socialMedia": {
    "defaultHandle": "@MysoreCityOfficial",
    "mlaHandles": {
      "Chamaraja": "@MLAChamaraja",
      "Krishnaraja": "@MLAKrishnaraja"
    }
  },
  
  "issueCategories": {
    "civic": [
      "potholes",
      "drainage",
      "streetlights",
      "garbage",
      "water",
      "parks",
      "roads",
      "other"
    ],
    "traffic": [
      "signal",
      "jams",
      "noParking",
      "drivingWithMobile",
      "noHelmet"
    ]
  },
  
  "localization": {
    "defaultLanguage": "en",
    "availableLanguages": ["en", "kn"],
    "translations": {
      "en": {
        "homeTitle": "Nāgarika Dhvani",
        "homeSubtitle": "Mysore's fastest civic reporting platform"
      },
      "kn": {
        "homeTitle": "ನಾಗರಿಕ ಧ್ವನಿ",
        "homeSubtitle": "ಮೈಸೂರಿನ ವೇಗದ ನಾಗರಿಕ ವರದಿ ವೇದಿಕೆ"
      }
    }
  }
}
```

### 2. Add Boundary Data

Place your city's KML/GeoJSON files in:
- `assets/data/cities/{cityId}/map.kml` - Overall boundary
- `assets/data/cities/{cityId}/wards.kml` - Ward boundaries
- `assets/data/cities/{cityId}/constituencies.kml` - Political constituencies
- `assets/data/cities/{cityId}/traffic.kml` - Traffic jurisdiction

### 3. Select Active City

Update `config/active-city.json`:

```json
{
  "activeCity": "mysore"
}
```

## Configuration Fields

### Required Fields

- **cityId**: Unique identifier (lowercase, no spaces)
- **cityName**: Display name in English
- **boundaries.bbox**: Geographic bounding box (lat/lon)
- **boundaries.mapKml**: Path to boundary KML file
- **apis.civicApi**: API endpoint for civic issues
- **apis.trafficApi**: API endpoint for traffic issues

### Optional Fields

- **cityNameLocal**: City name in local language
- **socialMedia.mlaHandles**: Twitter handles for elected representatives
- **localization**: Multi-language support
- **issueCategories**: Custom issue types

## Building for Production

The build system will:
1. Read `active-city.json` to determine which city config to use
2. Bundle only the selected city's data
3. Generate city-specific HTML pages

## Multi-City Deployment

For multi-city deployments, you can:

### Option 1: Subdomain Approach
- `bangalore.reporter.github.io` → Uses bangalore.json
- `mysore.reporter.github.io` → Uses mysore.json

### Option 2: Path-Based Routing
- `reporter.github.io/bangalore/` → Uses bangalore.json
- `reporter.github.io/mysore/` → Uses mysore.json

### Option 3: Query Parameter
- `reporter.github.io?city=bangalore`
- `reporter.github.io?city=mysore`

## Environment Variables

For build-time configuration:

```bash
CITY_ID=mysore npm run build
```

## Testing

Test your city configuration:

```bash
npm run test:config -- --city=mysore
```

This will validate:
- All required fields are present
- Boundary files exist
- API endpoints are reachable
- Translations are complete
