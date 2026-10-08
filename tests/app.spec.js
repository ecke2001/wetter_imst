import { test, expect } from '@playwright/test';
import { mockServices, collectProblems, waitForWeather } from './helpers.js';
import { mockForecast } from './mock-weather.js';

const IMST = 'https://api.open-meteo.com/v1/forecast?latitude=47.2386&longitude=10.7422';

test.describe('Dashboard', () => {
    test('loads without errors, CSP or SRI violations', async ({ page, context }) => {
        const problems = collectProblems(page);
        const api = await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        expect(await page.evaluate(() => typeof Chart === 'function' && Boolean(window.lucide))).toBe(true);
        await expect(page.locator('#tempChart')).toBeVisible();
        expect(api.lastUrl.searchParams.get('past_days')).toBe('7');
        expect(api.lastUrl.searchParams.get('forecast_days')).toBe('14');
        expect(problems).toEqual([]);
    });

    test('hourly views start at the current hour, not at midnight', async ({ page, context }) => {
        await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        const { hourTime, day0, chartFirstLabel } = await page.evaluate(() => ({
            hourTime: weatherData.hourly.time[currentHourIdx],
            day0: weatherData.daily.time[0],
            chartFirstLabel: Chart.getChart('tempChart').data.labels[0]
        }));
        const now = new Date();
        expect(Number(hourTime.slice(11, 13))).toBe(now.getHours());
        expect(day0).toBe(hourTime.slice(0, 10));
        expect(chartFirstLabel).toContain(`${now.getHours()}:00`);
    });

    test('planner tiles, 14-day toggle and rain explanation', async ({ page, context }) => {
        await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        for (const id of ['planSpray', 'planMow', 'planGuelle', 'planWarn']) {
            await expect(page.locator(`#${id} .plan-main`)).not.toHaveText('--');
        }
        await expect(page.locator('#planWarn .plan-main')).toHaveText('Keine Warnungen');

        const visibleRows = page.locator('.forecast-day-row:visible');
        await expect(visibleRows).toHaveCount(7);
        await page.click('#forecastMoreBtn');
        await expect(visibleRows).toHaveCount(14);

        // Day 3 has rain, so days 1 and 2 have it inside their 3-day hay window
        await expect(page.locator('#forecastRow-1 .heu-badge')).toHaveText(/Heuen: Nein \(Regen \w+/);
        await expect(page.locator('#forecastRow-3 .heu-badge')).toHaveText('Heuen: Nein (Regen)');
    });

    test('forecast rows open with the keyboard and show the full hourly table', async ({ page, context }) => {
        await mockServices(context);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await waitForWeather(page);

        await page.focus('#forecastRow-1 .forecast-day-summary');
        await page.keyboard.press('Enter');
        await expect(page.locator('#forecastRow-1 .forecast-day-summary')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#forecastRow-1 .hourly-table tbody tr')).toHaveCount(6);
        // The panel animates to its full content height (a fixed max-height used to clip it)
        const panel = page.locator('#forecastRow-1 .day-hourly-details');
        await expect.poll(() => panel.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    });

    test('frost and storm warnings', async ({ page, context }) => {
        await mockServices(context, { weather: { frost: true, storm: true } });
        await page.goto('/');
        await waitForWeather(page);

        await expect(page.locator('#planWarn')).toHaveClass(/\bbad\b/);
        await expect(page.locator('#planWarn')).toContainText('Frost bis');
        await expect(page.locator('#planWarn')).toContainText('Sturmböen bis 75 km/h');
        await page.click('#tabBtnAgro');
        await expect(page.locator('#frostStatus')).toHaveText('Frost');
        await expect(page.locator('#pastRainVal')).toHaveText('14.0 mm');
    });
});

test.describe('Robustness', () => {
    test('offline: shows cached data, recovers when back online', async ({ page, context }) => {
        const api = await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        api.online = false;
        await page.reload();
        await waitForWeather(page);
        await expect(page.locator('#updateTime')).toHaveText(/^Offline – Stand: Heute/);
        await expect(page.locator('#activeAlert')).toHaveClass(/offline/);

        api.online = true;
        await page.evaluate(() => fetchWeatherData());
        await expect(page.locator('#updateTime')).toHaveText(/^Stand: Heute/);
        await expect(page.locator('#activeAlert')).toBeHidden();
    });

    test('offline with stale cache drops past days; too old cache shows an error', async ({ page, context }) => {
        const api = await mockServices(context);
        api.online = false;
        await page.goto('/');

        const saveCache = (data, ageDays) => page.evaluate(([d, age]) => localStorage.setItem('agrarwetter_cache',
            JSON.stringify({ savedAt: Date.now() - age * 86400000, lat: 47.2386, lon: 10.7422, elevation: null, data: d })), [data, ageDays]);

        await saveCache(mockForecast(`${IMST}&forecast_days=7`, { daysAgo: 2 }), 2);
        await page.reload();
        await waitForWeather(page);
        await expect(page.locator('#forecastRow-0 .day-name')).toHaveText('Heute');
        await expect(page.locator('.forecast-day-row')).toHaveCount(5);

        await saveCache(mockForecast(`${IMST}&forecast_days=7`, { daysAgo: 8 }), 8);
        await page.reload();
        await expect(page.locator('#updateTime')).toHaveText('Fehler beim Laden der Live-Daten.');

        await page.evaluate(() => localStorage.setItem('agrarwetter_cache', '{"lat":47.2386,"lon":10.7422,"data":{"broken":true}}'));
        await page.reload();
        await expect(page.locator('#updateTime')).toHaveText('Fehler beim Laden der Live-Daten.');
    });

    test('works without the CDN libraries', async ({ page, context }) => {
        const problems = collectProblems(page);
        await mockServices(context, { cdn: false });
        await page.goto('/');
        await waitForWeather(page);

        await expect(page.locator('.chart-fallback')).toHaveCount(2);
        await expect(page.locator('#planMow .plan-main')).not.toHaveText('--');
        expect(problems.filter(p => p.startsWith('pageerror'))).toEqual([]);
    });
});

test.describe('Security', () => {
    test('CSP blocks injected inline script and event handlers', async ({ page, context }) => {
        await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        await page.evaluate(() => {
            const div = document.createElement('div');
            div.innerHTML = '<img src="x" onerror="window.pwnedHandler = true">';
            document.body.appendChild(div);
            const script = document.createElement('script');
            script.textContent = 'window.pwnedScript = true';
            document.body.appendChild(script);
        });
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => [Boolean(window.pwnedHandler), Boolean(window.pwnedScript)])).toEqual([false, false]);
    });

    test('tampered cache values cannot inject markup', async ({ page, context }) => {
        const api = await mockServices(context);
        api.online = false;
        await page.goto('/');

        const data = mockForecast(`${IMST}&forecast_days=7`);
        data.daily.precipitation_probability_max[0] = '<img src=x id=injected>';
        data.hourly.relative_humidity_2m.fill('<img src=x id=injected2>');
        await page.evaluate(d => localStorage.setItem('agrarwetter_cache',
            JSON.stringify({ savedAt: Date.now(), lat: 47.2386, lon: 10.7422, elevation: null, data: d })), data);
        await page.reload();
        await waitForWeather(page);
        await expect(page.locator('#injected, #injected2')).toHaveCount(0);
    });

    test('saved fields: name as text, elevation sent to the API, validated storage', async ({ page, context }) => {
        const api = await mockServices(context);
        await page.goto('/');
        await waitForWeather(page);

        await page.click('#saveFieldBtn');
        await expect(page.locator('#fieldElevation')).toHaveValue('828');
        await page.fill('#fieldName', '<img src=x id=fieldxss> Bergwiese');
        await page.fill('#fieldElevation', '1450');
        await page.click('#fieldForm button[type=submit]');

        await expect(page.locator('#fieldsGroup option')).toHaveText('<img src=x id=fieldxss> Bergwiese (1450m)');
        await expect(page.locator('#fieldxss')).toHaveCount(0);
        await expect.poll(() => api.lastUrl.searchParams.get('elevation')).toBe('1450');

        await page.reload();
        await waitForWeather(page);
        await expect(page.locator('#locationSelect')).toHaveValue(/^field:/);
        expect(api.lastUrl.searchParams.get('elevation')).toBe('1450');

        page.once('dialog', dialog => dialog.accept());
        await page.click('#deleteFieldBtn');
        await expect(page.locator('#locationSelect')).toHaveValue('imst');
        await expect(page.locator('#fieldsGroup option')).toHaveCount(0);

        await page.evaluate(() => localStorage.setItem('agrarwetter_fields',
            '[{"id":"a","name":"ok","lat":47,"lon":10,"elevation":null},{"id":"b","name":5},"junk",{"id":"c","name":"x","lat":"1","lon":1,"elevation":null}]'));
        await page.reload();
        await expect(page.locator('#fieldsGroup option')).toHaveText(['ok']);
    });
});

test.describe('UI', () => {
    test('theme toggle cycles and persists', async ({ page, context }) => {
        await mockServices(context);
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        await waitForWeather(page);

        const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
        expect(await theme()).toBe('dark');
        await page.click('#themeBtn');
        expect(await theme()).toBe('light');
        await page.click('#themeBtn');
        await page.click('#themeBtn');
        expect(await theme()).toBe('contrast');
        await page.reload();
        expect(await theme()).toBe('contrast');
    });

    test('phone layout: bottom tab bar, no horizontal scrolling', async ({ page, context }) => {
        await mockServices(context);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await waitForWeather(page);

        const layout = await page.evaluate(() => ({
            navBottom: document.querySelector('.tab-navigation').getBoundingClientRect().bottom,
            scrollWidth: document.documentElement.scrollWidth
        }));
        expect(layout.navBottom).toBe(844);
        expect(layout.scrollWidth).toBe(390);

        await page.click('#tabBtnAgro');
        await expect(page.locator('#tabContentAgro')).toBeVisible();
    });
});
