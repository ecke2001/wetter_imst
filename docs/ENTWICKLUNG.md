# Entwicklerhandbuch – AgrarWetter Imst

Dieses Dokument erklärt, wie die App aufgebaut ist und wie man sie weiterentwickelt, testet und veröffentlicht.
Für einen schnellen Überblick siehe [README](../README.md), für geplante Erweiterungen [plan.md](../plan.md),
für bisherige Änderungen [CHANGELOG.md](../CHANGELOG.md).

## Links

| Was | Wo |
|---|---|
| Live-App (Hugging Face Space) | https://huggingface.co/spaces/ecke1985/wetter_imst |
| Direkte App-Adresse (ohne Space-Rahmen, gut als Handy-Lesezeichen) | https://ecke1985-wetter-imst.static.hf.space |
| Quellcode | https://github.com/ecke2001/wetter_imst |
| CI- und Deploy-Läufe | https://github.com/ecke2001/wetter_imst/actions |
| Secrets (HF_TOKEN) | https://github.com/ecke2001/wetter_imst/settings/secrets/actions |

## Projektstruktur

| Datei / Ordner | Inhalt |
|---|---|
| `index.html` | Gesamtes Markup inkl. Content-Security-Policy, Tabs, Dialog „Feld speichern“ |
| `index.css` | Alle Styles; Farben als CSS-Variablen (Dunkel, Hell, Hoher Kontrast); Handy-Layout ab 600 px |
| `app.js` | Gesamte App-Logik (globale Funktionen, keine Module, kein Build) |
| `theme-init.js` | Setzt das Farbschema vor dem ersten Rendern (verhindert Aufblitzen) |
| `icon.svg` | Favicon |
| `tests/` | Playwright-Smoke-Tests mit simulierten Wetterdaten (`mock-weather.js`, `helpers.js`, `app.spec.js`) |
| `.github/workflows/ci.yml` | CI: Lint + Tests bei jedem PR; auf `main` danach automatisches Deployment |
| `.github/scripts/deploy_hf_space.py` | Lädt die App in den Hugging Face Space |
| `package.json` | Nur Entwicklungswerkzeuge (Lint, Tests) – die App selbst hat keine Abhängigkeiten |
| `eslint.config.mjs`, `.htmlvalidate.json`, `.stylelintrc.json`, `playwright.config.js` | Konfiguration von Lint und Tests |
| `CLAUDE.md` | Hinweise für Claude Code (KI-Assistent) |

## Arbeitsablauf

1. Neuen Branch von `main` anlegen (Claude Code macht das automatisch).
2. Änderungen umsetzen, lokal `npm run lint` und `npm test` ausführen.
3. Pull Request gegen `main` öffnen → CI prüft Lint und Tests.
4. Wenn CI grün ist: mergen mit **„Rebase and merge“** (die Historie von `main` ist linear, ohne Merge-Commits).
5. Nach dem Merge läuft CI auf `main` erneut und veröffentlicht die App automatisch im Hugging Face Space.
6. Änderung kurz in [CHANGELOG.md](../CHANGELOG.md) eintragen (im selben PR).

## Lokal starten, Lint und Tests

Voraussetzungen: Python 3 (für den lokalen Webserver), Node.js 22 (nur für Lint und Tests).

```bash
python3 -m http.server 8000            # App starten → http://localhost:8000
npm ci                                 # Entwicklungswerkzeuge installieren
npm run lint                           # ESLint (JS), html-validate (HTML), Stylelint (CSS)
npm test                               # alle Playwright-Tests
npx playwright test -g "offline"       # einzelnen Test nach Namen ausführen
npx playwright install chromium        # einmalig nötig, falls Playwright keinen Browser findet
```

Die Tests brauchen **kein Internet**: Open-Meteo, Windy und Google Fonts werden simuliert, die CDN-Bibliotheken
kommen aus `node_modules`. Deshalb funktionieren sie auch in Umgebungen, in denen diese Dienste gesperrt sind.

## Architektur und Datenfluss

1. **Start** (`DOMContentLoaded` in `app.js`): Farbschema anwenden, Ereignisse binden (`bindEvents`),
   letzten Standort wiederherstellen (`restoreLocation`), Radar vorbereiten, Wetter laden.
2. **Laden** (`fetchWeatherData`): eine einzige Anfrage an Open-Meteo mit aktuellen, stündlichen und täglichen Werten,
   7 Tagen Vergangenheit (`past_days`) und 14 Tagen Vorhersage (`forecast_days`), optional mit Feldhöhe (`elevation`).
   Die Antwort wird als Offline-Kopie gespeichert.
3. **Offline** (`showCachedOrError`): Schlägt die Anfrage fehl, wird die gespeicherte Kopie für denselben Standort angezeigt
   („Offline – Stand: …“). Ist sie unbrauchbar oder zu alt, erscheint eine Fehlermeldung.
4. **Darstellen** (`renderWeather`): summiert den Regen der letzten 7 Tage, entfernt vergangene Tage (Tag 0 ist immer heute),
   bestimmt die **aktuelle Stunde** und verteilt die Daten an alle Anzeigen:
   aktuelles Wetter, Indizes, „Heute am Hof“, 14-Tage-Vorhersage, Boden & Gesundheit, Diagramme.

**Wichtig – Stundenindex:** Die stündlichen Arrays von Open-Meteo beginnen um 00:00 Uhr von Tag 0, nicht „jetzt“.
Alles, was „ab jetzt“ oder „aktuell“ betrifft, muss bei `currentHourIdx` beginnen (wird von `getCurrentHourIndex`
berechnet). Tagesbezogene Logik nutzt `dayIndex * 24`. Dieser Fehler war früher in der App und ist durch einen Test abgesichert.

## Agrar-Logik (Kurzreferenz)

| Anzeige | Funktion(en) | Kernregeln |
|---|---|---|
| Heuwetter-Index | `calculateHeuIndex`, `heuRainScore` | 3-Tage-Fenster; ≥ 1 mm Regen oder ≥ 35 % Regenwahrscheinlichkeit an einem Tag → 0 %. Sonst Mischung aus Regen-Score und Trocknung (ET₀, Sonne, Temperatur, Wind). |
| Begründung „Heuen: Nein (Regen So)“ | `findHeuRainDay` | Erster Tag im 3-Tage-Fenster mit Regen-Score 0 |
| Spritzwetter-Index | `calculateSpritzIndex`, `sprayHourScore` | Mittel der nächsten 12 Stunden; Regen (> 0,1 mm) in der Stunde oder den 3 Stunden danach → 0; Wind > 15 km/h oder Böen > 25 km/h → 0; ideal 10–20 °C |
| Spritzfenster („Heute am Hof“) | `findSprayWindows` | Nächste 36 h, 05–21 Uhr, Stunden-Score ≥ 70, mindestens 2 Stunden am Stück |
| Gülle-Index | `calculateGuelleIndex` | Leichter Regen (0,5–5 mm) ideal; > 10 mm schlecht (Abschwemmung); kühl, bedeckt, wenig Wind günstig |
| Nächster Mähtag / Gülle-Tag | `pickPlanDay` | Frühester Tag der nächsten 7 mit Heu ≥ 70 % bzw. Gülle ≥ 60 %, sonst der beste; heute nur bis 11 Uhr als Mähtag |
| Heu-Trocknungsuhr | `simulateHayDrying` | Ab 08:00 (heute ab jetzt) stündliche ET₀ aufsummieren bis 10 mm; Regen > 0,2 mm/h unterbricht |
| Warnungen | `updateFarmPlanner`, `findFrost` | Frost (Luft ≤ 0 °C) / Bodenfrost (Boden ≤ 0 °C oder Luft ≤ 2 °C) in 48 h; Böen > 60 km/h in 24 h; Gewitter oder ≥ 20 mm Regen in 3 Tagen |
| Bienenflug | `calculateAgroHealthIndices` | 06–18 Uhr der nächsten 24 h; voll ab 18 °C, Wind < 10 km/h, kein Regen |
| Apfelschorf | `calculateAgroHealthIndices` | Längste Blattnässe-Phase (rel. Feuchte ≥ 85 %) im Verhältnis zur temperaturabhängig nötigen Dauer |
| Kraut- und Knollenfäule | `calculateAgroHealthIndices` | Stunden mit ≥ 90 % Feuchte bei 10–24 °C; 12 Stunden = 100 % |

Achtung: Die Index-Funktionen werden von mehreren Anzeigen genutzt (Übersicht, Vorhersage, „Heute am Hof“).
Eine geänderte Schwelle wirkt überall.

## Gespeicherte Daten im Browser (`localStorage`)

| Schlüssel | Inhalt |
|---|---|
| `agrarwetter_loc` | Gewählter Standort: Gemeinde-Schlüssel (z. B. `imst`), `gps` oder `field:<id>` |
| `agrarwetter_lat`, `agrarwetter_lon` | GPS-Koordinaten (auf ca. 100 m gerundet) |
| `agrarwetter_fields` | „Meine Felder“: Liste mit Name, Koordinaten, optionaler Höhe |
| `agrarwetter_cache` | Letzte Open-Meteo-Antwort für die Offline-Anzeige |
| `agrarwetter_theme` | Farbschema: `auto`, `light`, `dark` oder `contrast` |

Alle gelesenen Werte werden geprüft, weil `localStorage` beliebige Inhalte enthalten kann.

## Externe Dienste

| Dienst | Zweck | Freigabe in der CSP (`index.html`) |
|---|---|---|
| Open-Meteo (`api.open-meteo.com`) | Wetterdaten, kostenlos, ohne Schlüssel | `connect-src` |
| Windy (`embed.windy.com`) | Regenradar im Tab „Regenradar“ | `frame-src` |
| jsDelivr (`cdn.jsdelivr.net`) | Lucide-Icons 0.460.0, Chart.js 4.4.7 (mit SRI-Hash) | `script-src` |
| Google Fonts | Schriftarten Inter und Outfit | `style-src`, `font-src` |

## Sicherheitsregeln (bitte einhalten)

- **Content-Security-Policy** in `index.html`: keine Inline-Skripte, keine `style="…"`-Attribute, nur die oben genannten Dienste.
  Für neue Dienste die CSP erweitern, Styles als CSS-Klassen anlegen (Setzen von `element.style` per JavaScript ist erlaubt).
- **Keine `onclick`-Attribute**: Ereignisse in `bindEvents()` mit `addEventListener` registrieren.
- **innerHTML nur mit sicheren Werten**: Zahlen aus API oder Cache immer über `fmt()` formatieren; Texte von Nutzern
  (z. B. Feldnamen) immer per `textContent` setzen.
- **Subresource Integrity**: CDN-Skripte haben einen `integrity`-Hash. Bei einem Versionswechsel muss er neu berechnet werden
  (siehe unten).
- **Secrets** (z. B. den Hugging Face Token) nie in Code, Commits, Issues oder Chats schreiben – nur als GitHub-Secret.

## Häufige Aufgaben (Rezepte)

### Neue Gemeinde hinzufügen
1. In `app.js` im Objekt `LOCATIONS` einen Eintrag ergänzen (`schluessel: { lat, lon, label: "Name (Höhe m)" }`).
2. In `index.html` im `<select id="locationSelect">` eine `<option value="schluessel">` mit gleichem Schlüssel ergänzen.

### Neuen Index oder neue Kachel in „Heute am Hof“
1. Berechnung als eigene Funktion in `app.js` schreiben; „ab jetzt“-Werte immer ab `currentHourIdx`.
2. Kachel in `index.html` nach dem Muster `<div class="plan-tile" id="planXyz">` anlegen.
3. In `updateFarmPlanner` mit `setPlannerTile('planXyz', 'good' | 'warn' | 'bad', haupttext, untertext)` befüllen.
4. Test in `tests/app.spec.js` ergänzen; die simulierten Daten in `tests/mock-weather.js` bei Bedarf erweitern.

### Neuen Tab hinzufügen
1. Button in `.tab-navigation` (`id="tabBtnXyz"`, `data-tab="xyz"`, Kurz- und Langtext) und Bereich `<section id="tabContentXyz" class="tab-content">`.
2. In `switchTab()` (app.js) einen Zweig für `'xyz'` ergänzen.

### CDN-Bibliothek aktualisieren (z. B. Chart.js)
```bash
npm i -D --save-exact chart.js@NEUE_VERSION
openssl dgst -sha384 -binary node_modules/chart.js/dist/chart.umd.js | openssl base64 -A
```
1. In `index.html` Version in der URL und den `integrity`-Wert (`sha384-<Ausgabe>`) ersetzen.
   Nur Dateien verwenden, die wirklich im npm-Paket liegen (nicht die von jsDelivr erzeugten `.min.js`).
2. In `tests/helpers.js` die Versionsnummer im Pfad anpassen.
3. `npm test` – stimmt der Hash nicht, schlägt der erste Test fehl.

### Neuen externen Dienst einbinden
CSP in `index.html` um die Adresse erweitern (passende Direktive, siehe Tabelle oben) und den Dienst in
`tests/helpers.js` simulieren, damit die Tests ohne Internet laufen.

### Neue App-Datei (z. B. weitere JS-Datei)
In `.github/workflows/ci.yml` im Job `deploy` die Datei in der `cp`-Zeile ergänzen. Sonst schlägt das Deployment fehl,
weil `index.html` auf eine nicht veröffentlichte Datei verweist (das ist Absicht).

## Tests

`tests/app.spec.js` enthält 13 Smoke-Tests: Laden ohne Fehler/CSP-/SRI-Verstöße, aktueller Stundenindex,
„Heute am Hof“ und 14-Tage-Umschaltung, Tastaturbedienung, Frost-/Sturmwarnungen, Offline-Fall (auch alte und kaputte Daten),
fehlendes CDN, Sicherheit (eingeschleuster Code, manipulierter Cache, Feldnamen), gespeicherte Felder, Farbschema, Handy-Layout.

Die simulierten Wetterdaten (`tests/mock-weather.js`) werden relativ zu „jetzt“ erzeugt: trockene Tage, Regen an Tag 3,
2 mm Regen an jedem vergangenen Tag. Optionen: `frost`, `storm`, `daysAgo` (veraltete Daten).

## Deployment und Secrets

- **Automatisch:** Jeder Push auf `main` → Lint + Tests → bei Erfolg Upload in den Space (`.github/scripts/deploy_hf_space.py`).
- **Hochgeladen** werden nur `index.html`, `index.css`, `app.js`, `theme-init.js`, `icon.svg` und `README.md`
  (deren Kopfbereich enthält die Space-Einstellungen `sdk: static`). Alte App-Dateien im Space werden entfernt.
- **Manuell:** Actions → CI → **Run workflow** → Branch `main`.
- **Secret `HF_TOKEN`:** Hugging Face Token mit Schreibrecht (beginnt mit `hf_`). Erneuern: neuen Token auf
  https://huggingface.co/settings/tokens erstellen, unter GitHub → Settings → Secrets and variables → Actions → `HF_TOKEN` → **Update**
  eintragen, alten Token bei Hugging Face löschen.
- **Variable `HF_SPACE` (optional):** anderer Space-Name, z. B. `benutzer/agrarwetter-imst`. Ohne sie: `<Token-Besitzer>/wetter_imst`.

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| Deploy: „Hugging Face rejected HF_TOKEN (HTTP 401/403)“ | Token ungültig, abgelaufen oder ohne Schreibrecht → neuen Token als Secret eintragen |
| Deploy: „HF_TOKEN does not look like a Hugging Face access token“ | Secret enthält keinen `hf_…`-Token |
| Deploy: Warnung „HF_TOKEN secret is not set“ | Secret fehlt; der Upload wird übersprungen, CI bleibt grün |
| Deploy: „No files have been modified since last commit“ | Kein Fehler: Der Space ist bereits aktuell |
| Deploy: „index.html references X, which is not deployed“ | Neue Datei in der `cp`-Zeile in `ci.yml` ergänzen |
| Icons oder Diagramme fehlen live | SRI-Hash passt nicht zur CDN-Datei oder CDN nicht erreichbar → Hash neu berechnen (Rezept oben); die App funktioniert trotzdem |
| „Fehler beim Laden der Live-Daten“ | Open-Meteo nicht erreichbar und keine passende Offline-Kopie |
| Test „hourly views start at the current hour“ schlägt fehl | Stundenindex-Logik verändert – siehe Abschnitt „Stundenindex“ |
| In der Claude-Code-Cloud-Umgebung keine Live-Prüfung möglich | Netzwerk blockiert Open-Meteo, jsDelivr und Hugging Face. Tests laufen trotzdem (simuliert). Für Live-Prüfungen die Domains in den Umgebungseinstellungen unter „Network access“ freigeben. |

## Bekannte Einschränkungen

- Google Fonts kann keinen SRI-Hash haben (liefert je nach Browser unterschiedliches CSS).
- Offizielle Unwetterwarnungen (GeoSphere Austria) sind noch nicht eingebunden – siehe [plan.md](../plan.md).
- Bewusst kein Service Worker / keine PWA-Installation; Offline-Anzeige nur über `localStorage`.
