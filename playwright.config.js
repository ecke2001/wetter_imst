import { defineConfig, devices } from '@playwright/test';

// Smoke tests run against the static files with all external services mocked
// (see tests/helpers.js), so they need no network access.
export default defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://localhost:8765',
        ...devices['Desktop Chrome']
    },
    webServer: {
        command: 'python3 -m http.server 8765',
        url: 'http://localhost:8765',
        reuseExistingServer: !process.env.CI
    }
});
