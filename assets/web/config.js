// Configuration - Zen Citizen (Civic + Traffic)
export const CONFIG = {
    // Civic API
    API_GATEWAY_URL: "https://c543fafez6.execute-api.ap-south-1.amazonaws.com/zenc",

    // Traffic API (update this with your traffic API endpoint)
    TRAFFIC_API_URL: "https://c543fafez6.execute-api.ap-south-1.amazonaws.com/traffic",

    // Civic jurisdiction data
    MAP_KML_URL: "assets/data/map.kml",
    CONST_KML_URL: "assets/data/blr_const.kml",
    WARD_KML_URL: "assets/data/wards.kml",

    // Traffic jurisdiction data
    TRAFFIC_KML_URL: "assets/data/blr-traffic.kml",

    // Geographic boundary
    GBA_BBOX: {
        south: 12.82, north: 13.20,
        west: 77.40, east: 77.85
    }
};

export const MLA_HANDLES = {
    "Yeshwanthpur": "STSomashekarMLA",
    "Yelahanka": "SRVishwanathBJP",
    "Vijayanagara": "MLAHRGaviyappa",
    "Shivajinagar": "ArshadRizwan",
    "Shantinagar": "mlanaharis",
    "Sarvagnanagar": "thekjgeorge",
    "Rajarajeshwarinagar": "MunirathnaMLA",
    "Rajajinagar": "nimmasuresh",
    "Pulakeshinagar": "",
    "Padmanabhanagar": "RAshokaBJP",
    "Malleshwaram": "drashwathcn",
    "Mahalakshmi Layout": "GopalaiahK",
    "Mahadevapura": "MALimbavali",
    "Krishnarajapuram": "BABasavaraja",
    "Jayanagar": "CKRBJP",
    "Hoskote": "SBG4Hosakote",
    "Hebbal": "byrathi_suresh",
    "Govindaraja Nagar": "Priyakrishna_K",
    "Gandhinagar": "dineshgrao",
    "Dasarahalli": "munirajusbjp",
    "Chickpet": "BGUdayBJP",
    "Chamrajpet": "BZZameerAhmedK",
    "C. V. Raman Nagar": "SRaghuMLA",
    "Byatarayanapura": "krishnabgowda",
    "Bommanahalli": "msrbommanahalli",
    "Basavanagudi": "Ravi_LA",
    "Vijayanagar": "mkrishnappa_MLA",
    "BTM Layout": "RLR_BTM",
    "Anekal (SC)": "MLAShivanna"
};
