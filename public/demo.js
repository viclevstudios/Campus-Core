// Frei erfundene Beispiele, keine Daten aus dem persönlichen Kalender.
export function demoCalendar() {
  const definitions = [
    ['Algorithmen und Datenstrukturen', 20, 1, '09:00', '10:30', 'Seminarraum 2.12'],
    ['Analysis', 18, 2, '08:00', '09:30', 'Hörsaal A'],
    ['Betriebssysteme', 16, 3, '10:00', '11:30', 'Seminarraum 1.08'],
    ['Digitaltechnik und Rechnerarchitektur', 22, 4, '12:00', '13:30', 'Labor 3.04'],
    ['Fachenglisch und Kommunikation', 12, 1, '14:00', '15:30', 'Seminarraum 2.10'],
    ['Python', 15, 5, '09:00', '10:30', 'Computerpool']
  ];
  const events = [], settings = {};
  for (const [index, [title, count, weekday, time, endTime, location]] of definitions.entries()) {
    const source = 'VS ' + title;
    const assignments = {};
    for (let i = 0; i < count; i++) {
      const dt = new Date(Date.UTC(2026, 9, 5 + weekday - 1 + Math.floor(i / 2) * 7));
      const date = dt.toISOString().slice(0, 10);
      const hour = i % 2 ? String(Number(time.slice(0, 2)) + 2).padStart(2, '0') + ':00' : time;
      const uid = `demo-${index}-${i}`;
      const id = JSON.stringify([uid, `${date}T${hour}:00`]);
      events.push({ id, uid, source, title, defaultSubject: title, kind: 'Lehrveranstaltung', exam: false, date, time: hour, endDate: date, endTime: i % 2 ? String(Number(hour.slice(0, 2)) + 1).padStart(2, '0') + ':30' : endTime, location, timezone: 'Europe/Berlin', allDay: false });
      if (index === 4) assignments[id] = i % 2 ? 'Kommunikation' : 'Englisch';
    }
    if (index === 4) settings[source] = { subject: title, parts: ['Englisch', 'Kommunikation'], assignments };
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return { events, settings };
}
