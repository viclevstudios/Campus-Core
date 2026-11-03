# Campus Core – UI nach Referenzvorlagen

Die gelieferten Hell-/Dunkelbilder und die Beschreibung bestimmen die Gestaltung. Modus: Operate. Keine Slogans oder zusätzlichen Schmuckelemente. Die Anwesenheit verwendet die bestehende Tabelle; der Mensaplan verwendet Tageskarten gemäß den Mensa-Vorlagen.

## Tokens

| Token | Hell | Dunkel |
|---|---|---|
| --bg | #F5F6F8 | #0F1217 |
| --surface | #FFFFFF | #171B22 |
| --border | #E1E5EB | #2A313C |
| --text | #151A22 | #E9ECF1 |
| --muted | #586272 | #9AA4B3 |
| --accent | #2457C5 | #6E9BFF |
| --on-accent | #FFFFFF | #0B1220 |
| --accent-soft | #E8EEFB | #1D2842 |
| --accent-text | #1D4AAE | #9DBBFF |
| --track | #E3E7EE | #2A313C |
| --planned | #C2410C | #FB923C |
| --bad | #B42318 | #F87171 |
| --warn | #B45309 | #FBBF24 |
| --meat | #B4532A | #E58B5F |
| --veg | #2E7D4F | #5BC08A |

CSS definiert zuerst den hellen Standard, dann die dunkle Systempräferenz und anschließend den expliziten Dunkelmodus. `data-theme=light` verhindert die Systemüberschreibung. Das Skript liest die gespeicherte Auswahl vor dem Inhalt. Native Formularfelder folgen `--scheme`. Alle Farben sind Variablen.

## Typografie und Maße

IBM Plex Sans wird lokal in 400, 500 und 600 mitgeliefert. Zahlen nutzen tabular-nums. Seitentitel 28 px/600, Abschnitte 18 px/600, Fachnamen 14 px/500, Tabellenköpfe und Zusatztexte 13 px. Zusammenfassungszahlen 44 px/600, verbleibendes Fachbudget 22 px/600.

Sidebar 232 px, rechts 32 px vertikal und 40 px horizontal. Unter 800 px Navigation über dem Inhalt. Buttons, Inputs und Klickflächen mindestens 44 px; Icons mit aria-label. Radien 8 px für Bedienelemente, 12 px für die schattenfreie Tabelle.

## Struktur

Kopf: Titel und kompakter Dateiblock. Danach Zeitraum, Datumsfelder, Prüfungsoption und Pflichtregel mit Popover. Zusammenfassung ohne Karten: Übrig, geplant, Termine. Fachübersicht als Tabelle mit Pro-Fach-/Pro-Unterfachwahl und manueller Zweiteilung; Suche nur bei mehr als acht Zeilen, kein zusätzlicher Filter.

Tabellenraster: 44px minmax(200px,1.5fr) minmax(220px,2fr) 90px 80px 44px; Gap 16 px, Zeilenpadding 14/16 px. Der 780-px-Mindestinhalt scrollt ausschließlich in seinem Container. Mobil bleiben dieselben Informationen erreichbar; die Seite selbst wird nicht horizontal gescrollt.

Pflicht blau, geplante Fehltermine orange, Rest neutral. Höchstens zwei übrige Termine gelb, null oder negative Werte rot. Keine Status-Badges. Abgewählte Zeilen haben 50 % Deckkraft und werden nicht summiert. Überschreitet die Planung das Budget, zeigt die Zahl das negative Ergebnis; der Balken erhält den echten geplanten Anteil und reduziert die noch erreichbare Pflichtfläche.

Pflicht = ceil(Termine × gespeicherte Quote), Standard 0,7. Übrig = Termine − Pflicht − geplant. Die Quote wird über das Info-Popover konfiguriert.

## Manuelle Zweiteilung

Diese Regeln betreffen ausschließlich die Anwesenheitsseite.

„Fach aufteilen“ enthält ausschließlich eine Fachauswahl, zwei Namensfelder und nach dem Speichern die manuelle Terminzuordnung zu diesen beiden Unterfächern. Keine gemeinsamen Fachnamen, keine kommaseparierte Veranstaltungsliste und keine automatische Interpretation von ICS-Titeln. Unvollständige Aufteilungen werden als Gesamtfach berechnet und entsprechend gekennzeichnet. Neue Termine bleiben unzugeordnet. Aufheben deaktiviert die Trennung, ohne den Entwurf zu löschen.

## Mensaplan

Referenzen: „Mensa hell@2x.png“, „Mensa dunkel@2x.png“ und die gelieferte Beschreibung. Gemeinsame Sidebar, Grundfarben und IBM Plex Sans. Mensa-spezifische Regeln liegen in `public/mensa.css`.

Kopf: Titel 28 px/600, tatsächlicher erfolgreicher Abrufzeitpunkt gedämpft und Refresh-Icon im 44 × 44 px großen Rahmenbutton. Auswahlzeile: Flex mit Umbruch und 12 px Abstand; Mensa-Button mindestens 64 px hoch, Oberfläche, 1-px-Rahmen, Radius 10 px. Name 16 px/600, Adresse 13 px; lokale Suche und Trefferliste direkt darunter. Keine Verzeichnisgröße in der Oberfläche. Preisgruppen aus vorhandenen Preisen; Select 64 px hoch, Label links daneben.

Wochenzeile: obere Linie, 20 px Abstand, zwei 44-px-Pfeilbuttons, Monatsname ausgeschrieben (20 px/600). „Diese Woche“ als Akzent-Pille; bei folgenden Wochen „Zur aktuellen Woche“ als Rahmenbutton.

Tageskarten: `repeat(auto-fit, minmax(180px, 1fr))`, 12 px Gap, oben ausgerichtet. Oberfläche, 1-px-Rahmen, Radius 12 px, Überlauf abgeschnitten. Heutiger Tag mit Akzentrahmen und Akzentkopf, ohne Heute-Label. Wochentag 14 px/600, Datum 13 px. Leere Karte: „Kein Speiseplan“.

Gerichte: Padding 14/16/4 px und obere Linie. Kategorie 12 px mit 8-px-Punkt (Fleisch: `--meat`; vegetarisch/vegan: `--veg`; sonst gedämpfte Textfarbe), Preis daneben 14 px/600. Kategorie bleibt als Text lesbar. Gerichtname 14 px/500, 6 px Abstand nach oben. Button „Allergene · Anzahl“ 13 px und mindestens 44 px hoch; Chevron dreht sich beim Öffnen um 180 Grad. Bei reduzierter Bewegung entfällt der Übergang.

Unter 800 px sind die Einstellungen anfangs eingeklappt; der Mensaname ist im kompakten Kopf lesbar. Karten brechen anhand ihrer Mindestbreite um. Wochenende separat ausklappbar. Der Dunkelmodus tauscht die Tokens; Selects und Inputs übernehmen das gemeinsame Farbschema.

Die Fachauswahl zur Aufteilung ist eine kompakte, durchsuchbare Combobox. Prüfungen sind ausgeschlossen; die Suche sitzt im selben Feld. Vorschläge sind per Tastatur und Touch auswählbar. Die Namensfelder werden beim Fachwechsel als ungespeicherter Entwurf übernommen. Der Hinweis „Ohne Aufteilung wird das Fach als Ganzes berechnet.“ entfällt.
