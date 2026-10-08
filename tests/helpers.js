import { fileURLToPath } from 'node:url';
import { mockForecast } from './mock-weather.js';

const nodeModules = fileURLToPath(new URL('../node_modules/', import.meta.url));

// CDN files are served from the exact npm versions pinned in package.json, so the
// browser's SRI check verifies the integrity hashes in index.html.
const CDN_FILES = {
    'lucide@0.460.0/dist/umd/lucide.min.js': `${nodeModules}lucide/dist/umd/lucide.min.js`,
    'chart.js@4.4.7/dist/chart.umd.js': `${nodeModules}chart.js/dist/chart.umd.js`
};

/**
 * Mock all external services. Returns a control object to switch the weather API
 * between online/offline and to inspect the last request URL.
 */
export async function mockServices(context, { cdn = true, weather = {} } = {}) {
    const api = { online: true, lastUrl: null, weather };

    await context.route('https://cdn.jsdelivr.net/npm/**', route => {
        const file = CDN_FILES[route.request().url().split('/npm/')[1]];
        return cdn && file ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.abort();
    });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await context.route('https://embed.windy.com/**', route => route.fulfill({ body: '<!doctype html><title>radar</title>', contentType: 'text/html' }));
    await context.route('https://api.open-meteo.com/**', route => {
        api.lastUrl = new URL(route.request().url());
        return api.online ? route.fulfill({ json: mockForecast(api.lastUrl.href, api.weather) }) : route.abort();
    });
    return api;
}

/**
 * Collect uncaught page errors and CSP / SRI violations reported on the console.
 */
export function collectProblems(page) {
    const problems = [];
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    page.on('console', msg => {
        if (/Content Security Policy|integrity/i.test(msg.text())) problems.push(`console: ${msg.text()}`);
    });
    return problems;
}

/** Wait until the forecast has been rendered */
export async function waitForWeather(page) {
    await page.waitForFunction(() => document.querySelectorAll('.forecast-day-row').length > 0);
}
