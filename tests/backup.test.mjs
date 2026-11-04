import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, createBackup, parseBackup, restoreAttendance, backupSummary, BACKUP_LIMIT } from '../public/backup.js';
import { demoCalendar } from '../public/demo.js';
import { buildBuckets, combineSubjects, STORAGE_KEY } from '../public/core.js';

function example() {
  const state = { ...freshState(), ...demoCalendar(), filename: 'Stundenplan.ics', mode: 'split', period: 'custom', from: '2026-10-05', to: '2027-03-28', preferences: { attendanceRate: 0.8 } };
  state.absences[state.events[0].id] = true;
  state.absences[state.events[2].id] = true;
  const source = 'VS Fachenglisch und Kommunikation';
  state.settings[source].defaultPart = 'Englisch';
  delete state.settings[source].assignments[state.events.find(e => e.source === source).id];
  state.groups = combineSubjects(state.events, state.settings, [], ['VS Algorithmen und Datenstrukturen', 'VS Digitaltechnik und Rechnerarchitektur'], 'Grundlagen', 'group:test');
  const bucket = buildBuckets(state.events, state.settings, state)[0];
  state.excluded[bucket.key] = true;
  return state;
}
const encode = state => JSON.stringify(createBackup(state, new Date('2026-11-04T12:00:00Z')));
const budget = state => buildBuckets(state.events, state.settings, state).map(b => ({ key: b.key, total: b.total, absent: b.absent, remaining: b.remaining, excluded: Boolean(state.excluded[b.key]) }));

test('Export und Import erhalten Kalender, Fehlmarkierungen, Gruppen, Aufteilungen und Budgets', () => {
  const state = example(), before = structuredClone(state);
  const backup = parseBackup(encode(state));
  assert.equal(backup.exportedAt, '2026-11-04T12:00:00.000Z');
  assert.deepEqual(backup.attendance, state);
  assert.deepEqual(budget(backup.attendance), budget(state));
  assert.deepEqual(state, before);
  assert.deepEqual(backupSummary(backup.attendance), { events: 103, absences: 2, subjects: 6, groups: 1, filename: 'Stundenplan.ics' });
});
test('auch ein leerer Kalender mit eigener Quote lässt sich sichern', () => {
  const state = freshState(); state.preferences.attendanceRate = 0.75;
  assert.deepEqual(parseBackup(encode(state)).attendance, state);
});
test('Dateiformat und Sicherungsversion werden vor der Datenübernahme geprüft', () => {
  assert.throws(() => parseBackup('{kaputt'), /gültiges JSON/);
  assert.throws(() => parseBackup('BEGIN:VCALENDAR'), /gültiges JSON/);
  assert.throws(() => parseBackup(JSON.stringify(freshState())), /keine Campus-Core/);
  assert.throws(() => parseBackup('null'), /keine Campus-Core/);
  const backup = JSON.parse(encode(example()));
  backup.version = 2;
  assert.throws(() => parseBackup(JSON.stringify(backup)), /Sicherungsversion/);
  backup.version = 1; backup.exportedAt = 'kein Datum';
  assert.throws(() => parseBackup(JSON.stringify(backup)), /ungültige/);
});
test('ungültige Termine, doppelte IDs, Quoten und Datumsbereiche werden zurückgewiesen', () => {
  const mutations = [
    s => { s.events.push(s.events[0]); },
    s => { s.events[0].date = '2026-02-30'; },
    s => { s.events[0].time = '25:10'; },
    s => { s.events[0].id = 'toString'; },
    s => { s.events[0].uid = 'anderer Termin'; },
    s => { s.events[0].source = {}; },
    s => { s.preferences.attendanceRate = 70; },
    s => { s.to = '2025-01-01'; },
    s => { s.settings['VS Python'] = { parts: [null, 'B'] }; },
    s => { s.absences[s.events[0].id] = 'true'; },
    s => { s.groups.push(s.groups[0]); },
    s => { s.mode = 'unbekannt'; }
  ];
  for (const mutate of mutations) {
    const backup = JSON.parse(encode(example())); mutate(backup.attendance);
    assert.throws(() => parseBackup(JSON.stringify(backup)), /ungültige/);
  }
});
test('große Dateien werden vor dem JSON-Parsing abgefangen; BOM wird unterstützt', () => {
  assert.throws(() => parseBackup(' '.repeat(BACKUP_LIMIT + 1)), /20 MB/);
  assert.equal(parseBackup('\uFEFF' + encode(example())).attendance.events.length, 103);
});
test('fremde Felder werden nicht importiert und Fachnamen verändern keine Objektprototypen', () => {
  const backup = JSON.parse(encode(example()));
  backup.localStorage = { secret: 'nicht übernehmen' };
  backup.attendance.script = '<script>test</script>';
  backup.attendance.settings = JSON.parse('{"__proto__":{"subject":"Eigenes Fach","polluted":true}}');
  const state = parseBackup(JSON.stringify(backup)).attendance;
  assert.equal(Object.hasOwn(state.settings, '__proto__'), true);
  assert.equal(state.settings.__proto__.subject, 'Eigenes Fach');
  assert.equal(Object.getPrototypeOf(state.settings), Object.prototype);
  assert.equal(Object.hasOwn(state, 'script'), false);
  assert.equal(Object.hasOwn(state.settings.__proto__, 'polluted'), false);
  assert.equal({}.polluted, undefined);
});
test('alte Sicherungen ohne neue optionale Felder erhalten sinnvolle Vorgaben', () => {
  const backup = JSON.parse(encode(freshState()));
  for (const key of ['groups', 'preferences', 'includeExams', 'absences', 'excluded']) delete backup.attendance[key];
  assert.deepEqual(parseBackup(JSON.stringify(backup)).attendance, freshState());
});
test('Import schreibt genau einen Speichereintrag und lässt andere App-Einstellungen bestehen', () => {
  const values = new Map([['campusplan.theme', 'dark'], ['campuscore.mensa.v1', '{"canteenId":69}']]);
  const storage = { setItem: (key, value) => values.set(key, value) };
  const imported = restoreAttendance(storage, parseBackup(encode(example())).attendance);
  assert.equal(values.size, 3);
  assert.equal(values.get('campusplan.theme'), 'dark');
  assert.equal(values.get('campuscore.mensa.v1'), '{"canteenId":69}');
  assert.deepEqual(JSON.parse(values.get(STORAGE_KEY)), imported);
});
test('fehlgeschlagener oder ungültiger Import ersetzt den bisherigen Zustand nicht', () => {
  const original = example();
  let current = original, writes = 0;
  const blocked = { setItem() { writes++; throw new Error('QuotaExceeded'); } };
  assert.throws(() => { current = restoreAttendance(blocked, freshState()); }, /QuotaExceeded/);
  assert.equal(current, original);
  assert.equal(writes, 1);
  const storage = { setItem() { writes++; } };
  assert.throws(() => { current = restoreAttendance(storage, { ...freshState(), version: 9 }); }, /ungültige/);
  assert.equal(current, original);
  assert.equal(writes, 1);
});
