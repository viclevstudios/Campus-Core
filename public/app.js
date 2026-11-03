import { buildBuckets, semesterOptions, subjectPartition, configurePartition, editableSubjects, combineSubjects, partitionPart, setPartitionDefault, STORAGE_KEY } from './core.js';
import { demoCalendar } from './demo.js';
import { mountSubjectPicker } from './subject-picker.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  utensils: '<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-6 8 0 9"/>',
  campus: '<path d="m3 9 9-6 9 6M4 10h16M4 21h16M6 10v11M12 10v11M18 10v11"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5v.1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/>',
  coffee: '<path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 0h2a3 3 0 0 1 0 6h-2M7 3v2M12 3v2M2 22h18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sliders: '<path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h3m4 0h9"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  book: '<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.book}</svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
icons();

const freshState = () => ({ version: 1, events: [], settings: {}, groups: [], absences: {}, excluded: {}, filename: '', demo: false, mode: 'joined', from: '', to: '', period: 'all', includeExams: false, preferences: { attendanceRate: 0.7 } });
let state = freshState(), storageAvailable = true, buckets = [], activeBucketKey = '', manageSource = '', importing = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved?.version === 1 && Array.isArray(saved.events) && saved.events.every(e => typeof e.id === 'string' && typeof e.date === 'string' && typeof e.source === 'string')) state = { ...freshState(), ...saved };
} catch { storageAvailable = false; }

if (!Number.isFinite(state.preferences?.attendanceRate) || state.preferences.attendanceRate < 0 || state.preferences.attendanceRate > 1) state.preferences = { attendanceRate: 0.7 };
if (!Array.isArray(state.groups)) state.groups = [];
const subjectChoices = () => editableSubjects(state.events, state.settings, state.groups);

function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); $('message').hidden = !text; }
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; message('Dein Browser kann die Daten gerade nicht lokal speichern. Du kannst weiterrechnen; beim Neuladen gehen Änderungen verloren.', true); }
}
function rangeValid() {
  const valid = !(state.from && state.to && state.from > state.to);
  $('to').setCustomValidity(valid ? '' : 'Das Enddatum muss am oder nach dem Startdatum liegen.');
  return valid;
}
function periodControls() {
  $('period').innerHTML = '<option value="all">Gesamter Kalender</option>' + semesterOptions(state.events).map(p => `<option value="${p.id}">${escape(p.label)}</option>`).join('') + '<option value="custom">Eigener Zeitraum</option>';
  $('period').value = state.period;
  if (!$('period').value) $('period').value = 'custom';
  $('from').value = state.from; $('to').value = state.to; $('include-exams').checked = state.includeExams;
}
function chooseInitialPeriod() {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const current = semesterOptions(state.events).find(p => date >= p.from && date <= p.to);
  state.period = current?.id || 'all';
  state.from = current?.from || state.events[0]?.date || '';
  state.to = current?.to || state.events.at(-1)?.date || '';
}
function uploadStatus() {
  const loaded = state.events.length > 0;
  $('dropzone').hidden = loaded;
  $('upload-description').textContent = loaded ? `${state.filename} · ${state.events.length} Termine${state.demo ? ' (Beispiel)' : ''}` : 'Kein Kalender geladen';
  $('upload-label').textContent = loaded ? 'Datei wechseln' : 'Datei auswählen';
  $('manage-button').disabled = !subjectChoices().length;
  $('merge-button').disabled = subjectChoices().length < 2 && !state.groups.length;
  $('reset-button').hidden = !loaded;
}
function render() {
  uploadStatus();
  const valid = rangeValid();
  buckets = valid ? buildBuckets(state.events, state.settings, state) : [];
  const included = buckets.filter(b => !state.excluded[b.key]);
  for (const [id, property] of [['stat-free', 'remaining'], ['stat-planned', 'absent'], ['stat-events', 'total']]) {
    $(id).textContent = state.events.length ? included.reduce((n, b) => n + b[property], 0) : '–';
  }
  for (const [id, mode] of [['mode-joined', 'joined'], ['mode-split', 'split']]) {
    $(id).classList.toggle('selected', state.mode === mode);
    $(id).setAttribute('aria-pressed', String(state.mode === mode));
  }
  $('subject-column').textContent = state.mode === 'split' ? 'Fach / Unterfach' : 'Fach';
  const percent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(state.preferences.attendanceRate * 100);
  $('rule-label').textContent = `Pflicht: mindestens ${percent} % je Fach`;
  $('rule-rate').textContent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(state.preferences.attendanceRate);
  $('attendance-rate').value = state.preferences.attendanceRate * 100;
  $('search-field').hidden = buckets.length <= 8;
  if (buckets.length <= 8) $('search').value = '';
  const query = $('search').value.trim().toLocaleLowerCase('de');
  const visible = buckets.filter(b => `${b.subject} ${b.part}`.toLocaleLowerCase('de').includes(query));
  $('table-scroll').hidden = !buckets.length;
  $('scroll-hint').hidden = !buckets.length;
  $('empty-state').hidden = buckets.length > 0;
  $('empty-state').textContent = !state.events.length ? 'Kein Stundenplan geladen.' : !valid ? 'Das Enddatum muss am oder nach dem Startdatum liegen.' : 'Keine Termine im gewählten Zeitraum.';
  $('course-grid').innerHTML = visible.map(b => {
    const index = buckets.indexOf(b);
    const title = b.part || b.subject;
    const types = b.kinds.size > 1 ? ` · ${[...b.kinds].join(', ')}` : '';
    const status = b.remaining <= 0 ? 'bad' : b.remaining <= 2 ? 'warning' : '';
    return `<tr class="${state.excluded[b.key] ? 'unselected' : ''}" data-bucket="${index}">
      <td><label class="include-label"><input class="course-select" type="checkbox" ${state.excluded[b.key] ? '' : 'checked'} aria-label="Fach einbeziehen: ${escape(title)}"></label></td>
      <td><span class="subject-name" id="subject-name-${index}">${escape(title)}</span><span class="subject-meta">${b.total} ${b.total === 1 ? 'Termin' : 'Termine'}${escape(types)}</span>${b.part && b.part !== b.subject ? `<span class="course-parent">${escape(b.subject)}</span>` : ''}${b.splitPending ? '<span class="course-parent">Aufteilung noch unvollständig</span>' : ''}</td>
      <td><div class="progress-bar" role="img" aria-label="${b.required} Pflichttermine, ${b.absent} geplant, ${b.remaining} übrig"><span class="progress-required"></span><span class="progress-planned"></span><span class="progress-rest"></span></div><span class="progress-caption">${b.required} Pflicht · ${b.allowed} frei</span></td>
      <td class="numeric remaining ${status}">${b.remaining}</td>
      <td class="numeric">${b.absent}</td>
      <td><button class="events-button" aria-label="Termine ansehen" aria-describedby="subject-name-${index}">${icon('chevron')}</button></td>
    </tr>`;
  }).join('');
  for (const row of $('course-grid').querySelectorAll('[data-bucket]')) {
    const b = buckets[Number(row.dataset.bucket)];
    // When over budget, planned absences keep their actual share; the achievable
    // attendance segment shrinks. The negative budget exposes the shortfall.
    const portions = [Math.min(b.required, b.total - b.absent), b.absent, Math.max(0, b.remaining)];
    ['.progress-required', '.progress-planned', '.progress-rest'].forEach((selector, i) => {
      row.querySelector(selector).style.width = `${portions[i] / b.total * 100}%`;
    });
  }
  if (buckets.length && !visible.length) $('course-grid').innerHTML = '<tr class="empty-table-row"><td colspan="6">Keine Fächer für diese Suche gefunden.</td></tr>';
}

function readInWorker(text) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./calendar-worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Der Kalender braucht zu lange zum Einlesen. Bitte exportiere einen kleineren Zeitraum.')); }, 12000);
    const finish = fn => value => { clearTimeout(timer); worker.terminate(); fn(value); };
    worker.onmessage = finish(({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.result));
    worker.onerror = finish(() => reject(new Error('Der Kalender konnte nicht verarbeitet werden. Bitte verwende einen aktuellen Browser und öffne die App über HTTP oder HTTPS.')));
    worker.postMessage(text);
  });
}
async function importFile(file) {
  if (!file || importing) return;
  if (file.size > 5 * 1024 * 1024) { message('Die Datei ist größer als 5 MB. Bitte exportiere einen kleineren Zeitraum.', true); return; }
  if (!/\.ics$/i.test(file.name)) { message('Bitte wähle eine Kalenderdatei mit der Endung .ics.', true); return; }
  importing = true; $('upload-button').disabled = true; $('demo-button').disabled = true; $('reset-button').disabled = true; $('upload-label').textContent = 'Kalender wird gelesen …'; message('');
  try {
    const result = await readInWorker(await file.text());
    if (state.demo) state = { ...freshState(), preferences: state.preferences };
    const ids = new Set(result.events.map(e => e.id));
    state = { ...state, events: result.events, filename: file.name, demo: false, absences: Object.fromEntries(Object.entries(state.absences).filter(([id]) => ids.has(id))) };
    state.excluded = {};
    chooseInitialPeriod(); periodControls(); save(); render();
    if (storageAvailable) message(`${result.events.length} Termine aus deinem Kalender eingelesen.${result.cancelled ? ` ${result.cancelled} abgesagte Einträge wurden ausgelassen.` : ''} Prüfungen sind standardmäßig ausgenommen. Semestergrenzen sind Vorschläge und lassen sich anpassen.`);
  } catch (error) { message(error.message || 'Die Datei konnte nicht gelesen werden.', true); }
  finally { importing = false; $('upload-button').disabled = false; $('demo-button').disabled = false; $('reset-button').disabled = false; $('file-input').value = ''; uploadStatus(); }
}
function loadDemo() {
  if (importing) return;
  const demo = demoCalendar();
  state = { ...freshState(), ...demo, demo: true, filename: 'Beispiel-Stundenplan.ics', preferences: state.preferences };
  chooseInitialPeriod(); periodControls(); save(); render();
  if (storageAvailable) message('Beispieldaten geladen. Für „Fachenglisch und Kommunikation“ ist eine manuelle Aufteilung vorbereitet. Mit „Pro Unterfach“ werden die Fehlbudgets getrennt berechnet.');
}
$('upload-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => importFile(event.target.files[0]));
$('demo-button').addEventListener('click', loadDemo);
let dragDepth = 0;
$('dropzone').addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; $('dropzone').classList.add('dragging'); });
$('dropzone').addEventListener('dragover', event => event.preventDefault());
$('dropzone').addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropzone').classList.remove('dragging'); } });
$('dropzone').addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('dropzone').classList.remove('dragging'); if (event.dataTransfer.files.length > 1) message('Bitte importiere jeweils eine ICS-Datei.', true); else importFile(event.dataTransfer.files[0]); });
// Avoid the browser navigating away when a file is dropped outside the target.
window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());
$('period').addEventListener('change', () => {
  state.period = $('period').value;
  const option = semesterOptions(state.events).find(p => p.id === state.period);
  if (option) { state.from = option.from; state.to = option.to; }
  else if (state.period === 'all') { state.from = state.events[0]?.date || ''; state.to = state.events.at(-1)?.date || ''; }
  periodControls(); save(); render();
});
for (const id of ['from', 'to']) $(id).addEventListener('change', () => { state[id] = $(id).value; state.period = 'custom'; $('period').value = 'custom'; save(); render(); if (!rangeValid()) $('to').reportValidity(); });
$('include-exams').addEventListener('change', () => { state.includeExams = $('include-exams').checked; save(); render(); });
$('search').addEventListener('input', render);
for (const [id, mode] of [['mode-joined', 'joined'], ['mode-split', 'split']]) $(id).addEventListener('click', () => { state.mode = mode; save(); render(); });
$('course-grid').addEventListener('change', event => {
  if (!event.target.matches('.course-select')) return;
  const b = buckets[Number(event.target.closest('[data-bucket]').dataset.bucket)];
  if (event.target.checked) delete state.excluded[b.key]; else state.excluded[b.key] = true;
  save(); render();
  const index = buckets.findIndex(item => item.key === b.key);
  $('course-grid').querySelector(`[data-bucket="${index}"] .course-select`)?.focus({ preventScroll: true });
});
$('course-grid').addEventListener('click', event => {
  const button = event.target.closest('.events-button');
  if (!button) return;
  activeBucketKey = buckets[Number(button.closest('[data-bucket]').dataset.bucket)].key;
  renderEvents(); $('events-dialog').showModal();
});
$('quote-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('attendance-rate').reportValidity()) return;
  state.preferences.attendanceRate = Number($('attendance-rate').value) / 100;
  save(); render();
});
$('rule-popover').addEventListener('beforetoggle', event => {
  if (event.newState !== 'open') return;
  const rect = $('formula-button').getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 32);
  $('rule-popover').style.left = `${Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16))}px`;
  $('rule-popover').style.top = `${Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 360))}px`;
  $('rule-popover').style.right = 'auto';
});
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
// Native selects can dispatch a click on the dialog after their popup closes.
// Use explicit close buttons or Escape to avoid dismissing an unfinished edit.

const formatDay = date => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const month = date => new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
function eventInfo(event) {
  return `<div class="event-date"><strong>${Number(event.date.slice(8))}</strong>${escape(month(event.date))}</div><div class="event-description"><strong>${escape(formatDay(event.date))} · ${event.allDay ? 'Ganztägig' : `${escape(event.time)}${event.endTime ? '–' + escape(event.endTime) : ''}`}</strong><small>${escape(event.location || 'Kein Raum angegeben')}${event.timezone === 'UTC' ? ' · UTC' : ''}</small></div>`;
}
function renderEvents() {
  const bucket = buckets.find(b => b.key === activeBucketKey);
  if (!bucket) return;
  $('events-title').textContent = bucket.part || bucket.subject;
  $('events-summary').textContent = `${bucket.absent} von ${bucket.allowed} erlaubten Fehlterminen · ${bucket.over ? `${bucket.over} zu viel` : `${bucket.remaining} verbleibend`} · Prognose: ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bucket.percent)} %`;
  $('events-body').innerHTML = `<div class="event-list"><p class="events-counter">${bucket.total} Termine im gewählten Zeitraum</p>${bucket.events.map((e, i) => `<div class="event-row">${eventInfo(e)}<label><input type="checkbox" data-absence="${i}" ${state.absences[e.id] ? 'checked' : ''}>Fehlen</label></div>`).join('')}</div>`;
}
$('events-body').addEventListener('change', event => {
  if (!event.target.matches('[data-absence]')) return;
  const bucket = buckets.find(b => b.key === activeBucketKey);
  const e = bucket.events[Number(event.target.dataset.absence)];
  if (event.target.checked) state.absences[e.id] = true; else delete state.absences[e.id];
  const focusedIndex = event.target.dataset.absence;
  save(); render(); renderEvents();
  $('events-body').querySelector(`[data-absence="${focusedIndex}"]`)?.focus({ preventScroll: true });
});

function sourceEvents() {
  const sources = subjectChoices().find(s => s.source === manageSource)?.sources || [];
  return state.events.filter(e => sources.includes(e.source));
}
function configFor() { return Object.hasOwn(state.settings, manageSource) ? state.settings[manageSource] : { parts: [], assignments: {} }; }
function storeConfig(config) {
  Object.defineProperty(state.settings, manageSource, { value: config, writable: true, enumerable: true, configurable: true });
}
function manageOpen() {
  const subjects = subjectChoices();
  if (!subjects.length) return;
  if (!subjects.some(subject => subject.source === manageSource)) manageSource = subjects[0].source;
  renderManage(); $('manage-dialog').showModal();
}
$('manage-button').addEventListener('click', manageOpen);
function renderManage(nameDraft = null, restorePickerFocus = false) {
  const subjects = subjectChoices();
  const config = configFor();
  const events = sourceEvents();
  const partition = subjectPartition(events, config);
  const names = nameDraft || (partition.configured ? partition.parts : ['', '']);
  $('manage-body').innerHTML = `<div class="manage-form">
    <p class="manage-info">Manche Fächer bestehen aus zwei Unterfächern, (z.B. Fachenglisch und Kommunikation). Falls deren Anwesenheit getrennt gezählt wird, kannst du sie manuell anlegen und ihre Termine zuordnen.</p>
    <div class="field-label"><label for="manage-source">Fach</label><div class="subject-picker" id="subject-picker"><span class="subject-picker-search" aria-hidden="true">${icon('search')}</span><input id="manage-source" type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="subject-options" aria-expanded="false" autocomplete="off" placeholder="Fach suchen oder auswählen"><button type="button" class="subject-picker-toggle" aria-label="Fächer anzeigen" aria-controls="subject-options" aria-expanded="false">${icon('chevron')}</button><div id="subject-options" class="subject-picker-list" role="listbox" aria-label="Fächer ohne Prüfungen" hidden></div></div></div>
    <form id="split-form">
      <div class="split-names"><label class="field-label">Unterfach 1<input id="split-name-1" value="${escape(names[0])}" placeholder="z. B. Englisch" maxlength="80" required></label><label class="field-label">Unterfach 2<input id="split-name-2" value="${escape(names[1])}" placeholder="z. B. Kommunikation" maxlength="80" required></label></div>
      <div class="split-actions"><button type="submit" class="button primary">Unterfächer speichern</button>${partition.enabled ? '<button type="button" id="split-disable" class="text-button">Aufteilung aufheben</button>' : ''}</div>
    </form>
    ${partition.enabled ? `<section class="split-assignment" aria-labelledby="split-assignment-title"><h3 id="split-assignment-title">Termine zuordnen</h3><p class="split-status" id="split-status" role="status"></p><div class="field-label split-default"><label for="split-default">Standard-Unterfach</label><select id="split-default" aria-describedby="split-default-note"><option value="">Kein Standard</option>${partition.parts.map(part => `<option value="${escape(part)}" ${config.defaultPart === part ? 'selected' : ''}>${escape(part)}</option>`).join('')}</select></div><p class="split-counts" id="split-counts"></p><div class="event-list split-events">${events.map((e, i) => `<div class="event-row">${eventInfo(e)}<select data-split-part="${i}" aria-label="Unterfach am ${escape(formatDay(e.date))}, ${escape(e.time)}"><option value="">Nicht zugeordnet</option>${partition.parts.map(part => `<option value="${escape(part)}" ${partitionPart(e, config) === part ? 'selected' : ''}>${escape(part)}</option>`).join('')}</select></div>`).join('')}</div></section>` : ''}
  </div>`;
  const picker = mountSubjectPicker($('subject-picker'), {
    subjects, selected: manageSource,
    onSelect(source) {
      const draft = [$('split-name-1').value, $('split-name-2').value];
      manageSource = source;
      renderManage(draft, true);
    }
  });
  $('split-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const updated = configurePartition(events, configFor(), [$('split-name-1').value, $('split-name-2').value]);
      $('split-name-2').setCustomValidity('');
      storeConfig(updated); save(); render(); renderManage();
      $('manage-body').querySelector('[data-split-part]')?.focus({ preventScroll: true });
    } catch (error) { $('split-name-2').setCustomValidity(error.message); $('split-name-2').reportValidity(); }
  });
  for (const id of ['split-name-1', 'split-name-2']) $(id).addEventListener('input', () => $('split-name-2').setCustomValidity(''));
  $('split-disable')?.addEventListener('click', () => {
    storeConfig({ ...configFor(), splitEnabled: false }); save(); render(); renderManage();
  });
  $('split-default')?.addEventListener('change', () => {
    const scrollTop = $('manage-dialog').scrollTop;
    storeConfig(setPartitionDefault(configFor(), $('split-default').value));
    save(); render(); renderManage([$('split-name-1').value, $('split-name-2').value]);
    $('split-default').focus({ preventScroll: true });
    $('manage-dialog').scrollTop = scrollTop;
  });
  $('manage-body').querySelectorAll('[data-split-part]').forEach(select => select.addEventListener('change', () => {
    const current = configFor();
    const assignments = { ...current.assignments };
    const id = events[Number(select.dataset.splitPart)].id;
    assignments[id] = select.value;
    storeConfig({ ...current, assignments }); save(); render(); updateSplitStatus();
  }));
  updateSplitStatus();
  if (restorePickerFocus) picker.focus();
}
function updateSplitStatus() {
  const events = sourceEvents();
  const config = configFor();
  const partition = subjectPartition(events, config);
  if (!$('split-status')) return;
  $('split-status').textContent = partition.complete ? 'Alle Termine sind zugeordnet. Mit „Pro Unterfach“ kannst du die beiden Fehlbudgets getrennt berechnen.' : partition.unassigned ? `Noch ${partition.unassigned} von ${partition.total} Terminen zuordnen. Bis dahin wird dieses Fach gemeinsam berechnet.` : `Noch keine Termine für ${partition.emptyParts.join(', ')}. Ordne beiden Unterfächern Termine zu, um getrennt zu rechnen.`;
  $('split-counts').textContent = partition.parts.map(part => `${part}: ${events.filter(e => partitionPart(e, config) === part).length} Termine`).join(' · ');
}

function renderMerge() {
  const subjects = subjectChoices();
  $('merge-body').innerHTML = `<div class="manage-form"><p class="manage-info">Wähle die Fächer, die gemeinsam berechnet werden sollen. Die Termine und Fehlmarkierungen bleiben erhalten.</p><form id="merge-form"><label class="field-label">Gemeinsamer Fachname<input id="merge-name" maxlength="120" required placeholder="z. B. Digitaltechnik und Rechnerarchitektur"></label><label class="search-field merge-search"><span>${icon('search')}</span><input id="merge-search" type="search" placeholder="Fächer suchen" aria-label="Fächer zum Zusammenfügen suchen"></label><fieldset class="merge-choices"><legend class="sr-only">Fächer auswählen</legend>${subjects.map((s, i) => `<label class="merge-choice" data-merge-row="${i}"><input type="checkbox" name="merge-subject" value="${escape(s.source)}"><span>${escape(s.title)}${s.grouped ? '<small>Zusammengefügt</small>' : ''}</span></label>`).join('')}</fieldset><p id="merge-empty" class="split-counts" hidden>Keine Fächer gefunden.</p><div class="merge-submit"><span id="merge-count" role="status">0 Fächer ausgewählt</span><button class="button primary" id="merge-save" type="submit" disabled>Zusammenfügen</button></div><p id="merge-error" class="message error" role="alert" hidden></p></form>${state.groups.length ? `<section class="split-assignment"><h3>Zusammengefügte Fächer</h3>${state.groups.map((group, i) => `<div class="merge-saved"><span>${escape(group.name)}<small>${group.sources.length} Kalenderfächer</small></span><button type="button" class="text-button" data-unmerge="${i}" aria-label="Verbindung für ${escape(group.name)} aufheben">Aufheben</button></div>`).join('')}</section>` : ''}</div>`;
  $('merge-search').addEventListener('input', () => {
    const query = $('merge-search').value.trim().toLocaleLowerCase('de');
    let visible = 0;
    $('merge-body').querySelectorAll('[data-merge-row]').forEach(row => {
      row.hidden = !subjects[Number(row.dataset.mergeRow)].title.toLocaleLowerCase('de').includes(query);
      if (!row.hidden) visible++;
    });
    $('merge-empty').hidden = visible > 0;
  });
  $('merge-form').addEventListener('change', () => {
    const count = $('merge-form').querySelectorAll('[name="merge-subject"]:checked').length;
    $('merge-count').textContent = `${count} Fächer ausgewählt`;
    $('merge-save').disabled = count < 2;
  });
  $('merge-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const selected = [...$('merge-form').querySelectorAll('[name="merge-subject"]:checked')].map(el => el.value);
      const id = `group:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      state.groups = combineSubjects(state.events, state.settings, state.groups, selected, $('merge-name').value, id);
      save(); render(); renderMerge();
      $('merge-notice').textContent = 'Fächer zusammengefügt.';
    } catch (error) { $('merge-error').textContent = error.message; $('merge-error').hidden = false; }
  });
  $('merge-body').querySelectorAll('[data-unmerge]').forEach(button => button.addEventListener('click', () => {
    state.groups.splice(Number(button.dataset.unmerge), 1);
    save(); render(); renderMerge();
    $('merge-notice').textContent = 'Verbindung aufgehoben. Die ursprünglichen Fächer werden wieder einzeln berechnet.';
  }));
}
$('merge-button').addEventListener('click', () => {
  $('merge-notice').textContent = 'Änderungen werden lokal gespeichert.';
  renderMerge(); $('merge-dialog').showModal();
});
$('reset-button').addEventListener('click', () => {
  if (!window.confirm('Kalender, Fachzuordnungen und markierte Fehltermine aus diesem Browser löschen?')) return;
  state = freshState(); manageSource = ''; $('search').value = '';
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* session state is still cleared */ }
  message('Deine lokalen Daten wurden gelöscht.'); periodControls(); render();
});
const savedSemester = semesterOptions(state.events).find(p => p.id === state.period);
if (savedSemester && (state.from !== savedSemester.from || state.to !== savedSemester.to)) {
  state.from = savedSemester.from; state.to = savedSemester.to; save();
}
periodControls(); render();
if (!storageAvailable) message('Der lokale Speicher ist nicht verfügbar. Die App funktioniert für diese Sitzung; Änderungen bleiben beim Neuladen möglicherweise nicht erhalten.', true);
