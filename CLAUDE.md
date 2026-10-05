# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AgrarWetter Imst: a static, German-language weather app for farmers in the Imst district (Tirol). Plain HTML/CSS/vanilla JS with no framework, no build step, no package manager, no tests and no linter. UI text and code comments are German/English mixed; keep user-facing strings in German.

## Running

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There is no test or lint command. Verify changes by loading the page in a browser (Chromium/Playwright is available in the cloud environment).

## Architecture

Everything lives in three files: `index.html` (markup, tabs, inline `onclick` handlers), `index.css`, and `app.js` (~1300 lines, global-scope functions, no modules). External libraries (Lucide icons, Chart.js) are CDN-pinned `defer` scripts in `index.html`; `lucide.createIcons()` must be re-called after any DOM update that injects `<i data-lucide>` elements.

Data flow in `app.js`:
1. `DOMContentLoaded` restores the location from `localStorage` (`agrarwetter_loc` for a preset key, or `agrarwetter_lat`/`agrarwetter_lon` for GPS), then calls `initRadar()` and `fetchWeatherData()`.
2. `fetchWeatherData()` makes a single Open-Meteo forecast request (current + hourly + daily; the variable list is one long URL string) and stores the result in the global `weatherData`.
3. The response is fanned out to renderers: `updateCurrentWeather`, `calculateAllIndices` → `updateIndicesUI`, `updateForecastUI` (daily accordion + `generateHourlyRowsForDay`), `updateSoilHealthUI` (includes `calculateAgroHealthIndices`: bees, apple scab, potato blight), and `renderCharts` (Chart.js instances kept in globals so they can be destroyed/re-created).
4. Agronomic logic: `calculateHeuIndex`, `calculateSpritzIndex`, `calculateGuelleIndex`, and `simulateHayDrying` (hay-drying clock based on hourly ET₀ and rain interruptions) operate on the Open-Meteo `daily`/`hourly` arrays indexed by hour/day offset.

Locations: the `LOCATIONS` map at the top of `app.js` holds the 8 district municipalities (keys must match `<option value>` in `#locationSelect` in `index.html`). GPS adds a dynamic `gps` option labelled via `findNearestLocation`. `handleLocationChange` / `requestGPSLocation` update state and refetch.

Tabs are switched by `switchTab(name)`; the Windy radar iframe is lazy-loaded (`initRadar`) to save resources.

## Constraints

- No service workers/PWA caching, deliberately: `app.js` actively unregisters existing service workers and clears caches on load. Don't add them (`plan.md` lists PWA as a future idea, but the README states the current stance).
- Keep it build-free; add libraries only via pinned CDN URLs and consider the preconnect/dns-prefetch hints in `index.html`.
- `plan.md` is the (German) roadmap of possible extensions; `README.md` has Hugging Face Spaces front matter (`sdk: static`) that must stay at the top.
