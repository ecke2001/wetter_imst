# Änderungsprotokoll

Neueste Änderungen oben. Bitte bei jeder Änderung einen kurzen Eintrag ergänzen (im selben Pull Request).

## 2026-10-08

### Deployment
- Automatisches Deployment in den Hugging Face Space nach jedem Push auf `main`, nur wenn Lint und Tests bestehen
  ([PR #2](https://github.com/ecke2001/wetter_imst/pull/2)). Live: https://huggingface.co/spaces/ecke1985/wetter_imst
- Verständliche Fehlermeldungen bei ungültigem `HF_TOKEN`; CI-Actions auf Node.js 24 aktualisiert; CI-Runner auf
  Ubuntu 24.04 festgelegt ([PR #3](https://github.com/ecke2001/wetter_imst/pull/3)).

### Werkzeuge
- Lint (`npm run lint`: ESLint, html-validate, Stylelint) und 13 Playwright-Smoke-Tests (`npm test`) mit simulierten
  Wetterdaten; GitHub-Actions-Workflow für jeden Pull Request ([PR #1](https://github.com/ecke2001/wetter_imst/pull/1)).

### Neue Funktionen ([PR #1](https://github.com/ecke2001/wetter_imst/pull/1))
- **„Heute am Hof“:** Spritzfenster mit Uhrzeit, nächster Mähtag mit Trocknungsuhr, nächster Gülle-Tag,
  Warnungen vor Frost, Sturmböen, Starkregen und Gewitter.
- **14-Tage-Vorhersage** (Tage 8–14 aufklappbar); „Heuen: Nein“ nennt den Regentag (z. B. „Regen So“).
- **Boden & Gesundheit:** Regen der letzten 7 Tage, Luft-/Bodenfrost der nächsten 48 Stunden.
- **„Meine Felder“:** Standorte mit Namen und optionaler Höhe speichern; die Höhe wird an Open-Meteo übergeben.
- **Farbschema:** Automatisch, Hell, Dunkel, Hoher Kontrast (für Sonnenlicht).
- **Offline-Anzeige:** Letzte Daten aus `localStorage` mit Hinweis „Offline – Stand: …“ (ohne Service Worker).
- **Handy-Layout:** Tab-Leiste unten, kompakte zweizeilige Vorhersagezeilen; Vorhersage per Tastatur bedienbar.

### Fehlerbehebungen ([PR #1](https://github.com/ecke2001/wetter_imst/pull/1))
- Spritzwetter, Diagramme, Bodenwerte sowie Bienen-/Schorf-/Fäule-Indizes begannen um Mitternacht statt bei der
  aktuellen Stunde (tagsüber wurde die vergangene Nacht bewertet).
- App funktioniert auch, wenn Icons oder Diagramm-Bibliothek nicht vom CDN geladen werden können.
- Rote Fehlermeldung blieb nach erfolgreichem Neuladen sichtbar.
- Stündliche Tabelle wurde auf dem Handy abgeschnitten.
- Apfelschorf: Durchschnittstemperatur der Blattnässe wurde falsch berechnet (konnte sich verdoppeln).
- Heu-Trocknungsuhr begann heute auch nachmittags noch um 08:00 Uhr.

### Sicherheit ([PR #1](https://github.com/ecke2001/wetter_imst/pull/1))
- Content-Security-Policy ohne Inline-Skripte und -Styles; Subresource-Integrity für CDN-Bibliotheken.
- Werte aus API und Offline-Kopie werden vor der Anzeige als Zahlen formatiert; Feldnamen nur als Text eingefügt;
  gespeicherte Daten werden beim Lesen geprüft.
- GPS-Koordinaten werden vor der Weitergabe an Open-Meteo/Windy auf ca. 100 m gerundet.

### Dokumentation
- `CLAUDE.md` (Hinweise für Claude Code), `docs/ENTWICKLUNG.md` (Entwicklerhandbuch), dieses Änderungsprotokoll,
  aktualisierte `plan.md`.

## 2026-06-11 – Erste Version
- Statische Web-App mit Heuwetter-, Spritzwetter- und Gülle-Index, Heu-Trocknungsuhr, Bodendaten,
  Bienenflug/Apfelschorf/Krautfäule, Windy-Regenradar, Chart.js-Diagrammen, 8 Gemeinden und GPS.
- Bewusst ohne Service Worker; Performance-Optimierungen (Resource-Hints, CDN-Pinning).
- Erstes Deployment als Hugging Face Space.
