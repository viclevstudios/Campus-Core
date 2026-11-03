# Campus Core

Responsive Web-App zur Planung der 70-%-Anwesenheitspflicht und zum Abruf von Mensa-Wochenplänen. Vanilla JavaScript, CSS und lokal mitgeliefertes `ical.js`; kein Backend, kein Account. Nur der Mensabereich ruft externe Speisepläne von OpenMensa ab. Kein ChatGPT Sites.

Die Oberfläche verwendet ein schlichtes Blau, sachliche Beschriftungen und einen umschaltbaren Hell-/Dunkelmodus. Ohne gespeicherte Auswahl wird die Systemeinstellung übernommen. Die Auswahl wird unter `campusplan.theme` lokal gespeichert und bleibt auch nach einem Neuladen erhalten. Für bestehende Kalender bleibt der bisherige Speicherschlüssel `freiraum.v1` aus Kompatibilitätsgründen unverändert.

## Lokal starten

Node.js 22 oder neuer verwenden. Im Projektordner:

```powershell
npm.cmd ci
npm.cmd run dev
```

Die App unter **http://127.0.0.1:5173** öffnen. Der Node-Prozess stellt nur statische Dateien für die Entwicklung bereit. ICS-Dateien werden im Browser eingelesen, niemals an diesen Prozess gesendet. Für einen anderen lokalen Port vor dem Start z. B. `$env:PORT = '8080'` setzen.

## Selbst hosten

```powershell
npm.cmd run build
```

Den **Inhalt von `dist/`** auf einen beliebigen statischen HTTP-/HTTPS-Webserver kopieren. Es ist keine Node-Laufzeit auf dem Hosting nötig. Ein Unterverzeichnis funktioniert ebenfalls; alle Asset-Pfade sind relativ. JavaScript-Dateien als `text/javascript` ausliefern. Nicht per `file://` öffnen: ES-Module und der Kalender-Worker benötigen HTTP/HTTPS. Der Ordner enthält alle benötigten Assets einschließlich Kalenderbibliothek und Lizenz.

## Bedienung

1. Eine `.ics`-Datei auswählen oder in das Importfeld ziehen. Alternativ die ausdrücklich gekennzeichneten Beispieldaten ausprobieren.
2. Semester oder einen eigenen Zeitraum wählen. Beide Datumsgrenzen zählen mit. Semester-Vorschläge beginnen am Montag der Woche, in der der 1. April bzw. 1. Oktober liegt, und enden am Sonntag vor dem nächsten Semester. Winter 2026/27 beginnt am 28.09.2026. Eigene Theoriephasen können frei eingetragen werden.
3. Über die Checkboxen Fächer für die Zusammenfassung auswählen. Bei mehr als acht Zeilen wird eine Suche eingeblendet. Die Summe der Fehltermine ist die Summe der einzelnen Budgets und lässt sich nicht zwischen Fächern übertragen.
4. Unter **Fach aufteilen** das betreffende Fach im Such-/Auswahlfeld wählen und genau zwei Unterfächer benennen, z. B. Englisch und Kommunikation. Mit **Unterfächer speichern** anlegen. Die ICS-Datei liefert diese Unterteilung nicht; es wird nichts automatisch erkannt oder verteilt.
5. Optional ein **Standard-Unterfach** für offene und neu importierte Termine festlegen. Dann nur die abweichenden Termine auf das andere Unterfach ändern. Bereits gesetzte Einzelzuordnungen haben Vorrang; ohne Standard wird jeder Termin einzeln zugeordnet. Offene Zuordnungen und die Anzahl je Unterfach sind sichtbar. Solange nicht alle Termine zugeordnet sind oder eines der Unterfächer leer ist, wird das Fach weiterhin gemeinsam berechnet. Es entsteht kein drittes Rest-Unterfach.
6. **Pro Fach** berechnet das Gesamtbudget. **Pro Unterfach** berechnet die beiden vollständigen, manuell angelegten Unterfächer separat. Fächer ohne manuelle Aufteilung bleiben unverändert. Beim Umbenennen bleiben Terminzuordnungen und Fehlmarkierungen erhalten. **Aufteilung aufheben** deaktiviert die Trennung; die Zuordnung bleibt als Entwurf erhalten und kann durch erneutes Speichern aktiviert werden. Neue Importtermine übernehmen den gespeicherten Standard; ohne Standard bleiben sie offen, bis sie manuell zugeordnet werden.
7. Unter **Fächer zusammenfügen** mindestens zwei Kalenderfächer auswählen und einen gemeinsamen Namen eingeben. Das gemeinsame Budget berücksichtigt alle Termine und Fehlmarkierungen. Es wird nichts automatisch zusammengefügt. Die Verbindung lässt sich dort unter **Aufheben** rückgängig machen; ursprüngliche Aufteilungen bleiben gespeichert. Auch ein zusammengefügtes Fach lässt sich anschließend in zwei Unterfächer teilen.
8. Über **Termine ansehen** vergangene oder geplante Fehltermine markieren. Die App zieht diese im gewählten Zeitraum ab. „Übrig“ kann negativ werden; die Tabelle zeigt Überschreitungen rot und höchstens zwei übrige Termine gelb. Die Terminliste zeigt zusätzlich die prognostizierte Anwesenheitsquote. Alle übrigen Termine gelten für diese Prognose als besucht.

## Rechenregel

Bei `N` Terminen sind mindestens `ceil(N × 7 / 10)` Anwesenheiten nötig. Maximal fehlen darf man `N − ceil(N × 7 / 10)` Mal. Beispiel: 11 Termine → mindestens 8 besuchen → höchstens 3 fehlen. Die Berechnung verwendet ganzzahlige Faktoren, um Gleitkomma-Rundungsfehler zu vermeiden. Die Standardquote ist 0,7; im Info-Popover neben der Pflichtregel kann sie in Prozent geändert werden. Die Einstellung wird lokal in den Kalender-Einstellungen gespeichert. Übrig = Termine − Pflichttermine − geplante Fehltermine. Negative Werte bleiben sichtbar. Die Summen berücksichtigen nur angehakte Zeilen.

**Ein ICS-Unterrichtsblock zählt als ein Termin**, unabhängig von seiner Dauer. Mehrere Blöcke am selben Tag zählen separat. Falls die Hochschule nach Stunden, Tagen oder unterschiedlich gewichteten Veranstaltungen rechnet, ist diese Zählweise nicht gleichwertig. Prüfungen (`P …`, Prüfung/Klausur/Exam) werden standardmäßig ausgenommen und können zugeschaltet werden. `VS`, Labor und Übung bleiben als eigene Kalendereinträge getrennt. Es werden keine Fachnamen über unsichere Abkürzungsheuristiken zusammengeführt.

## Kalender und Datenschutz

- ICS mit gefalteten Zeilen, Text-Escapes, `VTIMEZONE`, ganztägigen und UTC-Terminen.
- Terminserien mit `COUNT`/`UNTIL`, `RDATE`, `EXDATE`, verschobenen/abgesagten Wiederholungen und Revisionen nach UID/SEQUENCE.
- Maßgeblich ist der Tag im jeweiligen Kalenderzeitformat, nicht die Zeitzone des betrachtenden Geräts. UTC-Einträge bleiben UTC und werden als solche angezeigt.
- Unbegrenzte Serien sowie stündliche/häufigere Serien werden mit Fehlermeldung abgelehnt. Maximal 5 MB pro Datei, 20.000 Originaleinträge, 30.000 expandierte Termine und 50.000 Wiederholungsschritte. Der Import läuft in einem separaten Web Worker mit Zeitlimit; ein ungültiger Import ersetzt den bisherigen Kalender nicht.
- Kalenderdaten, Fachzuordnungen und Fehlmarkierungen liegen ausschließlich in `localStorage` dieses Browsers unter `freiraum.v1`. Es werden die normalisierten Termine gespeichert, nicht die Originaldatei. Einstellungen gelten pro Browser und Website-Adresse. Bei blockiertem oder vollem Speicher warnt die App und arbeitet für die Sitzung weiter.
- Ein erneuter Import behält Fachzuordnungen und Fehlmarkierungen übereinstimmender Termin-IDs. Beim Wechsel von Beispieldaten zu echten Daten werden die Beispiele entfernt.
- Keine Analyse- oder Trackingdienste, extern geladenen Schriftarten oder CDNs. Die Content Security Policy erlaubt ausgehende Verbindungen ausschließlich zu `https://openmensa.org`. Der Kalender wird nicht übertragen. Kalender- und Speiseplantexte werden bei der Darstellung maskiert.
- Über **Lokale Daten löschen** den gespeicherten Kalender und alle Zuordnungen löschen.
- Die mitgelieferte Demo ist frei erfunden. Der persönliche Beispielkalender des Auftraggebers wird nicht mit ausgeliefert.

## Projektstruktur und spätere Erweiterungen

```text
public/
  app.js               Oberfläche, Browserzustand, Fachverwaltung
  theme.js             Systempräferenz und gespeicherter Hell-/Dunkelmodus
  mensa-canteens.js     Lokal gespeichertes Mensa-zu-OpenMensa-ID-Mapping
  mensa.js             Datumslogik, Suche, Speiseplan-Abruf und Sitzungscache
  mensa-view.js        Mensa-Auswahl, Wochenansicht und Bereichsnavigation
  fonts/               Lokal mitgelieferte IBM Plex Sans (400/500/600) und Lizenz
  core.js              Kalenderimport und reine Berechnungsfunktionen
  calendar-worker.js   Isolierter Kalenderimport
  demo.js              Synthetische Beispieldaten
  styles.css           Desktop- und Mobilansicht
  vendor/              Lokal eingebundene Kalenderbibliothek
scripts/
  build.mjs            Statische Hosting-Ausgabe
  serve.mjs            Lokaler Vorschau-Webserver
  update-mensa-catalog.mjs  Bewusste Aktualisierung des lokalen Verzeichnisses
tests/
  core.test.mjs        Rechenregeln, Gruppierung und ICS-Sonderfälle
```

Campus Dual bleibt als kommender Bereich gekennzeichnet. Die Rechenlogik ist von der Oberfläche getrennt; spätere Datenadapter können normalisierte Termine erzeugen, ohne die Anwesenheitsberechnung zu ersetzen. Campus-Dual-Import muss anhand der tatsächlich verfügbaren Schnittstelle und deren Browser-/CORS-Möglichkeiten geplant werden; Zugangsdaten gehören nicht in das Frontend.

## Mensaplan

Unter 800 px Fensterbreite sind die Einstellungen zunächst unter **Mensa-Einstellungen** eingeklappt. Die aktuelle Mensa ist im kompakten Kopf lesbar. Auf größeren Bildschirmen sind Mensa-Block und Preisgruppen-Auswahl direkt sichtbar. **Ändern** öffnet unter dem Mensa-Block eine lokale Suche mit Name und Adresse pro Treffer. Escape, Pfeiltasten und Enter unterstützen die Tastaturbedienung.

Über **Mensa** die aktuelle Woche öffnen, nach Stadt, Mensaname oder Adresse suchen und eine Mensa auswählen. Die Tageskarten von Montag bis Freitag stehen bei ausreichender Breite in fünf Spalten; schmalere Fenster lassen sie mit mindestens 180 px pro Karte umbrechen. Samstag und Sonntag sind über **Wochenende anzeigen** erreichbar. **Nächste Woche** führt zu folgenden Wochen; **Zur aktuellen Woche** springt zurück. Vorausgewählt ist **Leipzig, Mensa/Cafetaria Schönauer Straße (OpenMensa-ID 69)**. Die Preisgruppen werden aus vorhandenen Preisen abgeleitet; Studierende sind die Vorgabe. Hinweise und Allergene lassen sich pro Gericht aufklappen. Fehlende Preise werden ausdrücklich als solche angezeigt. Der Kopf zeigt den Zeitpunkt der letzten erfolgreichen Datenabfrage; Cache-Treffer behalten die ursprüngliche Abrufzeit.

Das mitgelieferte Mapping enthält **1.306 Mensen, Stand 03.11.2026**. Es wird direkt als lokales JavaScript-Modul geladen. Die App fragt weder das Mensa-Verzeichnis noch Mensa-Metadaten bei OpenMensa ab. Nur beim ersten Öffnen des Mensabereichs, Wechsel der Mensa/Woche oder ausdrücklichem Aktualisieren werden Tagespläne geladen:

```text
https://openmensa.org/api/v2/canteens/{lokal gespeicherte ID}/days/{YYYY-MM-DD}/meals
```

Pro Woche sind es höchstens sieben parallele Tagesanfragen. Erfolgreiche Antworten (auch leere/404) bleiben 15 Minuten im Sitzungsspeicher; **Plan aktualisieren** umgeht diesen Cache. Suche und Preisgruppenwechsel benötigen keine API-Anfragen. Mensa-ID und Preisgruppe liegen getrennt vom Kalender unter `campuscore.mensa.v1` in `localStorage`. **Auswahl zurücksetzen** entfernt diese Präferenzen und stellt Mensa 69 und Studierendenpreise wieder her. **Lokale Daten löschen** in der Anwesenheitsansicht betrifft weiterhin den Kalender.

Leere Listen und HTTP 404 erscheinen als **Kein Speiseplan**, nicht automatisch als „geschlossen“. Netz- und Serverfehler erscheinen separat je Tag und lassen die übrigen Tage sichtbar. Anfragen haben ein Zeitlimit von 12 Sekunden; beim Wechsel werden alte Anfragen abgebrochen. Die Wochenberechnung richtet sich nach `Europe/Berlin` und läuft unabhängig vom importierten Kalender. Zukünftige Pläne können nur angezeigt werden, sobald OpenMensa sie veröffentlicht.

Für eine bewusste Wartungsaktualisierung des Mappings (kein Teil von Build oder App-Start):

```powershell
node scripts/update-mensa-catalog.mjs
npm.cmd test
npm.cmd run build
```

Das Wartungsskript folgt allen Verzeichnisseiten, prüft eindeutige IDs und schreibt erst nach vollständigem Abruf. Den aktualisierten Export prüfen und neu ausliefern. Architektur, Grenzen und mögliche nächste Schritte stehen in [MENSA.md](MENSA.md).

## Tests

```powershell
npm.cmd test
```

Optional den ursprünglichen Kalender lokal als zusätzliche Testdatei prüfen; dieser wird weder kopiert noch veröffentlicht:

```powershell
$env:CALENDAR_FIXTURE = 'C:\Users\HP\Downloads\calendar.ics'
npm.cmd test
```

`ical.js` 2.2.1 ist unter MPL-2.0 lizenziert. Die unveränderte Bibliothek und ihre Lizenz liegen im Hosting-Ordner unter `vendor/`.

Die Fachübersicht ist eine Tabelle mit horizontalem Scrollbereich auf kleinen Displays. Die Seitenleiste wechselt unter 800 px in eine Navigation oberhalb des Inhalts. Farben sind über CSS-Variablen definiert; Systempräferenz und explizites `data-theme` steuern die Tokens. IBM Plex Sans wird aus dem gebauten Hosting-Ordner geladen, nicht von einem Drittanbieter. Die Font-Lizenz liegt unter `fonts/LICENSE.txt`.

Die Fachauswahl unter „Fach aufteilen“ enthält ausschließlich Fächer ohne Prüfungen, unabhängig von „Prüfungen mitzählen“ in der Übersicht. Das Auswahlfeld ist direkt durchsuchbar und unterstützt Pfeiltasten, Enter, Escape und Tab. Die beiden Unterfachnamen bleiben beim Wechsel der Fachauswahl erhalten; erst „Unterfächer speichern“ übernimmt sie für das gewählte Fach.
