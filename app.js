/**
 * AGRARWETTER IMST - APPLICATION LOGIC
 * Coordinates: Imst (Latitude: 47.2386, Longitude: 10.7422)
 */

// Global state
let weatherData = null;
let tempChartInstance = null;
let precipWindChartInstance = null;

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

let currentLat = LOCATIONS.imst.lat;
let currentLon = LOCATIONS.imst.lon;
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

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Restore location from localStorage
    const savedLoc = localStorage.getItem('agrarwetter_loc');
    const savedLat = localStorage.getItem('agrarwetter_lat');
    const savedLon = localStorage.getItem('agrarwetter_lon');
    
    if (savedLoc && LOCATIONS[savedLoc]) {
        currentLocationKey = savedLoc;
        currentLat = LOCATIONS[savedLoc].lat;
        currentLon = LOCATIONS[savedLoc].lon;
        document.getElementById('locationSelect').value = savedLoc;
    } else if (savedLat && savedLon) {
        currentLocationKey = 'gps';
        currentLat = parseFloat(savedLat);
        currentLon = parseFloat(savedLon);
        
        const nearestKey = findNearestLocation(currentLat, currentLon);
        const nearestName = LOCATIONS[nearestKey].label.split(' (')[0];
        
        // Add GPS option dynamically if it was loaded
        const select = document.getElementById('locationSelect');
        let gpsOpt = select.querySelector('option[value="gps"]');
        if (!gpsOpt) {
            gpsOpt = document.createElement('option');
            gpsOpt.value = 'gps';
            select.appendChild(gpsOpt);
        }
        gpsOpt.textContent = `GPS (nahe ${nearestName})`;
        select.value = 'gps';
    }
    
    // Set Windy Radar Source
    initRadar();
    
    // Fetch Weather Data
    fetchWeatherData();
    
    // Unregister any active service worker and clear caches to ensure fresh data
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,et0_fao_evapotranspiration,wind_speed_10m,wind_gusts_10m,shortwave_radiation,soil_temperature_6cm,soil_moisture_3_to_9cm&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration&timezone=Europe%2FBerlin`;
    
    // Show loading state in UI
    const updateTimeEl = document.getElementById('updateTime');
    if (updateTimeEl) {
        updateTimeEl.innerHTML = '<i data-lucide="loader-2" class="spin" style="display:inline-block; vertical-align:middle; margin-right:5px; width:14px; height:14px;"></i> Wetterdaten werden geladen...';
        lucide.createIcons();
    }
    
    const appContent = document.querySelector('.app-content');
    if (appContent) {
        appContent.classList.add('loading-fade');
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }
        weatherData = await response.json();
        
        // Update UI components
        updateCurrentWeather(weatherData.current);
        
        const indices = calculateAllIndices(weatherData.daily, weatherData.hourly);
        updateIndicesUI(indices);
        
        updateForecastUI(weatherData.daily, weatherData.hourly);
        
        updateSoilHealthUI(weatherData.hourly);
        
        renderCharts(weatherData.hourly);
        
        // Update Timestamp
        const now = new Date();
        document.getElementById('updateTime').textContent = `Stand: Heute, ${now.toLocaleTimeString('de-AT', {hour: '2-digit', minute:'2-digit'})} Uhr`;
        
    } catch (error) {
        console.error("Fehler beim Abrufen der Wetterdaten:", error);
        document.getElementById('updateTime').textContent = "Fehler beim Laden der Live-Daten.";
        
        // Show offline fallback alert
        const alertPill = document.getElementById('activeAlert');
        const alertText = document.getElementById('alertText');
        alertPill.classList.remove('hide');
        alertPill.style.background = 'rgba(239, 68, 68, 0.2)';
        alertPill.style.borderColor = '#ef4444';
        alertText.textContent = "Verbindungsfehler. Bitte Internetverbindung prüfen.";
        alertText.style.color = '#fecaca';
    } finally {
        if (appContent) {
            appContent.classList.remove('loading-fade');
        }
    }
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
    if ([51, 53, 55, 80, 81, 82].includes(code)) return 'cloud-drizzle';
    if ([61, 63, 65].includes(code)) return 'cloud-rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snowflake';
    if ([95, 96, 99].includes(code)) return 'cloud-lightning';
    return 'cloud';
}

/**
 * Update the Current Weather Card
 */
function updateCurrentWeather(current) {
    document.getElementById('currentTemp').textContent = `${Math.round(current.temperature_2m)}°C`;
    document.getElementById('feelsLike').textContent = `Gefühlt: ${Math.round(current.apparent_temperature)}°C`;
    document.getElementById('currentHumidity').textContent = `${current.relative_humidity_2m}%`;
    document.getElementById('currentWind').textContent = `${Math.round(current.wind_speed_10m)} (${Math.round(current.wind_gusts_10m)}) km/h`;
    document.getElementById('currentPrecipitation').textContent = `${current.precipitation.toFixed(1)} mm`;
    document.getElementById('currentPressure').textContent = `${Math.round(current.surface_pressure)} hPa`;
    
    // Weather Desc & Icon
    const desc = getWeatherDesc(current.weather_code);
    document.getElementById('currentWeatherDesc').textContent = desc;
    
    const iconName = getWeatherIconName(current.weather_code);
    const iconContainer = document.getElementById('currentWeatherIcon');
    iconContainer.innerHTML = `<i data-lucide="${iconName}"></i>`;
    
    // Check for alerts
    const alertPill = document.getElementById('activeAlert');
    const alertText = document.getElementById('alertText');
    
    if (current.wind_gusts_10m > 50) {
        alertPill.classList.remove('hide');
        alertText.textContent = `Starkwindböen (${Math.round(current.wind_gusts_10m)} km/h)!`;
    } else if (current.precipitation > 5) {
        alertPill.classList.remove('hide');
        alertText.textContent = "Starker Niederschlag aktuell!";
    } else {
        alertPill.classList.add('hide');
    }
    
    lucide.createIcons();
}

/**
 * Calculate All Agricultural Indices
 */
function calculateAllIndices(daily, hourly) {
    // 1. Calculate Heuwetter-Index for today (Day 0)
    const heuIndex = calculateHeuIndex(0, daily);
    
    // 2. Calculate Spritzwetter-Index for current window (next 12 hours)
    const spritzIndex = calculateSpritzIndex(hourly);
    
    // 3. Calculate Gülle-Wetter-Index for today (Day 0)
    const guelleIndex = calculateGuelleIndex(0, daily);
    
    return {
        heu: heuIndex,
        spritz: spritzIndex,
        guelle: guelleIndex
    };
}

/**
 * Heuwetter-Index Algorithm (rolling window)
 * Evaluates drying conditions over 3 consecutive days starting on startDateIndex
 */
function calculateHeuIndex(startDateIndex, daily) {
    const numDaysForecast = daily.precipitation_sum.length;
    
    // Adjust window size for days close to forecast limit
    let windowSize = 3;
    if (startDateIndex + 2 >= numDaysForecast) {
        windowSize = numDaysForecast - startDateIndex; // 2 or 1 day window
    }
    
    if (windowSize <= 0) return 0;
    
    let rainScoreTotal = 100;
    let etSum = 0;
    let sunSum = 0;
    let tempSum = 0;
    let windSum = 0;
    
    for (let k = 0; k < windowSize; k++) {
        const idx = startDateIndex + k;
        
        const p = daily.precipitation_sum[idx];
        const prob = daily.precipitation_probability_max[idx];
        const et = daily.et0_fao_evapotranspiration[idx] || 0.0;
        const sun = (daily.sunshine_duration[idx] || 0) / 3600;
        const tMax = daily.temperature_2m_max[idx];
        const wMax = daily.wind_speed_10m_max[idx];
        
        // 1. Rain Penalty per day
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
        rDay = Math.max(0, rDay);
        
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
function calculateSpritzIndex(hourly) {
    let scoresSum = 0;
    let count = 0;
    
    // Look at next 12 hours
    const limit = Math.min(12, hourly.temperature_2m.length);
    
    for (let h = 0; h < limit; h++) {
        const temp = hourly.temperature_2m[h];
        const wind = hourly.wind_speed_10m[h];
        const gust = hourly.wind_gusts_10m[h];
        
        // Rain checks (current and next 3 hours)
        let rainPenalty = 0;
        for (let nextH = h; nextH < Math.min(h + 4, hourly.precipitation.length); nextH++) {
            if (hourly.precipitation[nextH] > 0.1) {
                rainPenalty = 100; // Rain washes spray away
                break;
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
        
        const hourScore = Math.max(0, (100 - rainPenalty) * (windScore / 100) * (tempScore / 100));
        scoresSum += hourScore;
        count++;
    }
    
    return count > 0 ? Math.round(scoresSum / count) : 0;
}

/**
 * Gülle-Wetter-Index Algorithm
 * Evaluates day-level suitability for spreading liquid manure (requires cloudiness/light rain)
 */
function calculateGuelleIndex(dayIndex, daily) {
    const p = daily.precipitation_sum[dayIndex];
    const prob = daily.precipitation_probability_max[dayIndex];
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
function updateForecastUI(daily, hourly) {
    const listContainer = document.getElementById('forecastList');
    listContainer.innerHTML = ''; // Clear loading spinner
    
    const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr);
        
        let weekday = daysOfWeek[dateObj.getDay()];
        if (i === 0) weekday = "Heute";
        else if (i === 1) weekday = "Morgen";
        
        const formattedDate = dateObj.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
        
        const code = daily.weather_code[i];
        const iconName = getWeatherIconName(code);
        const desc = getWeatherDesc(code);
        
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);
        
        const rainSum = daily.precipitation_sum[i];
        const rainProb = daily.precipitation_probability_max[i];
        
        // Calculate Heuwetter Index for this specific day
        const heuIdx = calculateHeuIndex(i, daily);
        
        // Determine Heuwetter badge
        let heuBadgeClass = 'stop';
        let heuBadgeText = 'Heuen: Rot';
        if (heuIdx >= 70) {
            heuBadgeClass = 'go';
            heuBadgeText = `Heuen: Sehr gut (${heuIdx}%)`;
        } else if (heuIdx >= 40) {
            heuBadgeClass = 'caution';
            heuBadgeText = `Heuen: Mäßig (${heuIdx}%)`;
        } else {
            heuBadgeText = heuIdx > 0 ? `Heuen: Riskant (${heuIdx}%)` : 'Heuen: Nein (0%)';
        }
        
        // Simulate Hay-Drying Clock (ET0 and Rain hours)
        const dryingInfo = simulateHayDrying(i, daily, hourly);
        
        // Generate Hourly Table Content for this day
        const hourlyRowsHtml = generateHourlyRowsForDay(i, dateStr, hourly);
        
        // Create the row element
        const row = document.createElement('div');
        row.className = 'forecast-day-row';
        row.id = `forecastRow-${i}`;
        
        row.innerHTML = `
            <div class="forecast-day-summary" onclick="toggleForecastAccordion(${i})">
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
                    <span>${rainSum.toFixed(1)} mm (${rainProb}%)</span>
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
    
    // Re-initialize newly added icons
    lucide.createIcons();
}

/**
 * Generate hourly rows for the accordion details
 */
function generateHourlyRowsForDay(dayIndex, dateStr, hourly) {
    let rowsHtml = '';
    
    // We search for matching hours. Open-Meteo provides a flat array of 168 hours (7 days * 24h).
    for (let h = 0; h < hourly.time.length; h++) {
        const hourTimeStr = hourly.time[h];
        if (hourTimeStr.startsWith(dateStr)) {
            // Found matching hour
            const timeObj = new Date(hourTimeStr);
            const hourFormatted = timeObj.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
            
            const temp = hourly.temperature_2m[h].toFixed(1);
            const rain = hourly.precipitation[h].toFixed(1);
            const prob = hourly.precipitation_probability[h];
            const rh = hourly.relative_humidity_2m[h];
            const wind = Math.round(hourly.wind_speed_10m[h]);
            const gust = Math.round(hourly.wind_gusts_10m[h]);
            const et = hourly.et0_fao_evapotranspiration[h] ? hourly.et0_fao_evapotranspiration[h].toFixed(2) : '0.00';
            
            // Only show key farming hours: 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 to keep layout readable
            const hourInt = timeObj.getHours();
            if ([6, 9, 12, 15, 18, 21].includes(hourInt)) {
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
        detailPanel.style.maxHeight = '0';
    } else {
        // Collapse all others first for clean view
        document.querySelectorAll('.forecast-day-row').forEach(otherRow => {
            otherRow.classList.remove('expanded');
            const otherDetail = otherRow.querySelector('.day-hourly-details');
            if (otherDetail) otherDetail.style.maxHeight = '0';
        });
        
        // Expand this one
        row.classList.add('expanded');
        // Let's set a maximum height large enough for the contents
        detailPanel.style.maxHeight = '500px';
    }
}

/**
 * Render Trend Charts (Chart.js)
 */
function renderCharts(hourly) {
    // Extract next 48 hours for high-res trend charts
    const limit = 48;
    const labels = [];
    const temps = [];
    const dewPoints = [];
    const precips = [];
    const windSpeeds = [];
    const windGusts = [];
    
    const daysOfWeekShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    
    for (let h = 0; h < limit; h++) {
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
    
    // Chart.js Default styling overrides for dark mode
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.font.family = 'Inter';
    
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
                    backgroundColor: '#1f2937',
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
                    backgroundColor: '#1f2937',
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
 * Handle selection change in the location dropdown
 */
function handleLocationChange() {
    const select = document.getElementById('locationSelect');
    const value = select.value;
    
    if (value === 'gps') {
        requestGPSLocation();
        return;
    }
    
    if (LOCATIONS[value]) {
        currentLocationKey = value;
        currentLat = LOCATIONS[value].lat;
        currentLon = LOCATIONS[value].lon;
        
        // Save to localStorage
        localStorage.setItem('agrarwetter_loc', value);
        localStorage.removeItem('agrarwetter_lat');
        localStorage.removeItem('agrarwetter_lon');
        
        // Refresh UI
        initRadar();
        fetchWeatherData();
    }
}

/**
 * Request GPS Coordinates from the Browser
 */
function requestGPSLocation() {
    const gpsBtn = document.getElementById('gpsBtn');
    gpsBtn.classList.add('searching');
    
    if (!navigator.geolocation) {
        alert("GPS-Ortung wird von diesem Browser nicht unterstützt.");
        gpsBtn.classList.remove('searching');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            currentLocationKey = 'gps';
            
            // Save to localStorage
            localStorage.removeItem('agrarwetter_loc');
            localStorage.setItem('agrarwetter_lat', currentLat);
            localStorage.setItem('agrarwetter_lon', currentLon);
            
            // Update dropdown display
            const nearestKey = findNearestLocation(currentLat, currentLon);
            const nearestName = LOCATIONS[nearestKey].label.split(' (')[0];
            
            const select = document.getElementById('locationSelect');
            let gpsOpt = select.querySelector('option[value="gps"]');
            if (!gpsOpt) {
                gpsOpt = document.createElement('option');
                gpsOpt.value = 'gps';
                select.appendChild(gpsOpt);
            }
            gpsOpt.textContent = `GPS (nahe ${nearestName})`;
            select.value = 'gps';
            
            gpsBtn.classList.remove('searching');
            
            // Refresh UI
            initRadar();
            fetchWeatherData();
        },
        (error) => {
            console.error("GPS Fehler:", error);
            alert("Standort konnte nicht ermittelt werden. Fallback auf Imst.");
            gpsBtn.classList.remove('searching');
            // Fallback to Imst
            const select = document.getElementById('locationSelect');
            select.value = 'imst';
            handleLocationChange();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * Simulate Hay Drying using hourly ET0 and rain hours
 */
function simulateHayDrying(dayIndex, daily, hourly) {
    const rainProb = daily.precipitation_probability_max[dayIndex];
    const rainSum = daily.precipitation_sum[dayIndex];
    
    // Find index of 08:00 AM of the mowing day in the hourly array
    const dateStr = daily.time[dayIndex];
    let startH = -1;
    for (let h = 0; h < hourly.time.length; h++) {
        if (hourly.time[h].startsWith(dateStr) && hourly.time[h].includes("T08:00")) {
            startH = h;
            break;
        }
    }
    
    if (startH === -1) {
        for (let h = 0; h < hourly.time.length; h++) {
            if (hourly.time[h].startsWith(dateStr)) {
                startH = h;
                break;
            }
        }
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
function updateSoilHealthUI(hourly) {
    const hasSoilTemp = hourly && hourly.soil_temperature_6cm && hourly.soil_temperature_6cm[0] !== null && hourly.soil_temperature_6cm[0] !== undefined;
    const hasSoilMoist = hourly && hourly.soil_moisture_3_to_9cm && hourly.soil_moisture_3_to_9cm[0] !== null && hourly.soil_moisture_3_to_9cm[0] !== undefined;
    
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
        const soilTemp = hourly.soil_temperature_6cm[0];
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
        const soilMoistureFraction = hourly.soil_moisture_3_to_9cm[0];
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
    
    const health = calculateAgroHealthIndices(hourly);
    
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
 * Calculate Biological Indicators (Bees, Scab, Blight) for the next 24 hours
 */
function calculateAgroHealthIndices(hourly) {
    let beeSum = 0;
    let beeCount = 0;
    
    for (let h = 0; h < 24; h++) {
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
            
            let rFactor = rain > 0 ? 0.0 : 1.0;
            
            beeSum += (tFactor * wFactor * rFactor * 100);
            beeCount++;
        }
    }
    const beeIndex = beeCount > 0 ? Math.round(beeSum / beeCount) : 0;
    
    let maxWetHours = 0;
    let currentWetHours = 0;
    let wetTempSum = 0;
    
    for (let h = 0; h < 24; h++) {
        const rh = hourly.relative_humidity_2m[h];
        const temp = hourly.temperature_2m[h];
        
        if (rh >= 85) {
            currentWetHours++;
            wetTempSum += temp;
            if (currentWetHours > maxWetHours) {
                maxWetHours = currentWetHours;
            }
        } else {
            currentWetHours = 0;
        }
    }
    
    let scabIndex = 0;
    if (maxWetHours > 0) {
        const avgWetTemp = wetTempSum / maxWetHours;
        let reqHours = 28;
        if (avgWetTemp >= 6 && avgWetTemp < 9) reqHours = 21;
        else if (avgWetTemp >= 9 && avgWetTemp < 12) reqHours = 14;
        else if (avgWetTemp >= 12 && avgWetTemp <= 24) reqHours = 9;
        else if (avgWetTemp > 24 && avgWetTemp <= 27) reqHours = 12;
        
        scabIndex = Math.min(100, Math.round((maxWetHours / reqHours) * 100));
    }
    
    let blightHours = 0;
    for (let h = 0; h < 24; h++) {
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
