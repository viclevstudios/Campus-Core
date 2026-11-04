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

Sidebar 232 px, rechts 32 px vertikal und 40 px horizontal. Bis einschließlich 720 px gelten die mobilen Referenzvorlagen mit oberer App-Leiste und unteren Tabs; darüber bleibt die Desktop-Sidebar. Buttons, Inputs und Klickflächen mindestens 44 px; Icons mit aria-label. Radien 8 px für Bedienelemente, 12 px für die schattenfreie Tabelle.

## Struktur

Desktop: Titel und kompakter Dateiblock. Danach Zeitraum, Datumsfelder, Prüfungsoption und Pflichtregel mit Popover. Zusammenfassung ohne Karten: Übrig, geplant, Termine. Fachübersicht als Tabelle mit Pro-Fach-/Pro-Unterfachwahl und manueller Zweiteilung; Suche nur bei mehr als acht Zeilen, kein zusätzlicher Filter.

Tabellenraster: 44px minmax(200px,1.5fr) minmax(220px,2fr) 90px 80px 44px; Gap 16 px, Zeilenpadding 14/16 px. Der 780-px-Mindestinhalt scrollt ausschließlich in seinem Container. Mobil wird dieselbe Berechnung in Fächerkarten dargestellt; die Tabelle ist ausgeblendet. Die Seite selbst wird nie horizontal gescrollt.

Pflicht blau, geplante Fehltermine orange, Rest neutral. Höchstens zwei übrige Termine gelb, null oder negative Werte rot. Keine Status-Badges. Abgewählte Zeilen haben 50 % Deckkraft und werden nicht summiert. Überschreitet die Planung das Budget, zeigt die Zahl das negative Ergebnis; der Balken erhält den echten geplanten Anteil und reduziert die noch erreichbare Pflichtfläche.

Pflicht = ceil(Termine × gespeicherte Quote), Standard 0,7. Übrig = Termine − Pflicht − geplant. Die Quote wird über das Info-Popover konfiguriert.

## Manuelle Zweiteilung

Diese Regeln betreffen ausschließlich die Anwesenheitsseite.

„Fach aufteilen“ enthält ausschließlich eine Fachauswahl, zwei Namensfelder und nach dem Speichern die manuelle Terminzuordnung zu diesen beiden Unterfächern. Keine gemeinsamen Fachnamen, keine kommaseparierte Veranstaltungsliste und keine automatische Interpretation von ICS-Titeln. Unvollständige Aufteilungen werden als Gesamtfach berechnet und entsprechend gekennzeichnet. Ein optionaler Standard ordnet offene und neue Termine zu; explizite Einzelzuordnungen haben Vorrang. Ohne Standard bleiben neue Termine unzugeordnet. Aufheben deaktiviert die Trennung, ohne den Entwurf zu löschen.

## Mensaplan

Referenzen: „Mensa hell@2x.png“, „Mensa dunkel@2x.png“ und die gelieferte Beschreibung. Gemeinsame Sidebar, Grundfarben und IBM Plex Sans. Mensa-spezifische Regeln liegen in `public/mensa.css`.

Kopf: Titel 28 px/600, tatsächlicher erfolgreicher Abrufzeitpunkt gedämpft und Refresh-Icon im 44 × 44 px großen Rahmenbutton. Auswahlzeile: Flex mit Umbruch und 12 px Abstand; Mensa-Button mindestens 64 px hoch, Oberfläche, 1-px-Rahmen, Radius 10 px. Name 16 px/600, Adresse 13 px; lokale Suche und Trefferliste direkt darunter. Keine Verzeichnisgröße in der Oberfläche. Preisgruppen aus vorhandenen Preisen; Select 64 px hoch, Label links daneben.

Wochenzeile: obere Linie, 20 px Abstand, zwei 44-px-Pfeilbuttons, Monatsname ausgeschrieben (20 px/600). „Diese Woche“ als Akzent-Pille; bei folgenden Wochen „Zur aktuellen Woche“ als Rahmenbutton.

Tageskarten: `repeat(auto-fit, minmax(180px, 1fr))`, 12 px Gap, oben ausgerichtet. Oberfläche, 1-px-Rahmen, Radius 12 px, Überlauf abgeschnitten. Heutiger Tag mit Akzentrahmen und Akzentkopf, ohne Heute-Label. Wochentag 14 px/600, Datum 13 px. Leere Karte: „Kein Speiseplan“.

Gerichte: Padding 14/16/4 px und obere Linie. Kategorie 12 px mit 8-px-Punkt (Fleisch: `--meat`; vegetarisch/vegan: `--veg`; sonst gedämpfte Textfarbe), Preis daneben 14 px/600. Kategorie bleibt als Text lesbar. Gerichtname 14 px/500, 6 px Abstand nach oben. Button „Allergene · Anzahl“ 13 px und mindestens 44 px hoch; Chevron dreht sich beim Öffnen um 180 Grad. Bei reduzierter Bewegung entfällt der Übergang.

Bis 720 px sind Mensa-Auswahl und Preisgruppe sichtbar und untereinander angeordnet. Die Wochenzeile zeigt Pfeile und Wochenstatus oben, das Datum darunter. Tageskarten stehen einspaltig, der heutige Tag in der aktuellen Woche zuerst (am Wochenende wird auch der heutige Wochenendtag aus dem ausklappbaren Bereich nach oben geholt). Darüber bleibt die chronologische Desktop-Ansicht. Andere Wochenendtage bleiben separat ausklappbar. Der Dunkelmodus tauscht die Tokens; Selects und Inputs übernehmen das gemeinsame Farbschema.

Die Fachauswahl zur Aufteilung ist eine kompakte, durchsuchbare Combobox. Prüfungen sind ausgeschlossen; die Suche sitzt im selben Feld. Vorschläge sind per Tastatur und Touch auswählbar. Die Namensfelder werden beim Fachwechsel als ungespeicherter Entwurf übernommen. Der Hinweis „Ohne Aufteilung wird das Fach als Ganzes berechnet.“ entfällt.

## Semester und manuelle Verbindungen

Semester beginnen am Montag der Woche des 1. April bzw. 1. Oktober und enden am Sonntag vor dem Folgesemester. Eigene Zeiträume werden nicht angepasst. Gespeicherte Semester-Vorschläge übernehmen die neuen Grenzen.

Neben „Fach aufteilen“ steht „Fächer zusammenfügen“. Die gemeinsame Fachbezeichnung und mindestens zwei explizit ausgewählte Kalenderfächer ergeben ein gemeinsames Budget. Suche und Mehrfachauswahl im Dialog; bestehende Verbindungen sind dort aufhebbar. Ursprüngliche Termine, Fehlmarkierungen und Aufteilungsentwürfe bleiben erhalten. Keine automatische Zusammenführung von Labor oder ähnlich benannten Fächern. Auch zusammengefügte Fächer können manuell aufgeteilt werden.

Berechnungswahl und beide Fachaktionen besitzen dieselbe äußere Höhe (52 px), Textausrichtung und jeweils 10 px vertikales CSS-Padding. Mobil stehen die Fachaktionen im Menü „Fächer verwalten“.

## Pastateller

Die bestehende Gerichtdarstellung wird für Pastateller wiederverwendet. Innerhalb eines Tages bilden Einträge mit gleichem bekanntem Preis der aktiven Preisgruppe eine Gruppe. Der Preis bleibt einmal sichtbar, Namen werden in Quellenreihenfolge ausschließlich durch Kommas verbunden, Zusatzinformationen ohne Duplikate vereinigt. Andere Kategorien und Einträge ohne Preis bleiben einzeln. Preisgruppenwechsel gruppiert die Originaldaten erneut; es wird keine feste Anzahl von Tagesgerichten vorausgesetzt.

Fehlende Speiseplantage werden vor dem Gerichte-Abruf anhand der Tagesliste erkannt. Nicht vorhandene bzw. geschlossene Tage bleiben bei „Kein Speiseplan“, ohne routinemäßige 404-Anfragen. Abruffehler bleiben als Fehler sichtbar.

## Mobile Anwesenheit bis 720 px

Visuelle Autorität: „Anwesenheit mobil hell@2x.png“ und „Anwesenheit mobil dunkel@2x.png“ sowie die zugehörige Beschreibung. Tokens, IBM Plex Sans und gespeicherte Theme-Auswahl bleiben identisch zum Desktop.

Oben eine sticky App-Leiste mit 56 px Höhe, 28-px-Logo und 44-px-Themeschalter ohne Rahmen. Die Desktop-Sidebar wird mobil zum App-Rahmen umgeordnet; ihre Navigation sitzt fix unten: drei gleich breite Tabs (Anwesenheit, Mensa und Export) mit 22-px-Icons, 12-px-Labels, mindestens 60 px Höhe und Safe-Area-Padding. Der aktive Tab erhält aria-current und Akzenttext. Hauptinhalt mit 16 px Seitenrand, 20 px Blockabstand und 80 px plus Safe Area unten.

Titel 26 px/600. Zeitraum-Karte mit zwei Zeilen von mindestens 60 px: Semester und Datumsbereich öffnen ein natives modales Bottom-Sheet; Dateiinfo und Wechselbutton darunter. Das Sheet enthält einen ungespeicherten Entwurf der Zeitraum-/Datums-/Prüfungsfelder. Nur „Übernehmen“ speichert, Schließen oder Escape verwirft den Entwurf. Datumsspannen werden validiert. Sheet-Padding 16 px, Radius oben 16 px, Abdunkelung über dialog::backdrop.

Zusammenfassung als eine Karte, Radius 12 px: freie Fehltermine 56 px/600, darunter zwei getrennte Zellen mit Gefehlt/Termine (13-px-Label, 22-px-Zahl), darunter die Pflichtregel mit 44-px-Info-Button „Berechnung erklären“. Desktop und mobile Ansicht verwenden dieselben Werte und denselben Rechenregel-Popover.

Fächerkopf mit 18-px-Titel und einem 44-px-Menübutton für Aufteilen/Zusammenfügen. Berechnungswahl über volle Breite: 40 px sichtbare Oberfläche innerhalb 44 px hoher Klickflächen. Suche bleibt bei mehr als acht Zeilen verfügbar. Karten mit 12 px Abstand, Radius 12 px, Border, Raster 44px minmax(0,1fr) auto, 8 px Spaltengap und Padding 8px 16px 14px 4px. Checkbox 20 px im 44-px-Label. Titel 14 px/600, Terminlink 13 px und 44 px hoch, Restbudget 28 px/600 mit „übrig“. Balken und direkte Pflicht-/Frei-/Gefehlt-Beschriftung unter den letzten beiden Spalten. Keine mobile Legende. Abgewählte Karten 50 % Deckkraft; Budgetwarnfarben unverändert.

Native Dialoge halten den Fokus. Nach dem Bearbeiten einer Terminliste wird der auslösende Kartenlink wieder fokussiert, nach Fachverwaltung der Menübutton. Menü unterstützt Pfeiltasten, Home/End und die native Escape-/Außenklick-Behandlung des Popovers.

## Export

Eigene Route `#export`, Seitentitel „Export“, aktiv markierter Navigationseintrag auf Desktop und Mobil. Eine maximal 760 px breite Oberfläche mit zwei durch eine Linie getrennten Bereichen: „Daten exportieren“ und „Daten importieren“. Aktueller Kalender und Sicherungsvorschau als einfache Definitionslisten, Download als primärer Button, Dateiauswahl als Rahmenbutton. Alle Flächen nutzen die bestehenden Tokens, IBM Plex Sans und mindestens 44 px hohe Bedienelemente. Mobil 16 px Innenabstand und drei gleich breite untere Tabs.

Die Sicherung wird als versionierte JSON-Datei heruntergeladen. Der Import prüft Größe, Format und Datenstruktur, bevor er eine Vorschau zeigt. Der Button „Daten importieren“ trägt einen Verweis auf den Hinweis, dass die aktuellen Anwesenheitsdaten ersetzt werden. „Verwerfen“ schließt die Vorschau. Status und Fehler werden als Text per role=status ausgegeben; Dateinamen und Vorschauwerte über textContent. Der Import ersetzt den laufenden Zustand erst nach erfolgreichem localStorage-Schreibzugriff. Es werden keine zusätzlichen Netzwerkverbindungen aufgebaut.
