# Entwicklungsplan (AgrarWetter Imst)

Stand: 2026-10-08. Offene Ideen oben, bereits Umgesetztes unten. Details zur Umsetzung neuer Funktionen:
[docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md) (Abschnitt „Häufige Aufgaben“).

---

## Offen / Ideen

### Hohe Priorität
*   **Offizielle Unwetterwarnungen (GeoSphere Austria):** Warnungen für den Standort direkt in der App anzeigen
    (z. B. in der Kachel „Warnungen“ von „Heute am Hof“). Benötigt die Warn-Schnittstelle von GeoSphere;
    deren Adresse muss in die Content-Security-Policy (`connect-src`) und in die Test-Simulation (`tests/helpers.js`).
    Konnte bisher nicht umgesetzt werden, weil die Schnittstelle aus der Entwicklungsumgebung nicht erreichbar war.
*   **Live-Prüfung mit echten Daten automatisieren:** z. B. ein wöchentlicher Workflow, der die Live-Seite lädt und
    prüft, dass Icons, Diagramme und Wetterdaten erscheinen (erkennt CDN-/SRI- und API-Änderungen früh).

### Mittlere Priorität
*   **Live-Messwerte der Tiroler Landesstationen (Hydro Online):** Pegelstände, Bodensensoren und Stationsdaten
    der nächstgelegenen Station direkt anzeigen statt nur zu verlinken.
*   **Bodenfeuchte in mehreren Tiefen:** 0–7 cm (Keimung) und 7–28 cm (Wurzelraum) aus den Open-Meteo-Agrardaten.
*   **Bodentemperatur-Trend:** Verlauf der nächsten Tage mit Keimtemperatur-Schwellen für Mais, Kartoffeln, Getreide.
*   **Echter Mehltau (Obstbau):** zusätzliches Infektionsmodell analog zu Apfelschorf.
*   **Wettermodell-Vergleich:** Unsicherheit anzeigen, z. B. ICON-D2 vs. ECMWF über den `models`-Parameter von Open-Meteo.

### Niedrige Priorität / Überlegungen
*   **Heutrocknung verfeinern:** Ziel „unter 18 % Restfeuchte“ mit Wind und relativer Luftfeuchte als Trocknungskurve
    (bisher nur Summe der ET₀ bis 10 mm).
*   **Weidegang / Viehtrieb:** Hitze- und Kältestress-Index für Weidetiere (Temperatur, Feuchte, Wind).
*   **PWA / App-Installation:** Bewusst zurückgestellt. Die App entfernt aktiv Service Worker, weil frühere Versionen
    Ladeprobleme verursachten. Offline-Anzeige läuft über `localStorage`. Nur angehen, wenn Installation auf dem
    Startbildschirm ausdrücklich gewünscht ist.

---

## Erledigt

### Lokalisierung & Standorte
*   ✅ Gemeindeauswahl (8 Gemeinden im Bezirk Imst) – Juni 2026
*   ✅ GPS-Ortung (auf ca. 100 m gerundet) – Juni 2026, Oktober 2026 verbessert
*   ✅ Höhen-Korrektur über „Meine Felder“ (gespeicherte Standorte mit Höhe, an Open-Meteo übergeben) – Oktober 2026

### Boden & Aussaat
*   ✅ Bodentemperatur (6 cm) mit Keimungs-Hinweisen, Bodenfeuchte (3–9 cm) – Juni 2026
*   ✅ Regen der letzten 7 Tage – Oktober 2026
*   ✅ Luft- und Bodenfrost-Warnung für 48 Stunden – Oktober 2026

### Krankheiten, Schädlinge, Nützlinge
*   ✅ Kraut- und Knollenfäule, Apfelschorf, Bienenflug-Index – Juni 2026 (Apfelschorf-Berechnung im Oktober 2026 korrigiert)

### Arbeitsplanung
*   ✅ Heuwetter-, Spritzwetter-, Gülle-Index und Heu-Trocknungsuhr – Juni 2026
*   ✅ „Heute am Hof“: Spritzfenster mit Uhrzeit, nächster Mähtag, nächster Gülle-Tag, Warnungen – Oktober 2026
*   ✅ 14-Tage-Vorhersage mit Begründung der Heuwetter-Ampel – Oktober 2026

### Bedienung & Technik
*   ✅ Offline-Anzeige der letzten Daten (ohne Service Worker) – Oktober 2026
*   ✅ Farbschema Hell/Dunkel/Hoher Kontrast, Handy-Layout mit Tab-Leiste unten – Oktober 2026
*   ✅ Sicherheit (CSP, SRI), Lint, automatische Tests, automatisches Deployment – Oktober 2026
