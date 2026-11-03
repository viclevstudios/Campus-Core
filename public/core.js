import ICAL from './vendor/ical.js';

export const STORAGE_KEY = 'freiraum.v1';
const pad = n => String(n).padStart(2, '0');
const day = t => `${t.year}-${pad(t.month)}-${pad(t.day)}`;
const clock = t => t.isDate ? '' : `${pad(t.hour)}:${pad(t.minute)}`;

export function attendance(total, absent = 0, quote = 0.7) {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(absent) || absent < 0 || absent > total) throw new RangeError('Ungültige Terminanzahl');
  if (!Number.isFinite(quote) || quote < 0 || quote > 1) throw new RangeError('Die Anwesenheitsquote muss zwischen 0 und 1 liegen.');
  // Fixed-point arithmetic keeps decimal percentage settings exact at six places.
  const required = Math.ceil(total * Math.round(quote * 1000000) / 1000000);
  const allowed = total - required;
  return { total, required, allowed, absent, remaining: allowed - absent, over: Math.max(0, absent - allowed), percent: total ? (total - absent) * 100 / total : 0 };
}

export function classify(summary) {
  const name = summary.replace(/\s+/g, ' ').trim();
  const match = /^(VS|VL|VO|SE|UE|Ü|LP|P)\s+(.+)$/i.exec(name);
  const prefix = match?.[1].toUpperCase() || '';
  const title = match?.[2] || name;
  const exam = prefix === 'P' || /^(Prüfung|Klausur|Exam)\b/i.test(name);
  const kind = exam ? 'Prüfung' : prefix === 'LP' ? 'Labor' : prefix === 'UE' || prefix === 'Ü' ? 'Übung' : prefix === 'SE' ? 'Seminar' : 'Lehrveranstaltung';
  return { title, exam, kind, defaultSubject: title + (kind === 'Labor' || kind === 'Übung' || exam ? ` · ${kind}` : '') };
}

export function parseCalendar(text) {
  if (typeof text !== 'string' || !/^BEGIN:VCALENDAR\s*$/im.test(text.trim().replace(/^\uFEFF/, '')) || !/^END:VCALENDAR\s*$/im.test(text)) throw new Error('Das ist keine gültige ICS-Kalenderdatei. Bitte exportiere deinen Kalender im .ics-Format.');
  const calendar = new ICAL.Component(ICAL.parse(text.trim().replace(/^\uFEFF/, '')));
  if (calendar.name !== 'vcalendar') throw new Error('Kein gültiger Kalender gefunden.');
  ICAL.TimezoneService.reset();
  for (const tz of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
  const components = calendar.getAllSubcomponents('vevent');
  if (!components.length) throw new Error('Die Datei enthält keine Termine (VEVENT).');
  if (components.length > 20000) throw new Error('Dieser Kalender ist zu groß. Bitte exportiere einen einzelnen Studienzeitraum.');

  // Calendar exports can contain several revisions of one UID. Keep the newest.
  const revisions = new Map();
  for (const comp of components) {
    const uid = comp.getFirstPropertyValue('uid');
    if (!uid) throw new Error('Ein Termin hat keine UID. Bitte exportiere den Stundenplan erneut.');
    const key = `${uid}|${comp.getFirstPropertyValue('recurrence-id')?.toString() || ''}`;
    const previous = revisions.get(key);
    const rank = c => [Number(c.getFirstPropertyValue('sequence') || 0), String(c.getFirstPropertyValue('last-modified') || c.getFirstPropertyValue('dtstamp') || '')];
    const a = rank(comp), b = previous ? rank(previous) : [-1, ''];
    if (!previous || a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1])) revisions.set(key, comp);
  }
  const masters = new Map(), exceptions = new Map();
  for (const comp of revisions.values()) {
    const uid = comp.getFirstPropertyValue('uid');
    if (comp.hasProperty('recurrence-id')) { if (!exceptions.has(uid)) exceptions.set(uid, []); exceptions.get(uid).push(comp); }
    else masters.set(uid, comp);
  }
  const events = new Map();
  let cancelled = 0, iterations = 0;
  function emit(item, start, end, uid, recurrence, master = item) {
    if (item.component.getFirstPropertyValue('status') === 'CANCELLED') { cancelled++; return; }
    if (!start || start.year < 1900 || start.year > 2200 || start.month < 1 || start.month > 12 || start.day < 1 || start.day > 31) throw new Error('Ein Termin hat ein ungültiges Startdatum.');
    const summary = String(item.summary || master.summary || 'Ohne Fachbezeichnung').replace(/\s+/g, ' ').trim();
    const id = JSON.stringify([uid, recurrence || start.toString()]);
    events.set(id, { id, uid, source: summary, ...classify(summary), date: day(start), time: clock(start), endDate: end ? day(end) : day(start), endTime: end ? clock(end) : '', allDay: start.isDate, location: String(item.location || master.location || ''), timezone: start.zone?.tzid || 'floating' });
    if (events.size > 30000) throw new Error('Mehr als 30.000 Termine. Bitte beschränke den Kalender auf deinen Studienzeitraum.');
  }
  for (const [uid, comp] of masters) {
    if (comp.getFirstPropertyValue('status') === 'CANCELLED') { cancelled++; continue; }
    if (!comp.hasProperty('dtstart')) throw new Error('Ein Termin enthält kein Startdatum. Bitte exportiere den Kalender erneut.');
    const event = new ICAL.Event(comp, { exceptions: exceptions.get(uid) || [] });
    if (event.isRecurring()) {
      for (const prop of comp.getAllProperties('rrule')) {
        const rule = prop.getFirstValue();
        if (!rule.count && !rule.until) throw new Error('Eine Terminserie hat kein Enddatum. Bitte begrenze den Kalenderexport auf dein Semester (RRULE mit UNTIL oder COUNT).');
        if (['SECONDLY', 'MINUTELY', 'HOURLY'].includes(rule.freq)) throw new Error('Stündliche oder häufigere Terminserien werden nicht unterstützt. Bitte exportiere einzelne Unterrichtsblöcke.');
      }
      const iter = event.iterator();
      let occurrence;
      while ((occurrence = iter.next())) {
        if (++iterations > 50000) throw new Error('Zu viele Wiederholungen. Bitte beschränke den Kalenderexport auf ein Semester.');
        const direct = event.exceptions[occurrence.toString()] || event.exceptions[occurrence.convertToZone(ICAL.Timezone.utcTimezone).toString()];
        const exception = direct || event.exceptions[event.findRangeException(occurrence)];
        if (exception?.component.getFirstPropertyValue('status') === 'CANCELLED') { cancelled++; continue; }
        const details = event.getOccurrenceDetails(occurrence);
        emit(details.item, details.startDate, details.endDate, uid, occurrence.toString(), event);
      }
    } else emit(event, event.startDate, event.endDate, uid);
  }
  // Detached exceptions may be exported without the original series.
  for (const [uid, comps] of exceptions) if (!masters.has(uid)) for (const comp of comps) {
    if (comp.getFirstPropertyValue('status') === 'CANCELLED') { cancelled++; continue; }
    const event = new ICAL.Event(comp);
    emit(event, event.startDate, event.endDate, uid, event.recurrenceId.toString());
  }
  const list = [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.source.localeCompare(b.source, 'de'));
  if (!list.length) throw new Error('Der Kalender enthält keine aktiven Termine.');
  return { events: list, cancelled, first: list[0].date, last: list.at(-1).date };
}

export function splitSubjects(events) {
  const subjects = new Map();
  for (const event of events) {
    if (event.exam || event.kind === 'Prüfung' || classify(event.source).exam) continue;
    if (!subjects.has(event.source)) subjects.set(event.source, { source: event.source, title: event.defaultSubject || classify(event.source).defaultSubject });
  }
  return [...subjects.values()].sort((a, b) => a.title.localeCompare(b.title, 'de') || a.source.localeCompare(b.source, 'de'));
}

export function subjectPartition(events, config = {}) {
  const parts = Array.isArray(config.parts) ? config.parts.map(p => String(p).trim()) : [];
  const configured = parts.length === 2 && parts.every(Boolean) && parts[0].toLocaleLowerCase('de') !== parts[1].toLocaleLowerCase('de');
  const enabled = configured && config.splitEnabled !== false;
  const assignments = config.assignments || {};
  const assigned = configured ? events.filter(e => parts.includes(assignments[e.id])).length : 0;
  const emptyParts = configured ? parts.filter(part => !events.some(e => assignments[e.id] === part)) : [];
  return { parts: configured ? parts : [], configured, enabled, assigned, total: events.length, unassigned: events.length - assigned, emptyParts, complete: enabled && events.length > 0 && assigned === events.length && !emptyParts.length };
}

export function configurePartition(events, config, names) {
  const candidate = subjectPartition(events, { parts: names });
  if (!candidate.configured) throw new Error('Bitte zwei unterschiedliche Namen für die Unterfächer eingeben.');
  const previous = Array.isArray(config.parts) ? config.parts : [];
  const assignments = {};
  for (const event of events) {
    const value = config.assignments?.[event.id];
    const index = previous.indexOf(value);
    if (index === 0 || index === 1) assignments[event.id] = candidate.parts[index];
    else if (candidate.parts.includes(value)) assignments[event.id] = value;
  }
  return { ...config, parts: candidate.parts, assignments, splitEnabled: true };
}

export function buildBuckets(events, settings = {}, options = {}) {
  const { from = '', to = '', includeExams = false, mode = 'joined', absences = {}, preferences = {} } = options;
  const buckets = new Map();
  const bySource = new Map();
  for (const event of events) {
    if (!bySource.has(event.source)) bySource.set(event.source, []);
    bySource.get(event.source).push(event);
  }
  const partitions = new Map([...bySource].map(([source, list]) => [source, subjectPartition(list, Object.hasOwn(settings, source) ? settings[source] : {})]));
  for (const event of events) {
    if ((from && event.date < from) || (to && event.date > to) || (!includeExams && event.exam)) continue;
    const config = Object.hasOwn(settings, event.source) ? settings[event.source] : {};
    const subject = config.subject?.trim() || event.defaultSubject;
    const partition = partitions.get(event.source);
    const separate = mode === 'split' && partition.complete;
    const part = separate ? config.assignments[event.id] : '';
    const key = JSON.stringify(separate ? [subject, part] : [subject]);
    if (!buckets.has(key)) buckets.set(key, { key, subject, part, splitPending: false, events: [], sources: new Set(), parts: new Set(), kinds: new Set() });
    const bucket = buckets.get(key);
    bucket.splitPending ||= mode === 'split' && partition.enabled && !partition.complete;
    bucket.events.push(event); bucket.sources.add(event.source); bucket.parts.add(part); bucket.kinds.add(event.kind);
  }
  return [...buckets.values()].map(bucket => ({ ...bucket, ...attendance(bucket.events.length, bucket.events.filter(e => absences[e.id]).length, preferences.attendanceRate ?? 0.7) })).sort((a, b) => a.subject.localeCompare(b.subject, 'de') || a.part.localeCompare(b.part, 'de'));
}

export function semesterOptions(events) {
  if (!events.length) return [];
  const years = events.map(e => Number(e.date.slice(0, 4)));
  const result = [];
  for (let y = Math.min(...years) - 1; y <= Math.max(...years); y++) {
    for (const item of [
      { id: `summer-${y}`, label: `Sommersemester ${y}`, from: `${y}-04-01`, to: `${y}-09-30` },
      { id: `winter-${y}`, label: `Wintersemester ${y}/${String(y + 1).slice(-2)}`, from: `${y}-10-01`, to: `${y + 1}-03-31` }
    ]) if (events.some(e => e.date >= item.from && e.date <= item.to)) result.push(item);
  }
  return result;
}
