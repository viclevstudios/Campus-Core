# OpenMensa-Integration

## Ziel und umgesetzter Ablauf

Die App zeigt den Plan der aktuellen Kalenderwoche und beliebiger folgender Wochen. Die Mensa-Auswahl erfolgt ausschließlich anhand eines ausgelieferten Mappings aus Name, Stadt, Adresse und OpenMensa-ID. Ein Mensa-Verzeichnisaufruf zur Laufzeit ist ausgeschlossen. Die ID aus dem Mapping wird direkt in den Essen-Endpunkt eingesetzt.

1. `mensa-canteens.js` enthält den einmalig exportierten Katalog mit 1.306 eindeutigen IDs (03.11.2026), Quelle und Exportdatum. Keine Zuordnung einer Hochschule wird erfunden: Nutzer wählen die konkrete Mensa anhand von Name und Adresse.
2. Die lokale Suche filtert das Mapping; die konkrete Auswahl und Preisgruppe werden unter `campuscore.mensa.v1` gespeichert. Ohne gespeicherte Auswahl wird die vom Auftraggeber gelieferte Mensa 69 verwendet.
3. Erst beim Öffnen von `#mensa` berechnet die App Montag bis Sonntag in Bezug auf den heutigen Tag in `Europe/Berlin`. Die Kalender-Anwesenheitsfilter beeinflussen diese Ansicht nicht.
4. `loadWeek` fordert für jeden der sieben Tage ausschließlich `/api/v2/canteens/{id}/days/{date}/meals` an. Metadaten-, Mensasuche- und Tageslisten-Endpunkte werden in der ausgelieferten App nicht angefragt.
5. Die Ansicht zeigt Tageskarten mit Kategorie-Punkt, Kategorie als Text, Gericht und Preis. Die Preisgruppen werden aus tatsächlich vorhandenen numerischen Preisen abgeleitet. Ein Button mit `aria-expanded` öffnet Originalhinweise und Allergene. Das Raster verwendet `repeat(auto-fit, minmax(180px, 1fr))` mit 12 px Abstand: fünf Karten auf breiten Fenstern, Umbruch bei weniger Platz. Samstag und Sonntag bleiben über „Wochenende anzeigen“ erreichbar. Alle API-Texte werden maskiert.
6. Vor-/Zurückblättern bleibt bei der aktuellen oder einer folgenden Woche. „Zur aktuellen Woche“ stellt die Ausgangswoche wieder her. Es gibt keine künstliche Vorschaugrenze; die tatsächliche Veröffentlichung hängt vom Betreiber ab.

## Fehler und Aktualität

Unter 800 px sind die Einstellungen über das native Details-Element „Mensa-Einstellungen“ ein- und ausklappbar; beim Start ist es geschlossen. Der gewählte Mensaname bleibt im kompakten Kopf lesbar. Ab 800 px ist der Bereich geöffnet. „Ändern“ öffnet ein Dropdown mit lokaler Suche und Trefferliste unter dem Mensa-Block; Pfeiltasten, Enter, Escape und Schließen bei Fokuswechsel werden unterstützt. Ein Treffer speichert die Auswahl, schließt das Dropdown und lädt den Plan. Der Öffnungszustand mobiler Einstellungen bleibt bei Planaktualisierungen erhalten.

Die Anzeige „Stand … Uhr“ verwendet den gespeicherten `fetchedAt`-Zeitpunkt der letzten erfolgreichen Tagesabfrage des gewählten Plans. Cache-Treffer behalten diesen Zeitpunkt; vollständige Fehlschläge aktualisieren ihn nicht. Monats- und Jahreswechsel werden in der ausgeschriebenen Wochenbeschriftung berücksichtigt.

| Situation | Verhalten |
| --- | --- |
| Plan lädt | Sieben Tagesabschnitte mit Ladehinweis, Statusmeldung und `aria-busy` |
| Tagesantwort mit Gerichten | Gerichtsnamen, Kategorien, Preise und Originalhinweise |
| Leere Liste oder HTTP 404 | „Kein Speiseplan“; keine Behauptung über Öffnungszeiten |
| Einzelner Tag offline, HTTP 429/5xx oder ungültige Daten | Fehler an diesem Tag, andere Tage bleiben sichtbar |
| Anfrage länger als 12 Sekunden | Tagesfehler mit Hinweis auf das Zeitlimit |
| Schneller Wechsel von Mensa oder Woche | Vorherige Anfragen werden abgebrochen; nur die aktuelle Anfrage darf die Ansicht aktualisieren |
| Unbekannte gespeicherte ID/Preisgruppe | Rückfall auf ID 69 bzw. Studierendenpreise |
| Fehlende Preisangabe | „Preis nicht angegeben“; ein Preis von 0 bleibt 0,00 € |
| Browser blockiert Speicherung | Sichtbarer Hinweis, Auswahl gilt weiter für die Sitzung |

Erfolgreiche Tagesergebnisse werden 15 Minuten im Arbeitsspeicher gecacht, getrennt nach ID und Datum. Der Cache ist auf 280 Tagesantworten begrenzt und überlebt keinen Reload. Fehler werden nicht gecacht. „Plan aktualisieren“ lädt die ausgewählte Woche erneut. Beim ersten Wiederöffnen nach einem Wochenwechsel wird mindestens die neue aktuelle Woche verwendet.

## Hosting und Datenschutz

Die App bleibt statisch hostbar. `connect-src` ist auf `https://openmensa.org` begrenzt. Ein auf dem Hosting gesetzter zusätzlicher CSP-Header muss dieselbe Verbindung erlauben; strengere Header können nicht durch das HTML gelockert werden. Browserzugriff wurde am 03.11.2026 mit Live-Speiseplänen geprüft; OpenMensa antwortete für den Beispielaufruf mit `Access-Control-Allow-Origin: *`.

Die Tagesanfragen enthalten nur Mensa-ID und Datum, keine Kalenderdaten. Fetch verwendet `credentials: omit`, `referrerPolicy: no-referrer` und lehnt Redirects ab. OpenMensa erhält beim Abruf die üblichen Verbindungsdaten wie die IP-Adresse. Es gibt keinen Proxy und keine automatische Hintergrundabfrage bei ausschließlicher Nutzung der Anwesenheitsansicht.

## Wartung und spätere Schritte

Der Katalog wird durch `node scripts/update-mensa-catalog.mjs` bewusst aktualisiert und anschließend mit der App neu ausgeliefert. Das Skript folgt dem `next`-Link der OpenMensa-Paginierung und validiert IDs. App-Start und Build benötigen diesen Abruf nicht.

Die erste Ausbaustufe ist implementiert. Mögliche spätere Erweiterungen, jeweils separat zu entscheiden:

- Persistenter Offline-Cache mit gut sichtbarem Abrufdatum und veralteten Daten.
- Ernährungsfilter nach verlässlich verfügbaren Originalhinweisen; fehlende Kennzeichnung darf nicht als Allergenfreiheit interpretiert werden.
- Optionale Hochschul-Favoriten als zusätzlich gepflegtes Mapping; Hochschulnamen sind nicht Teil des verwendeten OpenMensa-Katalogs.
- Echte Schließtage erst nach bewusster Erweiterung um den Tagesstatus-Endpunkt. Mit reinen Essen-Abfragen bleibt „nicht veröffentlicht“ die korrekte Aussage.

## Prüfung und Quellen

`npm.cmd test` umfasst Katalog/IDs, lokale Suche, Datumsgrenzen und Zeitzonen, URL-Validierung, Preisnormalisierung, Cache-Isolation/TTL, Teilfehler, fehlende Daten, Zeitlimit und Abbruch. Die bestehende Kalender- und Theme-Suite wird mit ausgeführt. `npm.cmd run build` erzeugt die vollständige statische Ausgabe in `dist/`.

- [OpenMensa API – Übersicht und Pagination](https://docs.openmensa.org/api/v2/overview/)
- [OpenMensa API – Tagesgerichte und Preisgruppen](https://docs.openmensa.org/api/v2/meals/)
- [OpenMensa API – fehlende Tage und Schließinformationen](https://docs.openmensa.org/api/v2/days/)
- [Vom Auftraggeber gelieferter Beispiel-Endpunkt](https://openmensa.org/api/v2/canteens/69/days/2026-11-03/meals)
