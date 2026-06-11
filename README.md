---
title: AgrarWetter Imst
emoji: 🚜
colorFrom: green
colorTo: green
sdk: static
pinned: false
---

# AgrarWetter Imst

Eine mobile-optimierte Wetter-App für Landwirte im Raum Imst (Tirol), Österreich. Die App lädt Echtzeit-Wetterprognosen von Open-Meteo und berechnet landwirtschaftliche Kriterien wie Heuwetter, Spritzwetter und Gülle-Wetter.

## Features
- **Heuwetter-Index:** Zeigt die Eignung der nächsten 3 Tage zum Heuen (0-100%).
- **Spritzwetter-Index:** Zeigt stündliche Sprüh-Eignung für Pflanzenschutz.
- **Gülle-Wetter-Index:** Optimaler Düngezeitpunkt (Einsickern der Nährstoffe).
- **Regenradar:** Integriertes interaktives Windy-Radar zentriert auf Imst.
- **Diagramme:** Stündliche Trends (Temperatur/Taupunkt, Windböen, Regen).
- **Agrar-Links:** Direkte Links zu offiziellen Quellen wie LK Tirol, GeoSphere Austria, Kachelmannwetter, Hydro Online.

## Lokale Ausführung
Starte einen Webserver im Stammverzeichnis:
```bash
python3 -m http.server 8000
```
Öffne [http://localhost:8000](http://localhost:8000) im Browser.
