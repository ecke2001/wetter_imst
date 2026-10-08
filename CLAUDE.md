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

The app is `index.html` (markup), `index.css`, `app.js` (global-scope functions, no modules) and the tiny `theme-init.js`. All event handlers are bound in `bindEvents()` via `addEventListener` (no inline `onclick`; forecast rows use delegation on `#forecastList`). External libraries (Lucide icons, Chart.js) are CDN-pinned `defer` scripts with SRI hashes; call `refreshIcons()` after any DOM update that injects `<i data-lucide>` elements.

Data flow in `app.js`:
1. `DOMContentLoaded` applies the theme, binds events, `restoreLocation()`s, then calls `initRadar()` and `fetchWeatherData()`.
2. `fetchWeatherData()` makes a single Open-Meteo forecast request (current + hourly + daily, `past_days=7`, `forecast_days=14`, optional `elevation`), saves it to the `localStorage` offline cache (`agrarwetter_cache`) and calls `renderWeather()`. On network failure `showCachedOrError()` renders the cached response for the same coordinates instead.
3. `renderWeather()` sums the rain of the past days, then drops them (so day 0 is always today, also for old cache), sets the globals `weatherData` and `currentHourIdx`, and fans out to renderers: `updateCurrentWeather`, `calculateAllIndices` → `updateIndicesUI`, `updateForecastUI` (14-day accordion, days 8-14 behind a toggle), `updateFarmPlanner` ("Heute am Hof" tiles: spray windows, next mowing/slurry day, warnings), `updateSoilHealthUI` (soil, past rain, frost, `calculateAgroHealthIndices`), and `renderCharts` (Chart.js instances kept in globals so they can be destroyed/re-created).
4. Agronomic logic: `calculateHeuIndex`, `calculateSpritzIndex`, `calculateGuelleIndex`, and `simulateHayDrying` (hay-drying clock based on hourly ET₀ and rain interruptions) operate on the Open-Meteo `daily`/`hourly` arrays indexed by hour/day offset.

Time indexing: Open-Meteo's hourly arrays start at 00:00 of day 0, so hourly index 0 is *not* "now". Anything about "the next N hours" or "current" values must start at `currentHourIdx` (from `getCurrentHourIndex`, using the API's `utc_offset_seconds`); day-based logic uses `dayIndex * 24`.

Locations: the `LOCATIONS` map at the top of `app.js` holds the 8 district municipalities (keys must match `<option value>` in `#locationSelect` in `index.html`). Location keys are a preset key, `gps`, or `field:<id>` for saved fields ("Meine Felder", `agrarwetter_fields`, with optional elevation). Every switch goes through `setLocation()`, which persists, rebuilds the dynamic dropdown entries (`renderLocationOptions`) and refetches.

Tabs: `switchTab(name)` is a hard-coded if/else chain over element ids (`tabBtn<Name>` / `tabContent<Name>`, active class `active-content`). A new tab needs a branch there plus matching markup in `index.html`.

Radar: the Windy iframe `src` is only set when the radar tab is active (or `force`), and only if the coordinates changed since the last load (`radarLoadedLat/Lon`). Location changes call `initRadar()` so a stale map isn't shown.

Indices: the heu/spritz/gülle indices on the dashboard are computed for day 0 / the next 12 hours (`calculateAllIndices`); the forecast accordion and `simulateHayDrying(dayIndex, …)` reuse the same calculators for other days. Changing a threshold in one of them affects every view that calls it.

Theming: all colors are CSS variables on `:root` (dark default) with overrides for `[data-theme="light"]` and `[data-theme="contrast"]`; don't hard-code colors in new CSS. `theme-init.js` (loaded synchronously in `<head>`) sets `data-theme` before first paint, `applyTheme`/`cycleTheme` in `app.js` handle the toggle (preference `auto|light|dark|contrast` in `agrarwetter_theme`). Chart.js colors are read from `--chart-*` variables, so charts are re-rendered on theme change.

## Constraints

- No service workers/PWA caching, deliberately: `app.js` actively unregisters existing service workers and clears caches on load. Don't add them (`plan.md` lists PWA as a future idea, but the README states the current stance).
- Security: `index.html` has a strict Content-Security-Policy meta tag (no inline script, no inline styles, only the hosts in use). New external hosts must be added there; use CSS classes instead of `style=""` attributes (setting `element.style.x` from JS is fine). Bumping a CDN library version requires a new `integrity` hash (sha384 of the exact file jsDelivr serves; use files that exist in the npm package, not jsDelivr's generated `.min.js`).
- Values from the API, cache or user input that go into `innerHTML` templates must be numbers formatted with `fmt()` or constants; anything user-entered (field names) is set via `textContent`.
- CDN scripts may fail to load: call `refreshIcons()` instead of `lucide.createIcons()`, and `renderCharts` falls back to a message when `Chart` is undefined.
- Keep it build-free; add libraries only via pinned CDN URLs and consider the preconnect/dns-prefetch hints in `index.html`.
- `plan.md` is the (German) roadmap of possible extensions; `README.md` has Hugging Face Spaces front matter (`sdk: static`) that must stay at the top.
