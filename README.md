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
- **Agrar-Indizes:** Tägliche und stündliche Indizes für Heuwetter, Spritzwetter und Gülle-Wetter.
- **Heutrocknungs-Uhr:** Berechnet die Einfahrbereitschaft für Heu basierend auf der stündlichen Evapotranspiration (ET₀) und Regenunterbrechungen.
- **Bodendaten:** Sensor-Messwerte für Bodentemperatur (Aussaat/Keimung) und Bodenfeuchte (Dürrewarnungen).
- **Pflanzengesundheit:** Spezifische Indikatoren für Bienenflug, Apfelschorf-Risiko und Kraut-/Knollenfäule-Risiko.
- **Regenradar:** Integriertes interaktives Windy-Radar zentriert auf Imst (Ressourcenschonend per Lazy-Load).
- **Diagramme:** Stündliche Trends (Temperatur/Taupunkt, Windböen, Regen) visualisiert mit Chart.js.
- **Standort-Fallback:** Nutzt standardmäßig Imst, unterstützt aber auch dynamisches GPS oder die Auswahl von 8 Gemeinden im Bezirk.

## Architektur & Performance
Diese App ist als statische Web-App (Vanilla JS/HTML/CSS) ohne Frameworks oder Build-Schritte umgesetzt.
- **Keine Service Worker:** Voller Verzicht auf PWA-Caching zur Vermeidung von Lade-Konflikten.
- **Performance:** Aggressives Resource-Hinting (`preconnect`, `dns-prefetch`), CDN-Pinning für Bibliotheken, optimierte DOM-Updates und O(1)-Vorhersagealgorithmen.

## Lokale Ausführung
Starte einen Webserver im Stammverzeichnis:
```bash
python3 -m http.server 8000
```
Öffne [http://localhost:8000](http://localhost:8000) im Browser.
