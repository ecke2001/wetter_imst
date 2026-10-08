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

**Live:** [Hugging Face Space](https://huggingface.co/spaces/ecke1985/wetter_imst) · [direkte App-Adresse](https://ecke1985-wetter-imst.static.hf.space) · **Code:** [GitHub](https://github.com/ecke2001/wetter_imst)

## Dokumentation
- [Entwicklerhandbuch](https://github.com/ecke2001/wetter_imst/blob/main/docs/ENTWICKLUNG.md) – Aufbau, Arbeitsablauf, Agrar-Logik, Rezepte für häufige Änderungen, Tests, Deployment, Fehlerbehebung
- [Entwicklungsplan](https://github.com/ecke2001/wetter_imst/blob/main/plan.md) – offene Ideen und bereits Umgesetztes
- [Änderungsprotokoll](https://github.com/ecke2001/wetter_imst/blob/main/CHANGELOG.md) – was wann geändert wurde
- [CLAUDE.md](https://github.com/ecke2001/wetter_imst/blob/main/CLAUDE.md) – Hinweise für den KI-Assistenten Claude Code

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

Benötigt wird das GitHub-Secret `HF_TOKEN` (Hugging Face Token mit Schreibrecht, beginnt mit `hf_`). Einrichtung, Token-Erneuerung und Fehlerbehebung: siehe [Entwicklerhandbuch – Deployment](https://github.com/ecke2001/wetter_imst/blob/main/docs/ENTWICKLUNG.md#deployment-und-secrets).
