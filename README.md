---
title: AgrarWetter Imst
emoji: 🚜
colorFrom: green
colorTo: green
sdk: static
pinned: false
---

# AgrarWetter Imst

Eine hochperformante, mobile-optimierte Wetter-App für Landwirte im Raum Imst (Tirol), Österreich. Die App lädt Echtzeit-Wetterprognosen von Open-Meteo und berechnet spezifische landwirtschaftliche Kriterien.

## Features
- **Heute am Hof:** Konkrete Empfehlungen – Spritzfenster mit Uhrzeit, nächster Mähtag, nächster Gülle-Tag sowie Warnungen vor Frost, Sturm, Starkregen und Gewitter.
- **Agrar-Indizes:** Tägliche und stündliche Indizes für Heuwetter, Spritzwetter und Gülle-Wetter.
- **14-Tage-Vorhersage:** Mit Heuwetter-Ampel und Begründung (z. B. „Regen So“).
- **Heutrocknungs-Uhr:** Berechnet die Einfahrbereitschaft für Heu basierend auf der stündlichen Evapotranspiration (ET₀) und Regenunterbrechungen.
- **Bodendaten:** Bodentemperatur (Aussaat/Keimung), Bodenfeuchte, Regen der letzten 7 Tage und Luft-/Bodenfrost der nächsten 48 Stunden.
- **Pflanzengesundheit:** Spezifische Indikatoren für Bienenflug, Apfelschorf-Risiko und Kraut-/Knollenfäule-Risiko.
- **Regenradar:** Integriertes interaktives Windy-Radar zentriert auf Imst (Ressourcenschonend per Lazy-Load).
- **Diagramme:** Stündliche Trends (Temperatur/Taupunkt, Windböen, Regen) visualisiert mit Chart.js.
- **Standorte:** 8 Gemeinden im Bezirk, GPS-Ortung und eigene gespeicherte Felder („Meine Felder“) mit optionaler Höhenangabe für genauere Prognosen im Gebirge.
- **Farbschema:** Automatisch, Hell, Dunkel oder Hoher Kontrast für direktes Sonnenlicht.
- **Offline-Anzeige:** Die zuletzt geladenen Daten werden bei fehlender Verbindung angezeigt (ohne Service Worker, per `localStorage`).

## Architektur & Performance
Diese App ist als statische Web-App (Vanilla JS/HTML/CSS) ohne Frameworks oder Build-Schritte umgesetzt.
- **Keine Service Worker:** Voller Verzicht auf PWA-Caching zur Vermeidung von Lade-Konflikten.
- **Performance:** Aggressives Resource-Hinting (`preconnect`, `dns-prefetch`), CDN-Pinning für Bibliotheken, optimierte DOM-Updates und O(1)-Vorhersagealgorithmen.
- **Sicherheit:** Content-Security-Policy ohne Inline-Skripte/-Styles, Subresource-Integrity für CDN-Bibliotheken, GPS-Koordinaten werden auf ca. 100 m gerundet.

## Lokale Ausführung
Starte einen Webserver im Stammverzeichnis:
```bash
python3 -m http.server 8000
```
Öffne [http://localhost:8000](http://localhost:8000) im Browser.

## Entwicklung
Lint und Browser-Tests (benötigen Node.js; die App selbst braucht keinen Build-Schritt):
```bash
npm ci
npm run lint   # ESLint, html-validate, Stylelint
npm test       # Playwright-Smoke-Tests mit simulierten Wetterdaten
```

## Deployment (Hugging Face Spaces)
Jeder Push auf `main` wird nach erfolgreichem Lint und Tests automatisch in den Hugging Face Space hochgeladen (`.github/workflows/ci.yml`, Job `deploy`). Hochgeladen werden nur die App-Dateien (`index.html`, `index.css`, `app.js`, `theme-init.js`, `icon.svg`) und diese README (Space-Einstellungen im Kopfbereich).

Einmalige Einrichtung:
1. Hugging Face → Settings → Access Tokens: Token mit Schreibrecht erstellen (am besten fine-grained, nur für diesen Space).
2. GitHub → Repository → Settings → Secrets and variables → Actions → **New repository secret**: Name `HF_TOKEN`, Wert = Token.
3. Optional: Repository-Variable `HF_SPACE` (z. B. `benutzer/agrarwetter-imst`). Ohne Angabe wird `<Token-Besitzer>/wetter_imst` verwendet und bei Bedarf angelegt.
4. Actions → CI → **Run workflow** auf `main` (oder nächster Push).
