import { classify, splitSubjects, STORAGE_KEY } from './core.js';

export const BACKUP_LIMIT = 20 * 1024 * 1024;
export const freshState = () => ({ version: 1, events: [], settings: {}, groups: [], absences: {}, excluded: {}, filename: '', demo: false, mode: 'joined', from: '', to: '', period: 'all', includeExams: false, preferences: { attendanceRate: 0.7 } });
const invalid = () => { throw new Error('Die Sicherung enthält ungültige Anwesenheitsdaten.'); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, max = 100000) {
  if (typeof value !== 'string' || value.length > max) invalid();
  return value;
}
function flag(value) { if (typeof value !== 'boolean') invalid(); return value; }
function date(value, empty = false) {
  if (empty && value === '') return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid();
  return value;
}
function time(value) {
  if (typeof value !== 'string' || (value !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) invalid();
  return value;
}
function dictionary(value, validate) {
  if (!record(value)) invalid();
  // fromEntries defines own properties, including literal subject names such as
  // __proto__. Never merge untrusted dictionary keys into an existing object.
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [text(key), validate(item)]));
}

export function validateAttendance(value) {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.events) || value.events.length > 30000) invalid();
  const initial = freshState(), ids = new Set();
  const events = value.events.map(event => {
    if (!record(event)) invalid();
    const id = text(event.id), source = text(event.source);
    if (!source.trim() || ids.has(id)) invalid();
    let identity;
    try { identity = JSON.parse(id); } catch { invalid(); }
    if (!Array.isArray(identity) || identity.length !== 2 || !identity.every(v => typeof v === 'string' && v.length > 0)) invalid();
    ids.add(id);
    const classified = classify(source);
    const uid = event.uid === undefined ? identity[0] : text(event.uid);
    if (uid !== identity[0]) invalid();
    const startDate = date(event.date);
    return {
      id, uid, source,
      title: text(event.title ?? classified.title),
      defaultSubject: text(event.defaultSubject ?? classified.defaultSubject),
      kind: text(event.kind ?? classified.kind),
      exam: event.exam === undefined ? classified.exam : flag(event.exam),
      date: startDate, time: time(event.time ?? ''),
      endDate: date(event.endDate ?? startDate), endTime: time(event.endTime ?? ''),
      allDay: event.allDay === undefined ? !event.time : flag(event.allDay),
      location: text(event.location ?? ''), timezone: text(event.timezone ?? 'floating')
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.source.localeCompare(b.source, 'de'));
  const settings = dictionary(value.settings ?? {}, config => {
    if (!record(config)) invalid();
    const result = {};
    if (config.subject !== undefined) result.subject = text(config.subject);
    if (config.parts !== undefined) {
      if (!Array.isArray(config.parts) || config.parts.length > 100) invalid();
      result.parts = config.parts.map(part => text(part));
    }
    if (config.assignments !== undefined) result.assignments = dictionary(config.assignments, part => text(part));
    if (config.splitEnabled !== undefined) result.splitEnabled = flag(config.splitEnabled);
    if (config.defaultPart !== undefined) {
      result.defaultPart = text(config.defaultPart);
      if (result.defaultPart && !result.parts?.includes(result.defaultPart)) invalid();
    }
    return result;
  });
  const groupIds = new Set(), groupedSources = new Set(), eventSources = new Set(events.map(e => e.source));
  if (value.groups !== undefined && !Array.isArray(value.groups)) invalid();
  const groups = (value.groups ?? []).map(group => {
    if (!record(group) || !Array.isArray(group.sources) || !group.sources.length) invalid();
    const id = text(group.id), name = text(group.name);
    if (!id || !name.trim() || groupIds.has(id) || eventSources.has(id)) invalid();
    groupIds.add(id);
    const sources = group.sources.map(source => {
      text(source);
      if (!source.trim() || groupedSources.has(source)) invalid();
      groupedSources.add(source);
      return source;
    });
    return { id, name, sources };
  });
  const from = date(value.from ?? '', true), to = date(value.to ?? '', true);
  if (from && to && from > to) invalid();
  const mode = value.mode ?? initial.mode, period = value.period ?? initial.period;
  if (!['joined', 'split'].includes(mode) || typeof period !== 'string' || !/^(all|custom|(summer|winter)-\d{4})$/.test(period)) invalid();
  const preferences = value.preferences ?? initial.preferences;
  if (!record(preferences) || !Number.isFinite(preferences.attendanceRate) || preferences.attendanceRate < 0 || preferences.attendanceRate > 1) invalid();
  return {
    version: 1, events, settings, groups,
    absences: dictionary(value.absences ?? {}, flag), excluded: dictionary(value.excluded ?? {}, flag),
    filename: text(value.filename ?? '', 1024), demo: value.demo === undefined ? false : flag(value.demo),
    mode, from, to, period, includeExams: value.includeExams === undefined ? false : flag(value.includeExams),
    preferences: { attendanceRate: preferences.attendanceRate }
  };
}

export function createBackup(state, now = new Date()) {
  return { format: 'campus-core-backup', version: 1, exportedAt: now.toISOString(), attendance: validateAttendance(state) };
}

export function parseBackup(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > BACKUP_LIMIT) throw new Error('Die Sicherung darf maximal 20 MB groß sein.');
  let backup;
  try { backup = JSON.parse(content.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Die Datei enthält kein gültiges JSON. Bitte wähle eine Campus-Core-Sicherung.'); }
  if (!record(backup) || backup.format !== 'campus-core-backup') throw new Error('Das ist keine Campus-Core-Sicherung. Bitte wähle eine exportierte JSON-Datei.');
  if (backup.version !== 1) throw new Error('Diese Sicherungsversion wird nicht unterstützt.');
  if (typeof backup.exportedAt !== 'string' || backup.exportedAt.length > 100 || !Number.isFinite(Date.parse(backup.exportedAt))) invalid();
  return { exportedAt: backup.exportedAt, attendance: validateAttendance(backup.attendance) };
}

export function backupSummary(state) {
  return {
    events: state.events.length,
    absences: state.events.filter(e => state.absences[e.id] === true).length,
    subjects: splitSubjects(state.events).length,
    groups: state.groups.length,
    filename: state.filename || 'Kein Kalender geladen'
  };
}

export function restoreAttendance(storage, state) {
  const validated = validateAttendance(state);
  // Commit a single localStorage entry before replacing the in-memory state.
  // A quota/access error leaves the running app's current data untouched.
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}
