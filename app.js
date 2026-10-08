/**
 * AGRARWETTER IMST - APPLICATION LOGIC
 * Coordinates: Imst (Latitude: 47.2386, Longitude: 10.7422)
 */

// Global state
let weatherData = null;
let currentHourIdx = 0; // index into weatherData.hourly for the current hour
let tempChartInstance = null;
let precipWindChartInstance = null;

const CACHE_KEY = 'agrarwetter_cache';
const PAST_DAYS = 7;       // for the rain sum of the last week
const FORECAST_DAYS = 14;
const THEME_KEY = 'agrarwetter_theme';

// Theme preference cycle; "auto" follows the device setting
const THEMES = {
    auto: { icon: 'sun-moon', label: 'Automatisch (Gerät)' },
    light: { icon: 'sun', label: 'Hell' },
    dark: { icon: 'moon', label: 'Dunkel' },
    contrast: { icon: 'contrast', label: 'Hoher Kontrast (Sonnenlicht)' }
};
const THEME_ORDER = ['auto', 'light', 'dark', 'contrast'];
let themePreference = 'auto';

/**
 * Helper: Format a number for HTML templates. API/cache values are coerced so that
 * nothing but digits can end up in innerHTML; null/missing values become "–".
 */
function fmt(value, digits = 0) {
    const n = Number(value);
    return value === null || value === undefined || !Number.isFinite(n) ? '–' : n.toFixed(digits);
}

/**
 * Helper: Render Lucide icons if the CDN script loaded (app must keep working without it)
 */
function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}

// Presets for locations in District Imst
const LOCATIONS = {
    imst: { lat: 47.2386, lon: 10.7422, label: "Imst (828m)" },
    tarrenz: { lat: 47.2644, lon: 10.7617, label: "Tarrenz (836m)" },
    roppen: { lat: 47.2181, lon: 10.8242, label: "Roppen (724m)" },
    nassereith: { lat: 47.3150, lon: 10.8383, label: "Nassereith (838m)" },
    silz: { lat: 47.2647, lon: 10.9272, label: "Silz (654m)" },
    haiming: { lat: 47.2525, lon: 10.8856, label: "Haiming (670m)" },
    laengenfeld: { lat: 47.0708, lon: 10.9714, label: "Längenfeld (1179m)" },
    soelden: { lat: 46.9677, lon: 11.0078, label: "Sölden (1368m)" }
};

const FIELDS_KEY = 'agrarwetter_fields';
const FIELD_PREFIX = 'field:';

let currentLat = LOCATIONS.imst.lat;
let currentLon = LOCATIONS.imst.lon;
let currentElevation = null; // metres; null = Open-Meteo picks the terrain height
let currentLocationKey = 'imst';

/**
 * Helper: Find nearest predefined municipality to given coordinates
 */
function findNearestLocation(lat, lon) {
    let nearestKey = 'imst';
    let minDistance = Infinity;
    for (const [key, loc] of Object.entries(LOCATIONS)) {
        const dist = Math.sqrt(Math.pow(lat - loc.lat, 2) + Math.pow(lon - loc.lon, 2));
        if (dist < minDistance) {
            minDistance = dist;
            nearestKey = key;
        }
    }
    return nearestKey;
}

/**
 * Theme handling (pre-applied by the inline script in index.html to avoid a flash)
 */
function resolveTheme(pref) {
    if (pref !== 'auto') return pref;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(pref) {
    themePreference = THEMES[pref] ? pref : 'auto';
    document.documentElement.setAttribute('data-theme', resolveTheme(themePreference));

    const btn = document.getElementById('themeBtn');
    if (btn) {
        const theme = THEMES[themePreference];
        btn.innerHTML = `<i data-lucide="${theme.icon}"></i>`;
        btn.title = `Farbschema: ${theme.label}`;
        refreshIcons();
    }

    // Charts read their colors from CSS variables, so redraw them
    if (weatherData) renderCharts(weatherData.hourly, currentHourIdx);
}

function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themePreference) + 1) % THEME_ORDER.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
    applyTheme(next);
}

document.addEventListener('DOMContentLoaded', () => {
    // Theme: restore preference and follow device changes while on "auto"
    let savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* storage unavailable */ }
    applyTheme(savedTheme || 'auto');
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (themePreference === 'auto') applyTheme('auto');
    });

    // Initialize Lucide Icons
    refreshIcons();

    bindEvents();
    
    // Restore location from localStorage
    restoreLocation();
    
    // Set Windy Radar Source
    initRadar();
    
    // Fetch Weather Data
    fetchWeatherData();
    
    // Unregister any active service worker and clear caches to ensure fresh data
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for (const registration of registrations) {
                registration.unregister().then(() => {
                    console.log('Service Worker successfully unregistered');
                });
            }
        });
    }
    if ('caches' in window) {
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(key) {
                return caches.delete(key);
            }));
        }).then(() => {
            console.log('All caches cleared');
        });
    }
});

/**
 * Wire up all UI events (no inline handlers, so a strict CSP can forbid inline script)
 */
function bindEvents() {
    document.getElementById('locationSelect').addEventListener('change', handleLocationChange);
    document.getElementById('gpsBtn').addEventListener('click', requestGPSLocation);
    document.getElementById('saveFieldBtn').addEventListener('click', openFieldDialog);
    document.getElementById('deleteFieldBtn').addEventListener('click', deleteCurrentField);
    document.getElementById('themeBtn').addEventListener('click', cycleTheme);
    document.getElementById('fieldForm').addEventListener('submit', handleFieldSubmit);
    document.getElementById('fieldCancelBtn').addEventListener('click', () => document.getElementById('fieldDialog').close());
    document.getElementById('forecastMoreBtn').addEventListener('click', toggleForecastMore);
    
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Forecast rows are re-rendered on every load, so delegate from the list
    const forecastList = document.getElementById('forecastList');
    const toggleFromEvent = (event) => {
        const summary = event.target.closest('.forecast-day-summary');
        if (summary) toggleForecastAccordion(Number(summary.dataset.day));
    };
    forecastList.addEventListener('click', toggleFromEvent);
    forecastList.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleFromEvent(event);
        }
    });
}

/**
 * Tab Switching Functionality
 */
function switchTab(tabName) {
    // Reset all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Reset all tab contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-content'));
    
    // Activate target
    if (tabName === 'dashboard') {
        document.getElementById('tabBtnDashboard').classList.add('active');
        document.getElementById('tabContentDashboard').classList.add('active-content');
    } else if (tabName === 'radar') {
        document.getElementById('tabBtnRadar').classList.add('active');
        document.getElementById('tabContentRadar').classList.add('active-content');
        initRadar();
    } else if (tabName === 'agro') {
        document.getElementById('tabBtnAgro').classList.add('active');
        document.getElementById('tabContentAgro').classList.add('active-content');
    } else if (tabName === 'links') {
        document.getElementById('tabBtnLinks').classList.add('active');
        document.getElementById('tabContentLinks').classList.add('active-content');
    }
}

let radarLoadedLat = null;
let radarLoadedLon = null;

/**
 * Initialize Windy Radar iframe URL dynamically (lazy-loaded when tab is active)
 */
function initRadar(force = false) {
    const radarIframe = document.getElementById('windyRadarIframe');
    if (radarIframe) {
        const isRadarTabActive = document.getElementById('tabContentRadar').classList.contains('active-content');
        if (isRadarTabActive || force) {
            if (radarLoadedLat !== currentLat || radarLoadedLon !== currentLon) {
                radarIframe.src = `https://embed.windy.com/embed2.html?lat=${currentLat}&lon=${currentLon}&zoom=9&level=surface&overlay=radar&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`;
                radarLoadedLat = currentLat;
                radarLoadedLon = currentLon;
            }
        }
    }
}

/**
 * Fetch Weather Data from Open-Meteo
 */
async function fetchWeatherData() {
    const params = new URLSearchParams({
        latitude: currentLat,
        longitude: currentLon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m',
        hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,et0_fao_evapotranspiration,wind_speed_10m,wind_gusts_10m,shortwave_radiation,soil_temperature_0cm,soil_temperature_6cm,soil_moisture_3_to_9cm',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration',
        timezone: 'Europe/Berlin',
        past_days: PAST_DAYS,
        forecast_days: FORECAST_DAYS
    });
    // Exact field elevation improves temperature/frost downscaling in alpine terrain
    if (currentElevation !== null) params.set('elevation', currentElevation);
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    
    // Show loading state in UI
    const updateTimeEl = document.getElementById('updateTime');
    if (updateTimeEl) {
        updateTimeEl.innerHTML = '<i data-lucide="loader-2" class="spin inline-spinner"></i> Wetterdaten werden geladen...';
        refreshIcons();
    }
    
    const appContent = document.querySelector('.app-content');
    if (appContent) {
        appContent.classList.add('loading-fade');
    }
    
    let data;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        data = await response.json();
    } catch (error) {
        console.error("Fehler beim Abrufen der Wetterdaten:", error);
        showCachedOrError();
        return;
    } finally {
        if (appContent) {
            appContent.classList.remove('loading-fade');
        }
    }
    
    saveCache(data);
    renderWeather(data);
    
    const now = new Date();
    document.getElementById('updateTime').textContent = `Stand: Heute, ${now.toLocaleTimeString('de-AT', {hour: '2-digit', minute:'2-digit'})} Uhr`;
}

/**
 * Render a full Open-Meteo response. Past days are dropped first so that
 * day 0 is always today, also for older cached data.
 * Returns false if the data no longer covers the current hour.
 */
function renderWeather(data) {
    const nowIdx = getCurrentHourIndex(data);
    const pastDays = Math.floor(nowIdx / 24);
    if (pastDays >= data.daily.time.length) return false;
    
    // Rain of the last 7 days (requested via past_days) before past days are dropped
    const pastRainDays = data.daily.precipitation_sum.slice(Math.max(0, pastDays - PAST_DAYS), pastDays);
    const pastRain = { sum: pastRainDays.reduce((a, b) => a + (b || 0), 0), days: pastRainDays.length };
    
    if (pastDays > 0) dropPastDays(data, pastDays);
    
    weatherData = data;
    currentHourIdx = nowIdx - pastDays * 24;
    
    updateCurrentWeather(data.current);
    
    const indices = calculateAllIndices(data.daily, data.hourly, currentHourIdx);
    updateIndicesUI(indices);
    
    updateForecastUI(data.daily, data.hourly, currentHourIdx);
    
    updateFarmPlanner(data.daily, data.hourly, currentHourIdx);
    
    updateSoilHealthUI(data.hourly, currentHourIdx, pastRain);
    
    renderCharts(data.hourly, currentHourIdx);
    
    // Re-initialize all Lucide icons once after all DOM updates
    refreshIcons();
    return true;
}

/**
 * Index of the current hour in hourly.time. The hourly arrays always start at
 * 00:00 of the first forecast day, so index 0 is NOT "now".
 * Uses the API's UTC offset so it works regardless of the device time zone.
 */
function getCurrentHourIndex(data) {
    const offsetSec = data.utc_offset_seconds ?? -new Date().getTimezoneOffset() * 60;
    const local = new Date(Date.now() + offsetSec * 1000);
    const pad = n => String(n).padStart(2, '0');
    const nowStr = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:00`;
    
    const times = data.hourly.time;
    // Data ends before today: point past the end so the caller can reject it
    if (nowStr.slice(0, 10) > times[times.length - 1].slice(0, 10)) return times.length;

    let idx = 0;
    // ISO strings in the same zone compare correctly as plain strings
    while (idx + 1 < times.length && times[idx + 1] <= nowStr) idx++;
    return idx;
}

/**
 * Remove the first n days from daily and n*24 hours from hourly (in place)
 */
function dropPastDays(data, n) {
    for (const key of Object.keys(data.daily)) {
        if (Array.isArray(data.daily[key])) data.daily[key] = data.daily[key].slice(n);
    }
    for (const key of Object.keys(data.hourly)) {
        if (Array.isArray(data.hourly[key])) data.hourly[key] = data.hourly[key].slice(n * 24);
    }
}

/**
 * Offline cache: keep the last successful response in localStorage
 */
function saveCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), lat: currentLat, lon: currentLon, elevation: currentElevation, data }));
    } catch (e) {
        console.warn("Wetterdaten konnten nicht offline gespeichert werden:", e);
    }
}

function loadCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && cached.lat === currentLat && cached.lon === currentLon
            && (cached.elevation ?? null) === currentElevation && cached.data) return cached;
    } catch (e) { /* storage unavailable or corrupt */ }
    return null;
}

/**
 * Network failed: fall back to cached data for this location, else show an error
 */
function showCachedOrError() {
    const cached = loadCache();
    let rendered = false;
    try {
        rendered = cached !== null && renderWeather(cached.data);
    } catch (e) {
        console.error("Gespeicherte Wetterdaten sind unlesbar:", e);
    }
    if (rendered) {
        const saved = new Date(cached.savedAt);
        const isToday = saved.toDateString() === new Date().toDateString();
        const dayStr = isToday ? 'Heute' : saved.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const timeStr = saved.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('updateTime').textContent = `Offline – Stand: ${dayStr}, ${timeStr} Uhr`;
        setStatusAlert("Keine Verbindung – gespeicherte Daten werden angezeigt.", 'offline');
        return;
    }
    
    document.getElementById('updateTime').textContent = "Fehler beim Laden der Live-Daten.";
    setStatusAlert("Verbindungsfehler. Bitte Internetverbindung prüfen.", 'danger');
}

/**
 * Show/hide the alert pill in the status bar. variant: 'danger' | 'offline' | null (hide)
 */
function setStatusAlert(text, variant) {
    const alertPill = document.getElementById('activeAlert');
    alertPill.classList.toggle('hide', !variant);
    alertPill.classList.toggle('offline', variant === 'offline');
    if (text) document.getElementById('alertText').textContent = text;
}

/**
 * Translate Open-Meteo weather codes to German text
 */
function getWeatherDesc(code) {
    const codes = {
        0: "Klarer Himmel",
        1: "Fast wolkenlos",
        2: "Teilweise bewölkt",
        3: "Bedeckt",
        45: "Nebel",
        48: "Raureifnebel",
        51: "Leichter Nieselregen",
        53: "Mäßiger Nieselregen",
        55: "Dichter Nieselregen",
        56: "Leichter gefrierender Nieselregen",
        57: "Dichter gefrierender Nieselregen",
        61: "Leichter Regen",
        63: "Mäßiger Regen",
        65: "Starker Regen",
        66: "Leichter gefrierender Regen",
        67: "Starker gefrierender Regen",
        71: "Leichter Schneefall",
        73: "Mäßiger Schneefall",
        75: "Starker Schneefall",
        77: "Schneegriesel",
        80: "Leichte Regenschauer",
        81: "Mäßige Regenschauer",
        82: "Starke Regenschauer",
        85: "Leichte Schneeschauer",
        86: "Starke Schneeschauer",
        95: "Gewitter",
        96: "Gewitter mit leichtem Hagel",
        99: "Gewitter mit schwerem Hagel"
    };
    return codes[code] || "Unbekannt";
}

/**
 * Get matching Lucide Icon name for a weather code
 */
function getWeatherIconName(code) {
    if (code === 0) return 'sun';
    if (code === 1 || code === 2) return 'cloud-sun';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'cloud-fog';
    if ([51, 53, 55, 56, 57, 80, 81, 82].includes(code)) return 'cloud-drizzle';
    if ([61, 63, 65, 66, 67].includes(code)) return 'cloud-rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowflake';
    if ([95, 96, 99].includes(code)) return 'cloud-lightning';
    return 'cloud';
}

/**
 * Update the Current Weather Card
 */
function updateCurrentWeather(current) {
    document.getElementById('currentTemp').textContent = `${fmt(current.temperature_2m)}°C`;
    document.getElementById('feelsLike').textContent = `Gefühlt: ${fmt(current.apparent_temperature)}°C`;
    document.getElementById('currentHumidity').textContent = `${fmt(current.relative_humidity_2m)}%`;
    document.getElementById('currentWind').textContent = `${fmt(current.wind_speed_10m)} (${fmt(current.wind_gusts_10m)}) km/h`;
    document.getElementById('currentPrecipitation').textContent = `${fmt(current.precipitation, 1)} mm`;
    document.getElementById('currentPressure').textContent = `${fmt(current.surface_pressure)} hPa`;
    
    // Weather Desc & Icon
    const desc = getWeatherDesc(current.weather_code);
    document.getElementById('currentWeatherDesc').textContent = desc;
    
    const iconName = getWeatherIconName(current.weather_code);
    const iconContainer = document.getElementById('currentWeatherIcon');
    iconContainer.innerHTML = `<i data-lucide="${iconName}"></i>`;
    
    // Check for alerts
    if (current.wind_gusts_10m > 50) {
        setStatusAlert(`Starkwindböen (${Math.round(current.wind_gusts_10m)} km/h)!`, 'danger');
    } else if (current.precipitation > 5) {
        setStatusAlert("Starker Niederschlag aktuell!", 'danger');
    } else {
        setStatusAlert(null, null);
    }
}

/**
 * Calculate All Agricultural Indices
 */
function calculateAllIndices(daily, hourly, nowIdx) {
    // 1. Calculate Heuwetter-Index for today (Day 0)
    const heuIndex = calculateHeuIndex(0, daily);
    
    // 2. Calculate Spritzwetter-Index for current window (next 12 hours from now)
    const spritzIndex = calculateSpritzIndex(hourly, nowIdx);
    
    // 3. Calculate Gülle-Wetter-Index for today (Day 0)
    const guelleIndex = calculateGuelleIndex(0, daily);
    
    return {
        heu: heuIndex,
        spritz: spritzIndex,
        guelle: guelleIndex
    };
}

/**
 * Heuwetter rain score for a single day (0 = rain halts hay drying)
 */
function heuRainScore(idx, daily) {
    const p = daily.precipitation_sum[idx];
    const prob = daily.precipitation_probability_max[idx];
    
    let rDay = 100;
    if (p >= 1.0) {
        // Rain of 1mm or more completely halts hay drying
        rDay = 0;
    } else if (p > 0) {
        rDay -= p * 80; // heavy penalty for light rain
    }
    
    if (prob >= 35) {
        rDay = 0; // High probability of rain prevents mowing safely
    } else if (prob > 15) {
        rDay -= (prob - 15) * 4;
    }
    return Math.max(0, rDay);
}

/**
 * Size of the Heuwetter window starting at startDateIndex (3 days, shorter at the forecast end)
 */
function heuWindowSize(startDateIndex, daily) {
    return Math.min(3, daily.precipitation_sum.length - startDateIndex);
}

/**
 * First day in the Heuwetter window whose rain score is 0, or -1
 */
function findHeuRainDay(startDateIndex, daily) {
    const windowSize = heuWindowSize(startDateIndex, daily);
    for (let k = 0; k < windowSize; k++) {
        if (heuRainScore(startDateIndex + k, daily) === 0) return startDateIndex + k;
    }
    return -1;
}

/**
 * Heuwetter-Index Algorithm (rolling window)
 * Evaluates drying conditions over 3 consecutive days starting on startDateIndex
 */
function calculateHeuIndex(startDateIndex, daily) {
    // Window shrinks to 2 or 1 days close to the forecast limit
    const windowSize = heuWindowSize(startDateIndex, daily);
    if (windowSize <= 0) return 0;
    
    let rainScoreTotal = 100;
    let etSum = 0;
    let sunSum = 0;
    let tempSum = 0;
    let windSum = 0;
    
    for (let k = 0; k < windowSize; k++) {
        const idx = startDateIndex + k;
        
        const et = daily.et0_fao_evapotranspiration[idx] || 0.0;
        const sun = (daily.sunshine_duration[idx] || 0) / 3600;
        const tMax = daily.temperature_2m_max[idx];
        const wMax = daily.wind_speed_10m_max[idx];
        
        // 1. Rain Penalty per day
        const rDay = heuRainScore(idx, daily);
        
        // RainScore is limited by the worst day in the window
        rainScoreTotal = Math.min(rainScoreTotal, rDay);
        
        // Accumulate drying drivers
        etSum += et;
        sunSum += sun;
        tempSum += tMax;
        
        // Wind score contribution (moderate breeze is good)
        let wScore = 50;
        if (wMax >= 8 && wMax <= 25) {
            wScore = 100;
        } else if (wMax < 8) {
            wScore = 50 + (wMax / 8) * 30; // low wind
        } else {
            wScore = 100 - ((wMax - 25) * 2); // very strong wind gusts
        }
        windSum += Math.max(20, wScore);
    }
    
    // Scale criteria based on window size
    const expectedEt = windowSize * 4.0; // 12mm for 3 days
    const expectedSun = windowSize * 8.0; // 24h for 3 days
    
    // Evapotranspiration score
    let etScore = (etSum / expectedEt) * 100;
    etScore = Math.min(100, Math.max(0, etScore));
    
    // Sunshine score
    let sunScore = (sunSum / expectedSun) * 100;
    sunScore = Math.min(100, Math.max(0, sunScore));
    
    // Temperature score
    const tAvg = tempSum / windowSize;
    let tempScore = 20;
    if (tAvg >= 24) tempScore = 100;
    else if (tAvg > 14) tempScore = 20 + ((tAvg - 14) / 10) * 80;
    
    // Wind score
    const windScore = windSum / windowSize;
    
    // Combined drying capacity score
    const dryingCapacity = 0.5 * etScore + 0.3 * sunScore + 0.1 * tempScore + 0.1 * windScore;
    
    // Calculate final index
    if (rainScoreTotal === 0) {
        return 0; // If it rains on any day, haymaking suitability is 0%
    }
    
    const finalIndex = 0.5 * rainScoreTotal + 0.5 * dryingCapacity;
    return Math.round(finalIndex);
}

/**
 * Spritzwetter-Index Algorithm (Pflanzenschutz)
 * Evaluates current day working hours (next 12 hourly forecast hours)
 */
function calculateSpritzIndex(hourly, nowIdx) {
    let scoresSum = 0;
    let count = 0;
    
    // Look at next 12 hours from now
    const limit = Math.min(nowIdx + 12, hourly.temperature_2m.length);
    
    for (let h = nowIdx; h < limit; h++) {
        scoresSum += sprayHourScore(hourly, h);
        count++;
    }
    
    return count > 0 ? Math.round(scoresSum / count) : 0;
}

/**
 * Spray suitability (0-100) of a single hour
 */
function sprayHourScore(hourly, h) {
    const temp = hourly.temperature_2m[h];
    const wind = hourly.wind_speed_10m[h];
    const gust = hourly.wind_gusts_10m[h];
    
    // Rain checks (current and next 3 hours)
    for (let nextH = h; nextH < Math.min(h + 4, hourly.precipitation.length); nextH++) {
        if (hourly.precipitation[nextH] > 0.1) {
            return 0; // Rain washes spray away
        }
    }
    
    // Wind drift assessment (Ideal: < 10 km/h, max gusts < 18 km/h)
    let windScore = 100;
    if (wind > 15 || gust > 25) {
        windScore = 0; // Too much drift
    } else if (wind > 8) {
        windScore = 100 - ((wind - 8) / 7) * 70; // moderate drift
    }
    
    // Temperature check (Ideal: 10 - 20°C)
    let tempScore = 100;
    if (temp < 6 || temp > 25) {
        tempScore = 0; // Too cold (ineffective) or too hot (volatilization/crop stress)
    } else if (temp < 10) {
        tempScore = 100 - ((10 - temp) / 4) * 50;
    } else if (temp > 20) {
        tempScore = 100 - ((temp - 20) / 5) * 60;
    }
    
    return Math.max(0, windScore * tempScore / 100);
}

/**
 * Gülle-Wetter-Index Algorithm
 * Evaluates day-level suitability for spreading liquid manure (requires cloudiness/light rain)
 */
function calculateGuelleIndex(dayIndex, daily) {
    const p = daily.precipitation_sum[dayIndex];
    const tMax = daily.temperature_2m_max[dayIndex];
    const wMax = daily.wind_speed_10m_max[dayIndex];
    const sunHours = (daily.sunshine_duration[dayIndex] || 0) / 3600;
    
    let rainScore = 0;
    
    // Light rain is perfect (washes nutrients into the ground)
    if (p > 0.5 && p <= 5.0) {
        rainScore = 100;
    } else if (p > 5.0 && p <= 10.0) {
        rainScore = 60; // rain is a bit heavy, risk of light runoff
    } else if (p > 10.0) {
        rainScore = 0; // high runoff risk into water bodies (forbidden/harmful)
    } else {
        // No rain: check cloud cover/sunshine
        if (sunHours < 3) {
            rainScore = 70; // cloudy day, low volatilization
        } else if (sunHours < 6) {
            rainScore = 40; // partly cloudy
        } else {
            rainScore = 15; // sunny day (high ammonia evaporation losses, bad)
        }
    }
    
    // Temperature penalty (lower temp = less nitrogen evaporation)
    let tempScore = 100;
    if (tMax > 22) {
        tempScore = 20;
    } else if (tMax > 15) {
        tempScore = 100 - ((tMax - 15) / 7) * 80;
    }
    
    // Wind drift (nitrogen carrying away)
    let windScore = 100;
    if (wMax > 20) {
        windScore = 30;
    } else if (wMax > 10) {
        windScore = 100 - ((wMax - 10) / 10) * 70;
    }
    
    const finalIndex = 0.5 * rainScore + 0.3 * tempScore + 0.2 * windScore;
    return Math.round(finalIndex);
}

/**
 * Update UI for Agricultural Indices (Today)
 */
function updateIndicesUI(indices) {
    // 1. Heuwetter
    document.getElementById('heuIndexVal').textContent = `${indices.heu}%`;
    document.getElementById('heuProgressBar').style.width = `${indices.heu}%`;
    
    const heuBadge = document.getElementById('heuStatusBadge');
    heuBadge.className = 'status-pill'; // Reset classes
    if (indices.heu >= 80) {
        heuBadge.textContent = 'Ausgezeichnet';
        heuBadge.classList.add('success');
    } else if (indices.heu >= 50) {
        heuBadge.textContent = 'Gut geeignet';
        heuBadge.classList.add('info');
    } else if (indices.heu >= 25) {
        heuBadge.textContent = 'Riskant/Mäßig';
        heuBadge.classList.add('warning');
    } else {
        heuBadge.textContent = 'Ungeeignet';
        heuBadge.classList.add('danger');
    }
    
    // 2. Spritzwetter
    document.getElementById('spritzIndexVal').textContent = `${indices.spritz}%`;
    document.getElementById('spritzProgressBar').style.width = `${indices.spritz}%`;
    
    const spritzBadge = document.getElementById('spritzStatusBadge');
    spritzBadge.className = 'status-pill';
    if (indices.spritz >= 75) {
        spritzBadge.textContent = 'Ideal';
        spritzBadge.classList.add('success');
    } else if (indices.spritz >= 45) {
        spritzBadge.textContent = 'Eingeschränkt';
        spritzBadge.classList.add('warning');
    } else {
        spritzBadge.textContent = 'Ungeeignet';
        spritzBadge.classList.add('danger');
    }
    
    // 3. Gülle-Wetter
    document.getElementById('guelleIndexVal').textContent = `${indices.guelle}%`;
    document.getElementById('guelleProgressBar').style.width = `${indices.guelle}%`;
    
    const guelleBadge = document.getElementById('guelleStatusBadge');
    guelleBadge.className = 'status-pill';
    if (indices.guelle >= 70) {
        guelleBadge.textContent = 'Sehr gut';
        guelleBadge.classList.add('success');
    } else if (indices.guelle >= 40) {
        guelleBadge.textContent = 'Mäßig';
        guelleBadge.classList.add('warning');
    } else {
        guelleBadge.textContent = 'Schlecht';
        guelleBadge.classList.add('danger');
    }
}

/**
 * Render the 7-day Forecast List with Expandable Accordions
 */
function updateForecastUI(daily, hourly, nowIdx) {
    const listContainer = document.getElementById('forecastList');
    listContainer.innerHTML = ''; // Clear loading spinner
    
    const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(`${dateStr}T00:00`); // local midnight, not UTC
        
        let weekday = daysOfWeek[dateObj.getDay()];
        if (i === 0) weekday = "Heute";
        else if (i === 1) weekday = "Morgen";
        
        const formattedDate = dateObj.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
        
        const code = daily.weather_code[i];
        const iconName = getWeatherIconName(code);
        const desc = getWeatherDesc(code);
        
        const tempMax = fmt(daily.temperature_2m_max[i]);
        const tempMin = fmt(daily.temperature_2m_min[i]);
        
        const rainSum = daily.precipitation_sum[i];
        const rainProb = daily.precipitation_probability_max[i];
        
        // Calculate Heuwetter Index for this specific day
        const heuIdx = calculateHeuIndex(i, daily);
        
        // Determine Heuwetter badge
        let heuBadgeClass = 'stop';
        let heuBadgeText;
        if (heuIdx >= 70) {
            heuBadgeClass = 'go';
            heuBadgeText = `Heuen: Sehr gut (${heuIdx}%)`;
        } else if (heuIdx >= 40) {
            heuBadgeClass = 'caution';
            heuBadgeText = `Heuen: Mäßig (${heuIdx}%)`;
        } else if (heuIdx > 0) {
            heuBadgeText = `Heuen: Riskant (${heuIdx}%)`;
        } else {
            // Explain a "Nein" on a dry day: rain later within the 3-day drying window
            const rainDay = findHeuRainDay(i, daily);
            if (rainDay > i) {
                const rainWeekday = new Date(`${daily.time[rainDay]}T00:00`).toLocaleDateString('de-AT', { weekday: 'short' });
                heuBadgeText = `Heuen: Nein (Regen ${rainWeekday})`;
            } else {
                heuBadgeText = 'Heuen: Nein (Regen)';
            }
        }
        
        // Simulate Hay-Drying Clock (ET0 and Rain hours)
        const dryingInfo = simulateHayDrying(i, daily, hourly, nowIdx);
        
        // Generate Hourly Table Content for this day
        const hourlyRowsHtml = generateHourlyRowsForDay(i, dateStr, hourly);
        
        // Create the row element
        const row = document.createElement('div');
        row.className = i < 7 ? 'forecast-day-row' : 'forecast-day-row extra-day';
        row.id = `forecastRow-${i}`;
        
        row.innerHTML = `
            <div class="forecast-day-summary" data-day="${i}" role="button" tabindex="0" aria-expanded="false">
                <div class="day-name-date">
                    <span class="day-name">${weekday}</span>
                    <span class="day-date">${formattedDate}</span>
                </div>
                <div class="day-icon-desc">
                    <span class="day-icon"><i data-lucide="${iconName}"></i></span>
                    <span class="day-desc">${desc}</span>
                </div>
                <div class="day-temps">
                    <span class="temp-max">${tempMax}°</span>
                    <span class="temp-min">${tempMin}°</span>
                </div>
                <div class="day-rain">
                    <i data-lucide="cloud-rain"></i>
                    <span>${fmt(rainSum, 1)} mm (${fmt(rainProb)}%)</span>
                </div>
                <div class="day-heu-badge-container">
                    <span class="heu-badge ${heuBadgeClass}">${heuBadgeText}</span>
                </div>
                <div class="row-toggle-icon">
                    <i data-lucide="chevron-down"></i>
                </div>
            </div>
            
            <div class="day-hourly-details">
                <div class="drying-clock-container ${dryingInfo.class}">
                    <i data-lucide="${dryingInfo.icon}"></i>
                    <div class="drying-clock-text">
                        <span class="drying-clock-title">Heu-Trocknungsuhr:</span>
                        <span class="drying-clock-time">${dryingInfo.text}</span>
                    </div>
                </div>
                <div class="hourly-table-wrapper">
                    <table class="hourly-table">
                        <thead>
                            <tr>
                                <th>Uhrzeit</th>
                                <th>Temp (°C)</th>
                                <th>Regen (mm)</th>
                                <th>Regen-%</th>
                                <th>Rel. Feuchte</th>
                                <th>Wind (Böen)</th>
                                <th>Verdunstung ET₀</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${hourlyRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        listContainer.appendChild(row);
    }
    
    document.getElementById('forecastMoreBtn').classList.toggle('hide', daily.time.length <= 7);
}

/**
 * Show/hide forecast days 8-14
 */
function toggleForecastMore() {
    const list = document.getElementById('forecastList');
    const showAll = list.classList.toggle('show-all');
    document.getElementById('forecastMoreText').textContent = showAll ? 'Weniger Tage anzeigen' : 'Weitere 7 Tage anzeigen';
}

/**
 * Generate hourly rows for the accordion details
 */
function generateHourlyRowsForDay(dayIndex, dateStr, hourly) {
    let rowsHtml = '';
    
    // Each day has 24 hours in the hourly array, starting at dayIndex * 24
    const startIdx = dayIndex * 24;
    const endIdx = Math.min(startIdx + 24, hourly.time.length);
    
    for (let h = startIdx; h < endIdx; h++) {
        const timeObj = new Date(hourly.time[h]);
        const hourInt = timeObj.getHours();
        
        // Only show key farming hours: 06:00, 09:00, 12:00, 15:00, 18:00, 21:00
        if (hourInt === 6 || hourInt === 9 || hourInt === 12 || hourInt === 15 || hourInt === 18 || hourInt === 21) {
            const hourFormatted = timeObj.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
            
            const temp = fmt(hourly.temperature_2m[h], 1);
            const rain = fmt(hourly.precipitation[h], 1);
            const prob = fmt(hourly.precipitation_probability[h]);
            const rh = fmt(hourly.relative_humidity_2m[h]);
            const wind = fmt(hourly.wind_speed_10m[h]);
            const gust = fmt(hourly.wind_gusts_10m[h]);
            const et = fmt(hourly.et0_fao_evapotranspiration[h] || 0, 2);
            
            rowsHtml += `
                <tr>
                    <td class="hourly-time">${hourFormatted} Uhr</td>
                    <td class="hourly-temp">${temp}°C</td>
                    <td class="hourly-rain">${rain} mm</td>
                    <td>${prob}%</td>
                    <td class="hourly-humidity">${rh}%</td>
                    <td class="hourly-wind">${wind} (${gust}) km/h</td>
                    <td class="hourly-et">${et} mm</td>
                </tr>
            `;
        }
    }
    return rowsHtml;
}

/**
 * Expand/Collapse Accordion Rows
 */
function toggleForecastAccordion(dayIndex) {
    const row = document.getElementById(`forecastRow-${dayIndex}`);
    const detailPanel = row.querySelector('.day-hourly-details');
    
    if (row.classList.contains('expanded')) {
        // Collapse
        row.classList.remove('expanded');
        row.querySelector('.forecast-day-summary').setAttribute('aria-expanded', 'false');
        detailPanel.style.maxHeight = '0';
    } else {
        // Collapse all others first for clean view
        document.querySelectorAll('.forecast-day-row').forEach(otherRow => {
            otherRow.classList.remove('expanded');
            otherRow.querySelector('.forecast-day-summary').setAttribute('aria-expanded', 'false');
            const otherDetail = otherRow.querySelector('.day-hourly-details');
            if (otherDetail) otherDetail.style.maxHeight = '0';
        });
        
        // Expand this one
        row.classList.add('expanded');
        row.querySelector('.forecast-day-summary').setAttribute('aria-expanded', 'true');
        // Animate to the real content height (fixed values clip the table on phones)
        detailPanel.style.maxHeight = `${detailPanel.scrollHeight}px`;
    }
}

/**
 * Render Trend Charts (Chart.js)
 */
function renderCharts(hourly, nowIdx) {
    // Chart.js comes from a CDN; keep the rest of the app working without it
    if (typeof Chart === 'undefined') {
        document.querySelectorAll('.chart-container').forEach(container => {
            container.innerHTML = '<p class="chart-fallback">Diagramme konnten nicht geladen werden.</p>';
        });
        return;
    }
    
    // Extract next 48 hours from now for high-res trend charts
    const end = Math.min(nowIdx + 48, hourly.time.length);
    const labels = [];
    const temps = [];
    const dewPoints = [];
    const precips = [];
    const windSpeeds = [];
    const windGusts = [];
    
    const daysOfWeekShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    
    for (let h = nowIdx; h < end; h++) {
        const timeObj = new Date(hourly.time[h]);
        const weekday = daysOfWeekShort[timeObj.getDay()];
        const hour = timeObj.getHours();
        
        // Label format: "Mo 14:00"
        labels.push(`${weekday} ${hour}:00`);
        temps.push(hourly.temperature_2m[h]);
        dewPoints.push(hourly.dew_point_2m[h]);
        precips.push(hourly.precipitation[h]);
        windSpeeds.push(hourly.wind_speed_10m[h]);
        windGusts.push(hourly.wind_gusts_10m[h]);
    }
    
    // Destroy previous chart instances if they exist
    if (tempChartInstance) tempChartInstance.destroy();
    if (precipWindChartInstance) precipWindChartInstance.destroy();
    
    // Chart.js styling from the active theme's CSS variables
    const css = getComputedStyle(document.documentElement);
    const cssVar = name => css.getPropertyValue(name).trim();
    Chart.defaults.color = cssVar('--chart-text');
    Chart.defaults.borderColor = cssVar('--chart-grid');
    Chart.defaults.font.family = 'Inter';
    const tooltipBg = cssVar('--chart-tooltip-bg');
    
    // 1. Temperature & Dew Point Chart
    const ctxTemp = document.getElementById('tempChart').getContext('2d');
    tempChartInstance = new Chart(ctxTemp, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatur (°C)',
                    data: temps,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 1,
                    pointHoverRadius: 5,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Taupunkt (°C)',
                    data: dewPoints,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 1,
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12, usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: tooltipBg,
                    titleColor: '#ffffff',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 8 }
                },
                y: {
                    title: { display: true, text: 'Temperatur (°C)' }
                }
            }
        }
    });
    
    // 2. Precipitation & Wind Chart
    const ctxPrecipWind = document.getElementById('precipWindChart').getContext('2d');
    precipWindChartInstance = new Chart(ctxPrecipWind, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Niederschlag (mm)',
                    data: precips,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'yPrecip',
                    barThickness: 'flex'
                },
                {
                    type: 'line',
                    label: 'Windböen (km/h)',
                    data: windGusts,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'yWind',
                    fill: false,
                    tension: 0.3
                },
                {
                    type: 'line',
                    label: 'Windgeschw. (km/h)',
                    data: windSpeeds,
                    borderColor: '#94a3b8',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    yAxisID: 'yWind',
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12, usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: tooltipBg,
                    titleColor: '#ffffff',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 8 }
                },
                yPrecip: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Niederschlag (mm)' },
                    min: 0,
                    suggestedMax: 2,
                    grid: { drawOnChartArea: true }
                },
                yWind: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Wind (km/h)' },
                    min: 0,
                    suggestedMax: 30,
                    grid: { drawOnChartArea: false } // Avoid double grid lines
                }
            }
        }
    });
}

/**
 * Saved fields ("Meine Felder"): [{ id, name, lat, lon, elevation }] in localStorage.
 * Stored data is validated on read since localStorage can contain anything.
 */
function loadFields() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(FIELDS_KEY)); } catch (e) { return []; }
    if (!Array.isArray(raw)) return [];
    return raw.filter(f => f && typeof f.id === 'string' && typeof f.name === 'string'
        && Number.isFinite(f.lat) && Math.abs(f.lat) <= 90
        && Number.isFinite(f.lon) && Math.abs(f.lon) <= 180
        && (f.elevation === null || Number.isFinite(f.elevation)));
}

function saveFields(fields) {
    try {
        localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
    } catch (e) {
        alert("Feld konnte nicht gespeichert werden (Speicher nicht verfügbar).");
    }
}

function findField(key) {
    if (!key || !key.startsWith(FIELD_PREFIX)) return null;
    const id = key.slice(FIELD_PREFIX.length);
    return loadFields().find(f => f.id === id) || null;
}

/**
 * Rebuild the dynamic parts of the location dropdown (saved fields, GPS entry)
 */
function renderLocationOptions() {
    const select = document.getElementById('locationSelect');
    
    let group = document.getElementById('fieldsGroup');
    if (!group) {
        group = document.createElement('optgroup');
        group.id = 'fieldsGroup';
        group.label = 'Meine Felder';
        select.appendChild(group);
    }
    group.replaceChildren();
    for (const field of loadFields()) {
        const opt = document.createElement('option');
        opt.value = FIELD_PREFIX + field.id;
        opt.textContent = field.elevation !== null ? `${field.name} (${Math.round(field.elevation)}m)` : field.name;
        group.appendChild(opt);
    }
    group.hidden = group.children.length === 0;
    
    let gpsOpt = select.querySelector('option[value="gps"]');
    if (currentLocationKey === 'gps') {
        if (!gpsOpt) {
            gpsOpt = document.createElement('option');
            gpsOpt.value = 'gps';
            select.insertBefore(gpsOpt, group);
        }
        const nearestName = LOCATIONS[findNearestLocation(currentLat, currentLon)].label.split(' (')[0];
        gpsOpt.textContent = `GPS (nahe ${nearestName})`;
    }
    
    select.value = currentLocationKey;
    document.getElementById('deleteFieldBtn').classList.toggle('hide', !currentLocationKey.startsWith(FIELD_PREFIX));
}

/**
 * Switch to a location, persist it and reload the weather
 */
function setLocation(key, lat, lon, elevation = null, { reload = true } = {}) {
    currentLocationKey = key;
    currentLat = lat;
    currentLon = lon;
    currentElevation = elevation;
    
    try {
        localStorage.setItem('agrarwetter_loc', key);
        if (key === 'gps') {
            localStorage.setItem('agrarwetter_lat', lat);
            localStorage.setItem('agrarwetter_lon', lon);
        } else {
            localStorage.removeItem('agrarwetter_lat');
            localStorage.removeItem('agrarwetter_lon');
        }
    } catch (e) { /* storage unavailable */ }
    
    renderLocationOptions();
    if (reload) {
        initRadar();
        fetchWeatherData();
    }
}

/**
 * Restore the last location on startup (preset, saved field or GPS)
 */
function restoreLocation() {
    let savedLoc = null, savedLat = NaN, savedLon = NaN;
    try {
        savedLoc = localStorage.getItem('agrarwetter_loc');
        savedLat = parseFloat(localStorage.getItem('agrarwetter_lat'));
        savedLon = parseFloat(localStorage.getItem('agrarwetter_lon'));
    } catch (e) { /* storage unavailable */ }
    
    const field = findField(savedLoc);
    if (savedLoc && LOCATIONS[savedLoc]) {
        setLocation(savedLoc, LOCATIONS[savedLoc].lat, LOCATIONS[savedLoc].lon, null, { reload: false });
    } else if (field) {
        setLocation(savedLoc, field.lat, field.lon, field.elevation, { reload: false });
    } else if (Number.isFinite(savedLat) && Number.isFinite(savedLon)) {
        setLocation('gps', savedLat, savedLon, null, { reload: false });
    } else {
        renderLocationOptions();
    }
}

/**
 * Handle selection change in the location dropdown
 */
function handleLocationChange() {
    const value = document.getElementById('locationSelect').value;
    
    if (value === 'gps') {
        requestGPSLocation();
        return;
    }
    
    const field = findField(value);
    if (LOCATIONS[value]) {
        setLocation(value, LOCATIONS[value].lat, LOCATIONS[value].lon);
    } else if (field) {
        setLocation(value, field.lat, field.lon, field.elevation);
    }
}

/**
 * Request GPS Coordinates from the Browser
 */
function requestGPSLocation() {
    const gpsBtn = document.getElementById('gpsBtn');
    
    if (!navigator.geolocation) {
        alert("GPS-Ortung wird von diesem Browser nicht unterstützt.");
        return;
    }
    gpsBtn.classList.add('searching');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            gpsBtn.classList.remove('searching');
            // ~100 m precision is plenty for weather models; don't send exact positions to third parties
            const round3 = v => Math.round(v * 1000) / 1000;
            setLocation('gps', round3(position.coords.latitude), round3(position.coords.longitude));
        },
        (error) => {
            console.error("GPS Fehler:", error);
            alert("Standort konnte nicht ermittelt werden. Fallback auf Imst.");
            gpsBtn.classList.remove('searching');
            setLocation('imst', LOCATIONS.imst.lat, LOCATIONS.imst.lon);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * "Feld speichern" dialog: store the current location under a name, optionally with
 * the exact elevation of the meadow (alpine valleys: a few hundred metres decide frost)
 */
function openFieldDialog() {
    const dialog = document.getElementById('fieldDialog');
    const form = document.getElementById('fieldForm');
    form.reset();
    document.getElementById('fieldCoords').textContent = `${currentLat.toFixed(4)}° N, ${currentLon.toFixed(4)}° O`;
    const elevation = currentElevation ?? (weatherData && weatherData.elevation);
    document.getElementById('fieldElevation').value = Number.isFinite(elevation) ? Math.round(elevation) : '';
    dialog.showModal();
}

function handleFieldSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('fieldName').value.trim().slice(0, 40);
    const elevationInput = document.getElementById('fieldElevation').value.trim();
    const elevation = elevationInput === '' ? null : Number(elevationInput);
    
    if (!name) return;
    if (elevation !== null && !(Number.isFinite(elevation) && elevation >= 0 && elevation <= 4000)) return;
    
    const field = { id: Date.now().toString(36), name, lat: currentLat, lon: currentLon, elevation };
    saveFields([...loadFields(), field]);
    document.getElementById('fieldDialog').close();
    setLocation(FIELD_PREFIX + field.id, field.lat, field.lon, field.elevation);
}

function deleteCurrentField() {
    const field = findField(currentLocationKey);
    if (!field || !confirm(`Feld "${field.name}" löschen?`)) return;
    saveFields(loadFields().filter(f => f.id !== field.id));
    setLocation('imst', LOCATIONS.imst.lat, LOCATIONS.imst.lon);
}

/**
 * Simulate Hay Drying using hourly ET0 and rain hours
 */
function simulateHayDrying(dayIndex, daily, hourly, nowIdx) {
    const rainProb = daily.precipitation_probability_max[dayIndex];
    const rainSum = daily.precipitation_sum[dayIndex];
    
    // Direct index: each day starts at dayIndex * 24, mowing starts at 08:00
    // (today: not before the current hour)
    let startH = Math.max(dayIndex * 24 + 8, nowIdx);
    if (startH >= hourly.time.length) {
        startH = dayIndex * 24; // fallback to start of day
    }
    
    // If starting rain risk is too high
    if (rainSum >= 1.5 || rainProb >= 35) {
        return {
            text: "Mähen heute NICHT empfohlen (Regenrisiko!)",
            icon: "alert-triangle",
            class: "warning-rain"
        };
    }
    
    let cumulativeEt = 0;
    let hoursNeeded = 0;
    let rainInterrupted = false;
    let rainHour = -1;
    
    const maxHours = Math.min(hourly.time.length - startH, 96); // max 4 days
    
    for (let h = 0; h < maxHours; h++) {
        const idx = startH + h;
        const currentRain = hourly.precipitation[idx] || 0;
        const currentEt = hourly.et0_fao_evapotranspiration[idx] || 0;
        
        if (currentRain > 0.2) {
            rainInterrupted = true;
            rainHour = h;
            break;
        }
        
        cumulativeEt += currentEt;
        hoursNeeded++;
        
        if (cumulativeEt >= 10.0) {
            break;
        }
    }
    
    if (rainInterrupted) {
        const timeObj = new Date(hourly.time[startH + rainHour]);
        const dayNamesShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const dayFormatted = dayNamesShort[timeObj.getDay()];
        const hourFormatted = timeObj.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
        return {
            text: `Regenrisiko nach ${rainHour} Std. (${dayFormatted} ${hourFormatted} Uhr)! Trocknung unterbrochen.`,
            icon: "cloud-rain",
            class: "warning-rain"
        };
    }
    
    if (cumulativeEt >= 10.0) {
        const timeObj = new Date(hourly.time[startH + hoursNeeded]);
        const dayNamesShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const dayFormatted = dayNamesShort[timeObj.getDay()];
        const hourFormatted = timeObj.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
        
        let timeDesc = `${hoursNeeded} Std.`;
        if (hoursNeeded > 24) {
            const days = Math.floor(hoursNeeded / 24);
            const extra = hoursNeeded % 24;
            timeDesc = `${days} Tag(e) und ${extra} Std.`;
        }
        
        return {
            text: `Einfahrbereit in ca. ${timeDesc} (am ${dayFormatted} gegen ${hourFormatted} Uhr, ET₀: ${cumulativeEt.toFixed(1)}mm)`,
            icon: "check-circle",
            class: ""
        };
    }
    
    return {
        text: `Trocknung unvollständig (> 96 Std., ET₀ erreicht nur ${cumulativeEt.toFixed(1)}mm)`,
        icon: "cloud-sun",
        class: ""
    };
}

/**
 * Update Soil and Plant Health UI (Agro Tab)
 */
function updateSoilHealthUI(hourly, nowIdx, pastRain) {
    const soilTemp = hourly.soil_temperature_6cm ? hourly.soil_temperature_6cm[nowIdx] : null;
    const soilMoistureFraction = hourly.soil_moisture_3_to_9cm ? hourly.soil_moisture_3_to_9cm[nowIdx] : null;
    const hasSoilTemp = soilTemp !== null && soilTemp !== undefined;
    const hasSoilMoist = soilMoistureFraction !== null && soilMoistureFraction !== undefined;
    
    const soilTempValElement = document.getElementById('soilTempVal');
    const soilMoistValElement = document.getElementById('soilMoistVal');
    const soilMoistBarElement = document.getElementById('soilMoistBar');
    
    const tempStatus = document.getElementById('soilTempStatus');
    const tempDesc = document.getElementById('soilTempDesc');
    const moistStatus = document.getElementById('soilMoistStatus');
    const moistDesc = document.getElementById('soilMoistDesc');
    
    tempStatus.className = 'status-pill';
    moistStatus.className = 'status-pill';
    
    if (hasSoilTemp) {
        soilTempValElement.textContent = `${soilTemp.toFixed(1)} °C`;
        
        if (soilTemp <= 0) {
            tempStatus.textContent = "Bodenfrost";
            tempStatus.classList.add('danger');
            tempDesc.textContent = "Boden gefroren. Keine Keimung möglich.";
        } else if (soilTemp < 8) {
            tempStatus.textContent = "Kalt";
            tempStatus.classList.add('warning');
            tempDesc.textContent = "Zu kalt für die Keimung von Mais & Kartoffeln (< 8°C).";
        } else if (soilTemp < 15) {
            tempStatus.textContent = "Mäßig warm";
            tempStatus.classList.add('info');
            tempDesc.textContent = "Aussaat von Mais und Kartoffeln möglich.";
        } else {
            tempStatus.textContent = "Sehr gut";
            tempStatus.classList.add('success');
            tempDesc.textContent = "Optimale Keimbedingungen für wärmeliebende Kulturen.";
        }
    } else {
        soilTempValElement.textContent = "-- °C";
        tempStatus.textContent = "Keine Daten";
        tempStatus.classList.add('warning');
        tempDesc.textContent = "Bodentemperatur für diesen Standort aktuell nicht verfügbar.";
    }
    
    if (hasSoilMoist) {
        const soilMoistPercent = Math.round(soilMoistureFraction * 100);
        soilMoistValElement.textContent = `${soilMoistPercent} %`;
        soilMoistBarElement.style.width = `${soilMoistPercent}%`;
        
        if (soilMoistPercent < 15) {
            moistStatus.textContent = "Trocken";
            moistStatus.classList.add('danger');
            moistDesc.textContent = "Kritischer Dürrebereich. Künstliche Bewässerung empfohlen.";
        } else if (soilMoistPercent < 25) {
            moistStatus.textContent = "Mäßig trocken";
            moistStatus.classList.add('warning');
            moistDesc.textContent = "Bodenfeuchte gering, Pflanzenwachstum verlangsamt.";
        } else if (soilMoistPercent < 40) {
            moistStatus.textContent = "Optimal";
            moistStatus.classList.add('success');
            moistDesc.textContent = "Perfekter Wassergehalt für Nährstoffaufnahme.";
        } else {
            moistStatus.textContent = "Nass";
            moistStatus.classList.add('info');
            moistDesc.textContent = "Boden stark wassergesättigt. Vorsicht bei Befahrung.";
        }
    } else {
        soilMoistValElement.textContent = "-- %";
        soilMoistBarElement.style.width = "0%";
        moistStatus.textContent = "Keine Daten";
        moistStatus.classList.add('warning');
        moistDesc.textContent = "Bodenfeuchtigkeit für diesen Standort aktuell nicht verfügbar.";
    }
    
    updatePastRainUI(pastRain);
    updateFrostUI(hourly, nowIdx);
    
    const health = calculateAgroHealthIndices(hourly, nowIdx);
    
    document.getElementById('beeIndexVal').textContent = `${health.bee}%`;
    document.getElementById('beeProgressBar').style.width = `${health.bee}%`;
    const beeBadge = document.getElementById('beeStatusBadge');
    beeBadge.className = 'status-pill';
    if (health.bee >= 75) { beeBadge.textContent = "Sehr aktiv"; beeBadge.classList.add('success'); }
    else if (health.bee >= 35) { beeBadge.textContent = "Mäßig"; beeBadge.classList.add('warning'); }
    else { beeBadge.textContent = "Kaum Aktiv"; beeBadge.classList.add('danger'); }
    
    document.getElementById('scabIndexVal').textContent = `${health.scab}%`;
    document.getElementById('scabProgressBar').style.width = `${health.scab}%`;
    const scabBadge = document.getElementById('scabStatusBadge');
    scabBadge.className = 'status-pill';
    if (health.scab >= 70) { scabBadge.textContent = "Sehr hoch"; scabBadge.classList.add('danger'); }
    else if (health.scab >= 35) { scabBadge.textContent = "Mäßig"; scabBadge.classList.add('warning'); }
    else { scabBadge.textContent = "Gering"; scabBadge.classList.add('success'); }
    
    document.getElementById('blightIndexVal').textContent = `${health.blight}%`;
    document.getElementById('blightProgressBar').style.width = `${health.blight}%`;
    const blightBadge = document.getElementById('blightStatusBadge');
    blightBadge.className = 'status-pill';
    if (health.blight >= 70) { blightBadge.textContent = "Sehr hoch"; blightBadge.classList.add('danger'); }
    else if (health.blight >= 35) { blightBadge.textContent = "Mäßig"; blightBadge.classList.add('warning'); }
    else { blightBadge.textContent = "Gering"; blightBadge.classList.add('success'); }
}

/**
 * "Heute am Hof": concrete work recommendations from the indices above
 */
function updateFarmPlanner(daily, hourly, nowIdx) {
    const today = hourly.time[nowIdx].slice(0, 10);
    const nowHour = new Date(hourly.time[nowIdx]).getHours();
    const planDays = Math.min(7, daily.time.length);
    
    // 1. Spray windows: daylight hours with a good score, at least 2 h long
    const windows = findSprayWindows(hourly, nowIdx);
    if (windows.length > 0) {
        setPlannerTile('planSpray', 'good',
            windows.slice(0, 2).map(w => formatWindow(hourly, w, today)).join(', '),
            'Wenig Wind, kein Regen in den Folgestunden.');
    } else {
        setPlannerTile('planSpray', 'bad', 'Kein Spritzfenster', 'In den nächsten 36 Std. zu windig, zu nass oder ungünstige Temperatur.');
    }
    
    // 2. Mowing: next good Heuwetter day (today only if it is still morning)
    const mow = pickPlanDay(nowHour >= 11 ? 1 : 0, planDays, 70, d => calculateHeuIndex(d, daily));
    if (mow.value >= 50) {
        setPlannerTile('planMow', mow.value >= 70 ? 'good' : 'warn',
            `${formatDayWord(daily.time[mow.day], today)} (${mow.value}%)`,
            simulateHayDrying(mow.day, daily, hourly, nowIdx).text);
    } else {
        setPlannerTile('planMow', 'bad', 'Kein sicheres Heuwetter',
            'In den nächsten 7 Tagen keine 3 trockenen Tage am Stück.');
    }
    
    // 3. Slurry: next good Gülle day
    const guelle = pickPlanDay(0, planDays, 60, d => calculateGuelleIndex(d, daily));
    setPlannerTile('planGuelle', guelle.value >= 60 ? 'good' : guelle.value >= 40 ? 'warn' : 'bad',
        `${formatDayWord(daily.time[guelle.day], today)} (${guelle.value}%)`,
        guelle.value >= 60 ? 'Kühl, bedeckt oder leichter Regen.' : 'Kein idealer Tag – Ammoniakverluste beachten.');
    
    // 4. Warnings: frost, storm gusts, heavy rain, thunderstorms
    const warnings = [];
    const frost = findFrost(hourly, nowIdx);
    if (frost.airFrost) warnings.push(`Frost bis ${frost.minAir.value.toFixed(0)} °C (${formatHourLabel(hourly.time[frost.minAir.idx])})`);
    else if (frost.groundFrost) warnings.push(`Bodenfrost möglich (${formatHourLabel(hourly.time[frost.minAir.idx])})`);
    
    let maxGust = { value: 0, idx: -1 };
    for (let h = nowIdx; h < Math.min(nowIdx + 24, hourly.time.length); h++) {
        if (hourly.wind_gusts_10m[h] > maxGust.value) maxGust = { value: hourly.wind_gusts_10m[h], idx: h };
    }
    if (maxGust.value > 60) warnings.push(`Sturmböen bis ${Math.round(maxGust.value)} km/h (${formatHourLabel(hourly.time[maxGust.idx])})`);
    
    for (let d = 0; d < Math.min(3, daily.time.length); d++) {
        const dayWord = formatDayWord(daily.time[d], today);
        if (daily.weather_code[d] >= 95) warnings.push(`Gewittergefahr ${dayWord}`);
        else if (daily.precipitation_sum[d] >= 20) warnings.push(`Starkregen ${dayWord} (${daily.precipitation_sum[d].toFixed(0)} mm)`);
    }
    
    if (warnings.length > 0) {
        setPlannerTile('planWarn', 'bad', warnings[0], warnings.slice(1, 3).join(' · ') || 'Arbeiten entsprechend planen.');
    } else {
        setPlannerTile('planWarn', 'good', 'Keine Warnungen', 'Kein Frost, Sturm oder Starkregen in Sicht.');
    }
}

/**
 * Earliest day in [from, to) whose score reaches goodScore, else the best-scoring day
 */
function pickPlanDay(from, to, goodScore, scoreFn) {
    let best = { day: from, value: -1 };
    for (let d = from; d < to; d++) {
        const value = scoreFn(d);
        if (value >= goodScore) return { day: d, value };
        if (value > best.value) best = { day: d, value };
    }
    return best;
}

/**
 * Runs of consecutive daylight hours (05-21 Uhr) with spray score >= minScore
 */
function findSprayWindows(hourly, nowIdx, hours = 36, minScore = 70, minLength = 2) {
    const windows = [];
    const end = Math.min(nowIdx + hours, hourly.time.length);
    let runStart = -1;
    for (let h = nowIdx; h <= end; h++) {
        const hour = h < end ? new Date(hourly.time[h]).getHours() : -1;
        const ok = h < end && hour >= 5 && hour < 21 && sprayHourScore(hourly, h) >= minScore;
        if (ok && runStart < 0) runStart = h;
        if (!ok && runStart >= 0) {
            if (h - runStart >= minLength) windows.push({ start: runStart, end: h });
            runStart = -1;
        }
    }
    return windows;
}

function formatWindow(hourly, w, today) {
    const startHour = new Date(hourly.time[w.start]).getHours();
    const endHour = new Date(hourly.time[w.end - 1]).getHours() + 1;
    const pad = n => String(n).padStart(2, '0');
    return `${formatDayWord(hourly.time[w.start].slice(0, 10), today)} ${pad(startHour)}–${pad(endHour)} Uhr`;
}

/**
 * "Heute" / "Morgen" / "Fr 10.10." for a YYYY-MM-DD date
 */
function formatDayWord(dateStr, today) {
    const diff = Math.round((new Date(`${dateStr}T00:00`) - new Date(`${today}T00:00`)) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    return new Date(`${dateStr}T00:00`).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function setPlannerTile(id, status, main, sub) {
    const tile = document.getElementById(id);
    tile.classList.remove('good', 'warn', 'bad');
    tile.classList.add(status);
    tile.querySelector('.plan-main').textContent = main;
    tile.querySelector('.plan-sub').textContent = sub;
}

/**
 * Rain of the last 7 days (water supply, trafficability, slurry runoff risk)
 */
function updatePastRainUI(pastRain) {
    const valEl = document.getElementById('pastRainVal');
    const status = document.getElementById('pastRainStatus');
    const desc = document.getElementById('pastRainDesc');
    status.className = 'status-pill';
    
    if (!pastRain || pastRain.days === 0) {
        valEl.textContent = '-- mm';
        status.textContent = 'Keine Daten';
        status.classList.add('warning');
        desc.textContent = 'Niederschlag der Vortage nicht verfügbar.';
        return;
    }
    
    valEl.textContent = `${pastRain.sum.toFixed(1)} mm`;
    if (pastRain.sum < 5) {
        status.textContent = 'Trocken';
        status.classList.add('warning');
        desc.textContent = 'Kaum Regen in den letzten Tagen – Bewässerung prüfen.';
    } else if (pastRain.sum <= 40) {
        status.textContent = 'Normal';
        status.classList.add('success');
        desc.textContent = 'Ausreichende Niederschläge in der letzten Woche.';
    } else {
        status.textContent = 'Sehr nass';
        status.classList.add('info');
        desc.textContent = 'Viel Regen – Befahrbarkeit und Abschwemmung (Gülle) beachten.';
    }
}

/**
 * Frost outlook for the next 48 hours: air (2 m) and ground surface (0 cm)
 */
function findFrost(hourly, nowIdx, hours = 48) {
    const end = Math.min(nowIdx + hours, hourly.time.length);
    let minAir = { value: Infinity, idx: -1 };
    let minGround = { value: Infinity, idx: -1 };
    for (let h = nowIdx; h < end; h++) {
        const air = hourly.temperature_2m[h];
        const ground = hourly.soil_temperature_0cm ? hourly.soil_temperature_0cm[h] : null;
        if (Number.isFinite(air) && air < minAir.value) minAir = { value: air, idx: h };
        if (Number.isFinite(ground) && ground < minGround.value) minGround = { value: ground, idx: h };
    }
    // Ground frost is likely in clear nights when the 2 m temperature drops below ~2 °C
    const groundFrost = (minGround.idx >= 0 && minGround.value <= 0) || (minAir.idx >= 0 && minAir.value <= 2);
    return { minAir, minGround, airFrost: minAir.value <= 0, groundFrost };
}

function updateFrostUI(hourly, nowIdx) {
    const frost = findFrost(hourly, nowIdx);
    const valEl = document.getElementById('frostVal');
    const status = document.getElementById('frostStatus');
    const desc = document.getElementById('frostDesc');
    status.className = 'status-pill';
    
    if (frost.minAir.idx < 0) {
        valEl.textContent = '-- °C';
        status.textContent = 'Keine Daten';
        status.classList.add('warning');
        desc.textContent = '';
        return;
    }
    
    valEl.textContent = `${frost.minAir.value.toFixed(1)} °C`;
    const when = formatHourLabel(hourly.time[frost.minAir.idx]);
    if (frost.airFrost) {
        status.textContent = 'Frost';
        status.classList.add('danger');
        desc.textContent = `Luftfrost erwartet (Tiefstwert ${when}). Empfindliche Kulturen schützen.`;
    } else if (frost.groundFrost) {
        status.textContent = 'Bodenfrost möglich';
        status.classList.add('warning');
        desc.textContent = `Bodennah Frost möglich (Tiefstwert ${when}).`;
    } else {
        status.textContent = 'Frostfrei';
        status.classList.add('success');
        desc.textContent = `Tiefstwert der nächsten 48 Std. ${when}.`;
    }
}

/**
 * Helper: "Mo 06:00" style label for an hourly time string
 */
function formatHourLabel(timeStr) {
    const timeObj = new Date(timeStr);
    const weekday = timeObj.toLocaleDateString('de-AT', { weekday: 'short' });
    const time = timeObj.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    return `${weekday} ${time} Uhr`;
}

/**
 * Calculate Biological Indicators (Bees, Scab, Blight) for the next 24 hours
 */
function calculateAgroHealthIndices(hourly, nowIdx) {
    const end = Math.min(nowIdx + 24, hourly.time.length);
    let beeSum = 0;
    let beeCount = 0;
    
    for (let h = nowIdx; h < end; h++) {
        const timeObj = new Date(hourly.time[h]);
        const hour = timeObj.getHours();
        
        if (hour >= 6 && hour <= 18) {
            const temp = hourly.temperature_2m[h];
            const wind = hourly.wind_speed_10m[h];
            const rain = hourly.precipitation[h] || 0.0;
            
            let tFactor = 0;
            if (temp >= 18) tFactor = 1.0;
            else if (temp >= 12) tFactor = (temp - 12) / 6;
            
            let wFactor = 0;
            if (wind < 10) wFactor = 1.0;
            else if (wind < 25) wFactor = 1.0 - ((wind - 10) / 15);
            
            const rFactor = rain > 0 ? 0.0 : 1.0;
            
            beeSum += (tFactor * wFactor * rFactor * 100);
            beeCount++;
        }
    }
    const beeIndex = beeCount > 0 ? Math.round(beeSum / beeCount) : 0;
    
    // Longest continuous leaf-wetness period and its average temperature
    let maxWetHours = 0;
    let maxWetTempSum = 0;
    let currentWetHours = 0;
    let currentWetTempSum = 0;
    
    for (let h = nowIdx; h < end; h++) {
        const rh = hourly.relative_humidity_2m[h];
        const temp = hourly.temperature_2m[h];
        
        if (rh >= 85) {
            currentWetHours++;
            currentWetTempSum += temp;
            if (currentWetHours > maxWetHours) {
                maxWetHours = currentWetHours;
                maxWetTempSum = currentWetTempSum;
            }
        } else {
            currentWetHours = 0;
            currentWetTempSum = 0;
        }
    }
    
    let scabIndex = 0;
    if (maxWetHours > 0) {
        const avgWetTemp = maxWetTempSum / maxWetHours;
        let reqHours = 28;
        if (avgWetTemp >= 6 && avgWetTemp < 9) reqHours = 21;
        else if (avgWetTemp >= 9 && avgWetTemp < 12) reqHours = 14;
        else if (avgWetTemp >= 12 && avgWetTemp <= 24) reqHours = 9;
        else if (avgWetTemp > 24 && avgWetTemp <= 27) reqHours = 12;
        
        scabIndex = Math.min(100, Math.round((maxWetHours / reqHours) * 100));
    }
    
    let blightHours = 0;
    for (let h = nowIdx; h < end; h++) {
        const rh = hourly.relative_humidity_2m[h];
        const temp = hourly.temperature_2m[h];
        if (rh >= 90 && temp >= 10 && temp <= 24) {
            blightHours++;
        }
    }
    const blightIndex = Math.min(100, Math.round((blightHours / 12) * 100));
    
    return {
        bee: beeIndex,
        scab: scabIndex,
        blight: blightIndex
    };
}
