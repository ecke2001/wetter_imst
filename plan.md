# Entwicklungsplan: Zukünftige Erweiterungen (AgrarWetter Imst)

Hier sind potenzielle Erweiterungen und Verbesserungen für die AgrarWetter-App aufgelistet. Diese Schritte können in zukünftigen Sprints implementiert werden, um die App noch wertvoller für die landwirtschaftliche Praxis im Bezirk Imst zu machen.

---

## 1. Lokalisierung & Stationsauswahl
*   **Gemeindeauswahl:** Statt der festen Koordinaten für Imst-Stadt soll ein Dropdown-Menü oder eine Suchleiste integriert werden, um das Wetter für alle Gemeinden im Bezirk Imst (z. B. Tarrenz, Karres, Roppen, Nassereith, Silz, Längenfeld, Sölden) abzufragen.
*   **GPS-Ortung:** Ein Button zur automatischen Ermittlung der aktuellen GPS-Koordinaten auf dem Feld.
*   **Bodenhöhen-Korrektur:** Anpassung der Vorhersage an die genaue Höhe der Alm- oder Talwiese, da im alpinen Gelände oft wenige hundert Höhenmeter über Frost oder Taupunkt entscheiden.

## 2. Erweiterte Boden- & Aussaatparameter
*   **Bodenfeuchte in verschiedenen Tiefen:** Visualisierung der Bodenfeuchte (0-7 cm für Keimung, 7-28 cm für Wurzeln) aus den Open-Meteo-Agrardaten.
*   **Bodentemperatur-Trend:** Anzeige der Bodentemperatur, um den idealen Zeitpunkt für die Aussaat von Mais, Kartoffeln oder Getreide zu ermitteln (z. B. Keimtemperatur-Schwellenwerte).
*   **Bodenfrost-Warnung:** Warnung vor Spätfrost im Frühjahr auf Bodenhöhe (wichtig für Obstbauern im Inntal).

## 3. Krankheits- & Schädlingsprognosen
*   **Pflanzenschutz-Prognosemodelle:** Berechnung von Infektionsrisiken basierend auf Blattnässestunden und Temperatur:
    *   *Kraut- und Knollenfäule* bei Kartoffeln.
    *   *Apfelschorf* oder *Echter Mehltau* im Obstbau.
*   **Bienenflug-Index:** Ein Index, der bewertet, ob Wind, Temperatur und Niederschlag den Bienenflug und somit die Bestäubung begünstigen (wichtig für Obstplantagen).

## 4. Offline-Modus & App-Installation (PWA)
*   **Progressive Web App (PWA) Conversion:** Umwandlung der Anwendung in eine PWA:
    *   Hinzufügen eines `manifest.json` und eines Service-Workers.
    *   Ermöglicht die Installation der App auf dem Handy-Startbildschirm ohne App Store.
    *   **Offline-Caching:** Die zuletzt geladenen Wetterdaten bleiben auf dem Feld auch ohne Mobilfunknetz abrufbar.

## 5. Live-Messwerte der Tiroler Landesstationen
*   **Schnittstelle zu Hydro Online:** Direkte Einbindung der Live-Daten der nächstgelegenen hydrografischen Stationen des Landes Tirol (z. B. Pegelstände, Bodensensoren) direkt in der App, statt nur extern zu verlinken.

## 6. Heutrocknungs-Simulation (Heu-Trocknungsuhr)
*   **Trocknungsverlauf-Schätzung:** Ein interaktives Tool, das abschätzt, wie viele Stunden gemähtes Gras bei der aktuellen Wetterlage benötigt, um die kritische Grenze von unter 18% Restfeuchte zu erreichen. Dies kombiniert die stündliche Evapotranspiration, Wind und relative Luftfeuchtigkeit zu einer prognostizierten Trocknungskurve.
