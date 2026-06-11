/**
 * AGRARWETTER IMST - APPLICATION LOGIC
 * Coordinates: Imst (Latitude: 47.2386, Longitude: 10.7422)
 */

// Global state
let weatherData = null;
let tempChartInstance = null;
let precipWindChartInstance = null;

// Configurations
const IMST_LAT = 47.2386;
const IMST_LON = 10.7422;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Set Windy Radar Source
    initRadar();
    
    // Fetch Weather Data
    fetchWeatherData();
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
    } else if (tabName === 'links') {
        document.getElementById('tabBtnLinks').classList.add('active');
        document.getElementById('tabContentLinks').classList.add('active-content');
    }
}

/**
 * Initialize Windy Radar iframe URL dynamically
 */
function initRadar() {
    const radarIframe = document.getElementById('windyRadarIframe');
    if (radarIframe) {
        // Windy Embed URL with coordinates for Imst
        radarIframe.src = `https://embed.windy.com/embed2.html?lat=${IMST_LAT}&lon=${IMST_LON}&zoom=9&level=surface&overlay=radar&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`;
    }
}

/**
 * Fetch Weather Data from Open-Meteo
 */
async function fetchWeatherData() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${IMST_LAT}&longitude=${IMST_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,evapotranspiration,wind_speed_10m,wind_gusts_10m,shortwave_radiation&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,shortwave_radiation_sum,et0_fao_evapotranspiration&timezone=Europe%2FBerlin`;
    
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
            const et = hourly.evapotranspiration[h] ? hourly.evapotranspiration[h].toFixed(2) : '0.00';
            
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
