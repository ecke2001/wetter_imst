/**
 * Synthetic Open-Meteo forecast response, shaped like the real API.
 * Honors past_days / forecast_days / elevation from the request URL.
 *
 * Fixed pattern (relative to today): dry days, rain on day 3, past days with 2 mm each.
 * Options: daysAgo (data generated as if fetched N days ago), frost (frost night on day 1),
 * storm (75 km/h gusts today).
 */
export function mockForecast(url, { daysAgo = 0, frost = false, storm = false } = {}) {
    const params = new URL(url).searchParams;
    const past = Number(params.get('past_days') || 0);
    const days = past + Number(params.get('forecast_days') || 7);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - past - daysAgo);

    const pad = n => String(n).padStart(2, '0');
    const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const rainDay = past + 3;
    const frostDay = frost ? past + 1 : -1;

    const hourly = {
        time: [], temperature_2m: [], relative_humidity_2m: [], dew_point_2m: [], precipitation_probability: [],
        precipitation: [], et0_fao_evapotranspiration: [], wind_speed_10m: [], wind_gusts_10m: [], shortwave_radiation: [],
        soil_temperature_0cm: [], soil_temperature_6cm: [], soil_moisture_3_to_9cm: []
    };
    for (let i = 0; i < days * 24; i++) {
        const d = new Date(start);
        d.setHours(i); // DST-safe local hours
        const h = d.getHours();
        const day = Math.floor(i / 24);
        let t = 12 + 8 * Math.sin((h - 9) / 24 * 2 * Math.PI); // 4..20 °C, no frost
        if (day === frostDay && h < 8) t -= 12;
        const rain = day === rainDay && h > 12 && h < 18 ? 1.2 : (day < past && h === 15 ? 2 : 0);

        hourly.time.push(`${isoDate(d)}T${pad(h)}:00`);
        hourly.temperature_2m.push(Number(t.toFixed(1)));
        hourly.relative_humidity_2m.push(Math.round(70 - 20 * Math.sin((h - 9) / 24 * 2 * Math.PI)));
        hourly.dew_point_2m.push(Number((t - 5).toFixed(1)));
        hourly.precipitation.push(rain);
        hourly.precipitation_probability.push(day === rainDay ? 70 : 10);
        hourly.et0_fao_evapotranspiration.push(h > 6 && h < 19 ? Number((0.35 * Math.sin((h - 6) / 13 * Math.PI)).toFixed(2)) : 0.01);
        hourly.wind_speed_10m.push(4 + h % 5);
        hourly.wind_gusts_10m.push(storm && day === past ? 75 : 10 + h % 7);
        hourly.shortwave_radiation.push(h > 6 && h < 19 ? 500 : 0);
        hourly.soil_temperature_0cm.push(Number((t - 1).toFixed(1)));
        hourly.soil_temperature_6cm.push(Number((t - 2).toFixed(1)));
        hourly.soil_moisture_3_to_9cm.push(0.31);
    }

    const daily = {
        time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [],
        sunshine_duration: [], precipitation_sum: [], precipitation_probability_max: [], wind_speed_10m_max: [],
        shortwave_radiation_sum: [], et0_fao_evapotranspiration: []
    };
    for (let day = 0; day < days; day++) {
        const d = new Date(start);
        d.setDate(d.getDate() + day);
        daily.time.push(isoDate(d));
        daily.weather_code.push(day === rainDay ? 61 : [0, 1, 2, 3][day % 4]);
        daily.temperature_2m_max.push(18);
        daily.temperature_2m_min.push(day === frostDay ? -8 : 4);
        daily.sunrise.push(`${isoDate(d)}T07:15`);
        daily.sunset.push(`${isoDate(d)}T18:40`);
        daily.sunshine_duration.push(day === rainDay ? 3600 : 30000);
        daily.precipitation_sum.push(day === rainDay ? 6 : (day < past ? 2 : 0));
        daily.precipitation_probability_max.push(day === rainDay ? 70 : 10);
        daily.wind_speed_10m_max.push(9);
        daily.shortwave_radiation_sum.push(12);
        daily.et0_fao_evapotranspiration.push(day === rainDay ? 1 : 3);
    }

    return {
        latitude: Number(params.get('latitude')),
        longitude: Number(params.get('longitude')),
        elevation: params.has('elevation') ? Number(params.get('elevation')) : 828,
        utc_offset_seconds: -new Date().getTimezoneOffset() * 60,
        current: {
            temperature_2m: 14.2, relative_humidity_2m: 62, apparent_temperature: 13, precipitation: 0, rain: 0, showers: 0,
            weather_code: 2, surface_pressure: 925, wind_speed_10m: 8, wind_gusts_10m: storm ? 75 : 18
        },
        hourly,
        daily
    };
}
