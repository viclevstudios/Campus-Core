import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attendance, parseCalendar, buildBuckets, semesterOptions, classify, subjectPartition, configurePartition, splitSubjects, editableSubjects, combineSubjects, partitionPart, setPartitionDefault } from '../public/core.js';
const calendar = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Campus Core Tests//DE\r\n${events}\r\nEND:VCALENDAR`;
const event = (uid, extra = '', date = '20261005T090000', summary = 'VS Fachenglisch und Kommunikation') => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART:${date}\r\nDTEND:${date.slice(0, 9)}103000\r\nSUMMARY:${summary}\r\n${extra}\r\nEND:VEVENT`;

test('70-Prozent-Grenze wird für alle kleinen und großen Budgets sicher eingehalten', () => {
  for (let n = 1; n <= 10000; n++) {
    const b = attendance(n);
    assert.ok((n - b.allowed) * 10 >= n * 7);
    assert.ok((n - b.allowed - 1) * 10 < n * 7);
  }
  assert.equal(attendance(10).allowed, 3);
  assert.equal(attendance(11).allowed, 3);
  assert.equal(attendance(90).allowed, 27);
  assert.equal(attendance(0).allowed, 0);
  assert.equal(attendance(10, 4).over, 1);
  assert.equal(attendance(10, 4).remaining, -1);
  assert.throws(() => attendance(10, 11));
});
test('konfigurierte Quote wird ohne Dezimalrundungsfehler angewendet', () => {
  assert.equal(attendance(100, 0, 0.14).required, 14);
  assert.equal(attendance(20, 0, 0.8).allowed, 4);
  assert.equal(attendance(11, 3, 0.75).remaining, -1);
  assert.equal(attendance(10, 10, 0).remaining, 0);
  assert.equal(attendance(10, 1, 1).remaining, -1);
  assert.throws(() => attendance(10, 0, 1.1));
  assert.throws(() => attendance(10, 0, NaN));
});
test('Fach- und Veranstaltungsbudgets verwenden die Quote aus den Einstellungen', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=20')));
  for (const mode of ['joined', 'split']) {
    const bucket = buildBuckets(events, {}, { mode, preferences: { attendanceRate: 0.8 }, absences: Object.fromEntries(events.slice(0, 5).map(e => [e.id, true])) })[0];
    assert.equal(bucket.required, 16);
    assert.equal(bucket.absent, 5);
    assert.equal(bucket.remaining, -1);
  }
});
test('Import entfaltet Zeilen und dekodiert ICS-Text', () => {
  const result = parseCalendar(calendar(event('a', 'LOCATION:Raum 1\\, Haus A', '20261005T090000', 'VS Sehr langes Fach\\, mit\r\n Fortsetzung')));
  assert.equal(result.events[0].title, 'Sehr langes Fach, mitFortsetzung');
  assert.equal(result.events[0].location, 'Raum 1, Haus A');
});
test('zwei Blöcke am gleichen Tag zählen als zwei Termine', () => {
  const { events } = parseCalendar(calendar(event('a') + '\r\n' + event('b', '', '20261005T110000')));
  assert.equal(buildBuckets(events)[0].total, 2);
});
test('Wiederholungen, EXDATE, RDATE und verschobene Ausnahmen', () => {
  const master = event('series', 'RRULE:FREQ=WEEKLY;COUNT=5\r\nEXDATE:20261012T090000\r\nRDATE:20261109T090000');
  const override = event('series', 'RECURRENCE-ID:20261019T090000', '20261020T090000');
  const { events } = parseCalendar(calendar(master + '\r\n' + override));
  assert.equal(events.length, 5);
  assert.deepEqual(events.map(e => e.date), ['2026-10-05', '2026-10-20', '2026-10-26', '2026-11-02', '2026-11-09']);
});
test('abgesagte Termine und abgesagte Einzelwiederholungen zählen nicht', () => {
  const master = event('series', 'RRULE:FREQ=WEEKLY;COUNT=3');
  const override = event('series', 'RECURRENCE-ID:20261012T090000\r\nSTATUS:CANCELLED', '20261012T090000');
  const { events, cancelled } = parseCalendar(calendar(master + '\r\n' + override + '\r\n' + event('cancel', 'STATUS:CANCELLED')));
  assert.equal(events.length, 2); assert.equal(cancelled, 2);
});
test('neueste Revision pro UID gewinnt, Duplikate werden entfernt', () => {
  const { events } = parseCalendar(calendar(event('a', 'SEQUENCE:2', '20261006T090000') + '\r\n' + event('a', 'SEQUENCE:1') + '\r\n' + event('a', 'SEQUENCE:1')));
  assert.equal(events.length, 1); assert.equal(events[0].date, '2026-10-06');
});
test('abgesagte Wiederholung darf ohne DTSTART exportiert sein', () => {
  const master = event('series', 'RRULE:FREQ=WEEKLY;COUNT=3');
  const override = 'BEGIN:VEVENT\r\nUID:series\r\nRECURRENCE-ID:20261012T090000\r\nSTATUS:CANCELLED\r\nEND:VEVENT';
  const result = parseCalendar(calendar(master + '\r\n' + override));
  assert.equal(result.events.length, 2); assert.equal(result.cancelled, 1);
});
test('Semestergrenzen sind inklusive und Prüfungen optional', () => {
  const { events } = parseCalendar(calendar(event('a', '', '20260930T090000') + '\r\n' + event('b', '', '20261001T090000') + '\r\n' + event('c', '', '20261002T090000', 'P Analysis (K)')));
  assert.equal(buildBuckets(events, {}, { from: '2026-10-01', to: '2026-10-01' })[0].total, 1);
  assert.equal(buildBuckets(events).length, 1);
  assert.equal(buildBuckets(events, {}, { includeExams: true }).length, 2);
  assert.equal(semesterOptions(events).length, 1);
});
test('Semester starten montags, enden sonntags und grenzen lückenlos aneinander', () => {
  const dates = [];
  for (let year = 2024; year <= 2032; year++) for (let month = 1; month <= 12; month++) dates.push({ date: `${year}-${String(month).padStart(2, '0')}-01` });
  const options = semesterOptions(dates);
  const winter = options.find(p => p.id === 'winter-2026');
  assert.equal(winter.from, '2026-09-28');
  assert.equal(winter.to, '2027-03-28');
  assert.equal(options.find(p => p.id === 'summer-2027').from, '2027-03-29');
  for (const [index, item] of options.entries()) {
    assert.equal(new Date(`${item.from}T12:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${item.to}T12:00:00Z`).getUTCDay(), 0);
    if (index) assert.equal((Date.parse(item.from) - Date.parse(options[index - 1].to)) / 86400000, 1);
  }
  for (const event of dates) assert.equal(options.filter(p => event.date >= p.from && event.date <= p.to).length, 1);
  assert.deepEqual(semesterOptions([{ date: '2026-09-28' }]).map(p => p.id), ['winter-2026']);
});
test('Lehrformen bleiben standardmäßig getrennt', () => {
  assert.notEqual(classify('VS Analysis').defaultSubject, classify('LP Analysis').defaultSubject);
  assert.equal(classify('VS  Wissenschaftliches Arbeiten').title, 'Wissenschaftliches Arbeiten');
});
test('gemeinsame und getrennte Berechnung verwenden zugeordnete Einzeltermine', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=8')));
  const source = events[0].source;
  const settings = { [source]: { subject: 'Sprachen', parts: ['Englisch', 'Kommunikation'], assignments: Object.fromEntries(events.map((e, i) => [e.id, i < 4 ? 'Englisch' : 'Kommunikation'])) } };
  const joined = buildBuckets(events, settings);
  const split = buildBuckets(events, settings, { mode: 'split', absences: { [events[0].id]: true, [events[1].id]: true } });
  assert.equal(joined.length, 1); assert.equal(joined[0].total, 8); assert.equal(joined[0].allowed, 2);
  assert.equal(split.length, 2); assert.equal(split[0].allowed, 1); assert.equal(split[1].allowed, 1);
  assert.equal(split.find(b => b.part === 'Englisch').over, 1);
  assert.equal(split.find(b => b.part === 'Kommunikation').remaining, 1);
});
test('Pro Unterfach erfindet aus ICS-Einträgen keine Unterfächer', () => {
  const { events } = parseCalendar(calendar(event('a', '', '20261005T090000', 'VS Englisch') + '\r\n' + event('b', '', '20261006T090000', 'VS Kommunikation')));
  const settings = Object.fromEntries(events.map(e => [e.source, { subject: 'Fachenglisch und Kommunikation' }]));
  assert.equal(buildBuckets(events, settings).length, 1);
  assert.equal(buildBuckets(events, settings, { mode: 'split' }).length, 1);
  assert.equal(buildBuckets(events, settings, { mode: 'split' })[0].part, '');
});

test('eine manuelle Aufteilung braucht genau zwei unterschiedliche Namen', () => {
  assert.throws(() => configurePartition([], {}, ['Englisch']), /zwei unterschiedliche/);
  assert.throws(() => configurePartition([], {}, ['Englisch', ' englisch ']), /zwei unterschiedliche/);
  assert.throws(() => configurePartition([], {}, ['', 'Kommunikation']), /zwei unterschiedliche/);
  assert.throws(() => configurePartition([], {}, ['A', 'B', 'C']), /zwei unterschiedliche/);
  assert.deepEqual(configurePartition([], {}, [' Englisch ', ' Kommunikation ']).parts, ['Englisch', 'Kommunikation']);
});
test('Fachauswahl enthält keine Prüfungen, keine Duplikate und sortiert nach Fachname', () => {
  const { events } = parseCalendar(calendar([
    event('python-exam', '', '20261005T090000', 'P Python (C)'),
    event('z', '', '20261005T090000', 'VS Stochastik'),
    event('a', '', '20261005T090000', 'VS Analysis'),
    event('a2', '', '20261006T090000', 'VS Analysis'),
    event('law', '', '20261006T090000', 'VS Prüfungsrecht')
  ].join('\r\n')));
  const before = JSON.stringify(events);
  assert.deepEqual(splitSubjects(events).map(s => s.title), ['Analysis', 'Prüfungsrecht', 'Stochastik']);
  assert.equal(JSON.stringify(events), before);
});
test('Prüfungs-Metadaten und ältere Kalendereinträge werden ebenfalls gefiltert', () => {
  const entries = [
    { source: 'Analysis', defaultSubject: 'Analysis', kind: 'Prüfung', exam: false },
    { source: 'Python', defaultSubject: 'Python', exam: true },
    { source: 'P Betriebssysteme (C)', defaultSubject: 'Betriebssysteme' }
  ];
  assert.deepEqual(splitSubjects(entries), []);
  assert.deepEqual(splitSubjects([]), []);
});
test('unvollständige Aufteilung erzeugt kein drittes oder verfälschtes Budget', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=7')));
  const source = events[0].source;
  const config = { parts: ['Englisch', 'Kommunikation'], assignments: { [events[0].id]: 'Englisch' } };
  const buckets = buildBuckets(events, { [source]: config }, { mode: 'split' });
  assert.equal(buckets.length, 1); assert.equal(buckets[0].total, 7);
  assert.equal(buckets[0].allowed, 2); assert.equal(buckets[0].splitPending, true);
  assert.equal(subjectPartition(events, config).unassigned, 6);
});
test('korrekte Unterfachbudgets erhalten alle Termine und Fehlmarkierungen', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=7')));
  const source = events[0].source;
  const config = { parts: ['Englisch', 'Kommunikation'], assignments: Object.fromEntries(events.map((e, i) => [e.id, i < 3 ? 'Englisch' : 'Kommunikation'])) };
  const settings = { [source]: config }, absences = { [events[0].id]: true };
  const joined = buildBuckets(events, settings, { mode: 'joined', absences });
  const split = buildBuckets(events, settings, { mode: 'split', absences });
  assert.equal(joined[0].allowed, 2); assert.equal(joined[0].remaining, 1);
  assert.equal(split.reduce((n, b) => n + b.total, 0), 7);
  assert.equal(split.reduce((n, b) => n + b.absent, 0), 1);
  assert.equal(split.reduce((n, b) => n + b.allowed, 0), 1);
  assert.equal(split.find(b => b.part === 'Englisch').remaining, -1);
});
test('Umbenennen und Aufheben erhalten die manuelle Zuordnung', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=4')));
  const config = { parts: ['Englisch', 'Kommunikation'], assignments: Object.fromEntries(events.map((e, i) => [e.id, i < 2 ? 'Englisch' : 'Kommunikation'])) };
  const renamed = configurePartition(events, config, ['Englisch I', 'Kommunikation I']);
  assert.equal(renamed.assignments[events[0].id], 'Englisch I');
  assert.equal(renamed.assignments[events[3].id], 'Kommunikation I');
  assert.equal(subjectPartition(events, renamed).complete, true);
  const disabled = { ...renamed, splitEnabled: false };
  assert.equal(subjectPartition(events, disabled).complete, false);
  assert.equal(subjectPartition(events, disabled).assigned, 4);
  assert.equal(subjectPartition(events, configurePartition(events, disabled, renamed.parts)).complete, true);
});
test('neue Importtermine bleiben offen und werden nicht automatisch verteilt', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=4')));
  const config = { parts: ['Englisch', 'Kommunikation'], assignments: Object.fromEntries(events.map((e, i) => [e.id, i % 2 ? 'Englisch' : 'Kommunikation'])) };
  const added = { ...events[0], id: 'new-event' };
  assert.equal(subjectPartition([...events, added], config).complete, false);
  assert.equal(subjectPartition([...events, added], config).unassigned, 1);
  const oneSide = { ...config, assignments: Object.fromEntries(events.map(e => [e.id, 'Englisch'])) };
  assert.equal(subjectPartition(events, oneSide).complete, false);
});
test('ein Standard ordnet offene und neue Termine zu, erhält aber Einzelzuordnungen', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=10')));
  const source = events[0].source;
  let config = configurePartition(events, {}, ['Englisch', 'Kommunikation']);
  config.assignments[events[0].id] = 'Kommunikation';
  config = setPartitionDefault(config, 'Englisch');
  assert.equal(partitionPart(events[0], config), 'Kommunikation');
  assert.equal(partitionPart(events[1], config), 'Englisch');
  assert.equal(partitionPart({ id: 'new' }, config), 'Englisch');
  assert.equal(subjectPartition(events, config).complete, true);
  const split = buildBuckets(events, { [source]: config }, { mode: 'split', absences: { [events[1].id]: true } });
  assert.equal(split.find(b => b.part === 'Englisch').total, 9);
  assert.equal(split.find(b => b.part === 'Englisch').absent, 1);
  const renamed = configurePartition(events, config, ['English', 'Communication']);
  assert.equal(renamed.defaultPart, 'English');
  assert.equal(partitionPart(events[0], renamed), 'Communication');
  config.assignments[events[1].id] = '';
  assert.equal(subjectPartition(events, config).unassigned, 1);
  assert.equal(configurePartition(events, config, config.parts).assignments[events[1].id], '');
  assert.equal(subjectPartition(events, setPartitionDefault(config, '')).assigned, 1);
  assert.throws(() => setPartitionDefault(config, 'Unbekannt'), /vorhandenes/);
});
test('manuelles Zusammenfügen erhält Termine, Abwesenheiten und getrennte Originalkonfigurationen', () => {
  const { events } = parseCalendar(calendar([
    event('lecture', 'RRULE:FREQ=WEEKLY;COUNT=5', '20261005T090000', 'VS Digitaltechnik und Rechnerarchitektur'),
    event('lab', 'RRULE:FREQ=WEEKLY;COUNT=5', '20261006T090000', 'LP Digitaltechnik und Rechnerarchitektur'),
    event('exam', '', '20261201T090000', 'P Digitaltechnik (K)')
  ].join('\r\n')));
  const choices = editableSubjects(events);
  assert.equal(choices.length, 2);
  const settings = { [choices[0].source]: { parts: ['A', 'B'] } };
  const before = JSON.stringify(settings);
  const groups = combineSubjects(events, settings, [], choices.map(s => s.source), ' Digitaltechnik ', 'group:test');
  const absences = Object.fromEntries(events.slice(0, 3).map(e => [e.id, true]));
  for (const mode of ['joined', 'split']) {
    const result = buildBuckets(events, settings, { groups, mode, absences });
    assert.equal(result.length, 1);
    assert.equal(result[0].subject, 'Digitaltechnik');
    assert.equal(result[0].total, 10);
    assert.equal(result[0].required, 7);
    assert.equal(result[0].absent, 3);
    assert.equal(result[0].remaining, 0);
  }
  assert.equal(editableSubjects(events, settings, groups).length, 1);
  assert.equal(editableSubjects(events, settings, groups)[0].sources.length, 2);
  assert.equal(buildBuckets(events, settings, { groups, includeExams: true }).length, 2);
  assert.equal(buildBuckets(events, settings, { groups, from: '2026-10-05', to: '2026-10-06' })[0].total, 2);
  assert.equal(buildBuckets(events, settings, { groups: [] }).length, 2);
  assert.equal(JSON.stringify(settings), before);
  assert.throws(() => combineSubjects(events, {}, [], [choices[0].source], 'Test', 'group:x'), /mindestens zwei/);
  assert.throws(() => combineSubjects(events, {}, [], choices.map(s => s.source), ' ', 'group:x'), /Fachnamen/);
  assert.throws(() => combineSubjects(events, {}, [], [choices[0].source, events.at(-1).source], 'Test', 'group:x'), /mindestens zwei/);
});
test('zusammengefügte Fächer lassen sich als Ganzes in zwei Unterfächer teilen', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=4', '20261005T090000', 'VS Digitaltechnik') + '\r\n' + event('b', 'RRULE:FREQ=WEEKLY;COUNT=4', '20261006T090000', 'LP Digitaltechnik')));
  const choices = editableSubjects(events);
  const groups = combineSubjects(events, {}, [], choices.map(s => s.source), 'Digitaltechnik', 'group:one');
  const config = setPartitionDefault(configurePartition(events, {}, ['Theorie', 'Praxis']), 'Theorie');
  for (const item of events.filter(e => e.kind === 'Labor')) config.assignments[item.id] = 'Praxis';
  assert.equal(buildBuckets(events, { 'group:one': config }, { groups }).length, 1);
  const split = buildBuckets(events, { 'group:one': config }, { groups, mode: 'split' });
  assert.equal(split.length, 2);
  assert.deepEqual(split.map(b => b.total), [4, 4]);
  const extra = { ...events[0], id: 'third', source: 'VS Drittes Fach', defaultSubject: 'Drittes Fach' };
  const expanded = combineSubjects([...events, extra], {}, groups, ['group:one', extra.source], 'Alles', 'group:two');
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0].sources.length, 3);
  assert.equal(buildBuckets([...events, extra], {}, { groups: expanded })[0].total, 9);
});
test('Fehltermine außerhalb des Zeitraums werden nicht abgezogen', () => {
  const { events } = parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY;COUNT=10')));
  const absences = { [events[0].id]: true, [events[1].id]: true };
  const b = buildBuckets(events, {}, { from: events[2].date, absences })[0];
  assert.equal(b.absent, 0); assert.equal(b.total, 8);
});
test('ganztägige Termine und UTC bleiben am Kalendertag', () => {
  const { events } = parseCalendar(calendar('BEGIN:VEVENT\r\nUID:day\r\nDTSTART;VALUE=DATE:20261001\r\nSUMMARY:Seminar\r\nEND:VEVENT\r\n' + event('utc', '', '20261001T233000Z')));
  assert.equal(events.length, 2); assert.equal(events[0].allDay, true); assert.equal(events[1].date, '2026-10-01'); assert.equal(events[1].time, '23:30');
});
test('unbegrenzte und zu häufige Serien werden mit Erklärung abgelehnt', () => {
  assert.throws(() => parseCalendar(calendar(event('a', 'RRULE:FREQ=WEEKLY'))), /kein Enddatum/);
  assert.throws(() => parseCalendar(calendar(event('a', 'RRULE:FREQ=MINUTELY;COUNT=30'))), /häufigere/);
  assert.throws(() => parseCalendar('Keine ICS-Datei'), /keine gültige/);
});
test('beliebige Fachnamen lesen keine geerbten Objektwerte', () => {
  const { events } = parseCalendar(calendar(event('a', '', '20261005T090000', '__proto__')));
  assert.equal(buildBuckets(events)[0].subject, '__proto__');
});
if (process.env.CALENDAR_FIXTURE) test('echter Stundenplan: Import und Budget stimmen mit Originalblöcken überein', async () => {
  const text = await readFile(process.env.CALENDAR_FIXTURE, 'utf8');
  const rawCount = (text.match(/^BEGIN:VEVENT\r?$/gm) || []).length;
  const { events } = parseCalendar(text);
  assert.equal(events.length, rawCount);
  assert.equal(events.length, 353);
  const course = buildBuckets(events).find(b => b.subject === 'Nutzerinterakt. u. relation. Datenb.');
  assert.equal(course.total, 44); assert.equal(course.allowed, 13);
  assert.equal(events.filter(e => e.exam).length, 8);
  assert.equal(splitSubjects(events).length, 12);
  assert.ok(splitSubjects(events).every(subject => !events.find(e => e.source === subject.source).exam));
});
