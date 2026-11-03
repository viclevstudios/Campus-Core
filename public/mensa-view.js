import { MENSA_STORAGE_KEY, canteenById, normalizePreferences, searchCanteens, berlinToday, weekStart, weekDates, addDays, formatWeekRange, availablePriceGroups, categoryTone, loadWeek, formatMealPrice } from './mensa.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const dateFormat = (date, options) => new Intl.DateTimeFormat('de-DE', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const priceLabels = { students: 'Studierende', employees: 'Beschäftigte', pupils: 'Schüler:innen', others: 'Gäste' };
let preferences = normalizePreferences(null), start = weekStart(), days = null, request = null, opened = false, priceGroup = 'students', displayedKey = '';
try {
  const saved = localStorage.getItem(MENSA_STORAGE_KEY);
  try { preferences = normalizePreferences(JSON.parse(saved || 'null')); } catch { /* Invalid preferences use defaults. */ }
} catch { $('mensa-storage').hidden = false; }

function savePreferences() {
  try { localStorage.setItem(MENSA_STORAGE_KEY, JSON.stringify(preferences)); $('mensa-storage').hidden = true; }
  catch { $('mensa-storage').hidden = false; }
}
function status(text, error = false) {
  $('mensa-status').textContent = text;
  $('mensa-status').hidden = !text;
  $('mensa-status').classList.toggle('error', error);
}
function renderOptions() {
  const query = $('mensa-search').value.trim(), matches = searchCanteens(query);
  if (!query) matches.sort((a, b) => Number(b.id === preferences.canteenId) - Number(a.id === preferences.canteenId));
  $('mensa-options').innerHTML = matches.map(c => `<button type="button" role="option" tabindex="-1" aria-selected="${c.id === preferences.canteenId}" data-canteen="${c.id}"><span>${escape(c.name)}</span><small>${escape(c.address || c.city)}</small></button>`).join('');
  $('mensa-results').hidden = Boolean(matches.length);
  $('mensa-results').textContent = matches.length ? '' : 'Keine Mensa gefunden. Versuche einen anderen Namen oder Ort.';
}
function setDropdown(open, returnFocus = false) {
  $('mensa-dropdown').hidden = !open;
  $('mensa-choose').setAttribute('aria-expanded', String(open));
  if (open) { $('mensa-search').value = ''; renderOptions(); $('mensa-search').focus(); }
  else if (returnFocus) $('mensa-choose').focus();
}
const compactSettings = window.matchMedia('(max-width: 799px)');
function syncSettingsPanel() {
  $('mensa-settings-panel').open = !compactSettings.matches;
  setDropdown(false);
}
compactSettings.addEventListener('change', syncSettingsPanel);
syncSettingsPanel();

function renderSelection() {
  const canteen = canteenById(preferences.canteenId);
  $('mensa-name').textContent = canteen.name;
  $('mensa-address').textContent = canteen.address || canteen.city;
  $('mensa-mobile-selection').textContent = canteen.name;
}
function renderPrices() {
  const available = days ? availablePriceGroups(days) : [];
  const groups = available.length ? available : [preferences.priceGroup];
  priceGroup = groups.includes(preferences.priceGroup) ? preferences.priceGroup : groups.includes('students') ? 'students' : groups[0];
  $('mensa-price').innerHTML = groups.map(group => `<option value="${group}">${priceLabels[group]}</option>`).join('');
  $('mensa-price').value = priceGroup;
}
function renderWeek() {
  const current = weekStart();
  $('mensa-week-label').textContent = formatWeekRange(start);
  $('mensa-prev').disabled = start <= current;
  $('mensa-current').hidden = start === current;
  $('mensa-week-relative').hidden = start !== current;
}
function renderDays() {
  const today = berlinToday(), container = $('mensa-days');
  const weekendOpen = container.querySelector('.mensa-weekend')?.open;
  const expanded = new Set([...container.querySelectorAll('.mensa-allergen-toggle[aria-expanded="true"]')].map(button => button.getAttribute('aria-controls')));
  const markup = (days || weekDates(start).map(date => ({ date, status: 'loading', meals: [] }))).map(day => {
    const body = day.status === 'loading' ? '<p class="mensa-day-message">Speiseplan wird geladen …</p>'
      : day.status === 'error' ? `<p class="mensa-day-message mensa-day-error">${escape(day.message)} Bitte aktualisiere den Plan.</p>`
      : day.status === 'unpublished' ? '<p class="mensa-day-message">Kein Speiseplan</p>'
      : `<ul class="mensa-meals">${day.meals.map((meal, index) => {
        const id = `mensa-notes-${day.date}-${index}`, isOpen = expanded.has(id);
        return `<li class="mensa-meal"><div class="mensa-meal-meta"><span class="mensa-category"><i class="mensa-category-dot ${categoryTone(meal.category)}" aria-hidden="true"></i><span>${escape(meal.category || 'Gericht')}</span></span><span class="mensa-meal-price${meal.prices[priceGroup] === null ? ' mensa-price-missing' : ''}">${escape(formatMealPrice(meal, priceGroup))}</span></div><h4>${escape(meal.name)}</h4><button type="button" class="mensa-allergen-toggle" aria-expanded="${isOpen}" aria-controls="${id}" aria-label="Zusätzliche Informationen · ${meal.notes.length}: ${escape(meal.name)}">Zusätzliche Informationen · ${meal.notes.length}${chevron}</button><div id="${id}" class="mensa-notes"${isOpen ? '' : ' hidden'}>${meal.notes.length ? `<ul>${meal.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : '<p>Keine Hinweise angegeben.</p>'}</div></li>`;
      }).join('')}</ul>`;
    return `<section class="mensa-day${day.date === today ? ' mensa-today' : ''}" aria-labelledby="mensa-day-${day.date}"><h3 id="mensa-day-${day.date}"><span>${dateFormat(day.date, { weekday: 'long' })}</span><time datetime="${day.date}">${dateFormat(day.date, { day: '2-digit', month: '2-digit' })}</time></h3>${body}</section>`;
  });
  container.innerHTML = `<div class="mensa-weekdays">${markup.slice(0, 5).join('')}</div><details class="mensa-weekend"${weekendOpen ? ' open' : ''}><summary>Wochenende anzeigen</summary><div class="mensa-weekend-days">${markup.slice(5).join('')}</div></details>`;
}
function renderUpdated() {
  const successful = days?.filter(day => Number.isFinite(day.fetchedAt)) || [];
  if (!successful.length) return;
  const timestamp = Math.max(...successful.map(day => day.fetchedAt));
  $('mensa-updated').textContent = `Stand ${new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(timestamp))} Uhr`;
}
async function refresh(force = false) {
  request?.abort();
  const currentRequest = new AbortController();
  request = currentRequest;
  const key = `${preferences.canteenId}/${start}`;
  if (displayedKey !== key) $('mensa-updated').textContent = 'Stand –';
  displayedKey = key;
  days = null;
  renderSelection(); renderPrices(); renderWeek(); renderDays();
  $('mensa-days').setAttribute('aria-busy', 'true');
  $('mensa-refresh').disabled = true;
  status('Speisepläne werden geladen …');
  try {
    const result = await loadWeek(preferences.canteenId, start, { signal: currentRequest.signal, force });
    if (request !== currentRequest || currentRequest.signal.aborted) return;
    days = result;
    const errors = days.filter(day => day.status === 'error').length;
    status(errors ? `${errors} von 7 Tagen konnten nicht geladen werden. Bitte aktualisiere den Plan.` : '', Boolean(errors));
    renderPrices(); renderDays(); renderUpdated();
  } catch {
    if (!currentRequest.signal.aborted && request === currentRequest) status('Der Plan konnte nicht geladen werden. Bitte aktualisiere ihn erneut.', true);
  } finally {
    if (request === currentRequest) { $('mensa-days').setAttribute('aria-busy', 'false'); $('mensa-refresh').disabled = false; }
  }
}
function route() {
  const mensa = location.hash === '#mensa';
  $('attendance-view').hidden = mensa;
  $('mensa').hidden = !mensa;
  document.title = `Campus Core – ${mensa ? 'Mensaplan' : 'Anwesenheit'}`;
  document.querySelectorAll('nav .nav-item').forEach(link => {
    const active = mensa ? link.hash === '#mensa' : location.hash === '#subjects' ? link.hash === '#subjects' : link.hash === '#overview';
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (mensa) {
    if (start < weekStart()) { start = weekStart(); opened = false; }
    if (!opened) { opened = true; void refresh(); }
  } else { setDropdown(false); request?.abort(); if (!days) opened = false; }
}
$('mensa-choose').addEventListener('click', () => setDropdown($('mensa-dropdown').hidden));
$('mensa-search').addEventListener('input', renderOptions);
$('mensa-search').addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const options = $('mensa-options').querySelectorAll('[role="option"]');
    (event.key === 'ArrowDown' ? options[0] : options[options.length - 1])?.focus();
  }
});
$('mensa-options').addEventListener('keydown', event => {
  const options = [...$('mensa-options').querySelectorAll('[role="option"]')], index = options.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
});
$('mensa-options').addEventListener('click', event => {
  const option = event.target.closest('[data-canteen]');
  if (!option || !canteenById(option.dataset.canteen)) return;
  preferences.canteenId = Number(option.dataset.canteen);
  savePreferences(); setDropdown(false, true); void refresh();
});
document.addEventListener('pointerdown', event => { if (!$('mensa-picker').contains(event.target)) setDropdown(false); });
document.addEventListener('focusin', event => { if (!$('mensa-picker').contains(event.target)) setDropdown(false); });
$('mensa-picker').addEventListener('keydown', event => { if (event.key === 'Escape' && !$('mensa-dropdown').hidden) { event.preventDefault(); setDropdown(false, true); } });
$('mensa-settings-panel').addEventListener('toggle', () => { if (!$('mensa-settings-panel').open) setDropdown(false); });
$('mensa-days').addEventListener('click', event => {
  const button = event.target.closest('.mensa-allergen-toggle');
  if (!button) return;
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  $(button.getAttribute('aria-controls')).hidden = !open;
});
$('mensa-price').addEventListener('change', () => { preferences.priceGroup = $('mensa-price').value; priceGroup = preferences.priceGroup; savePreferences(); if (days) renderDays(); });
$('mensa-refresh').addEventListener('click', () => { if (start < weekStart()) start = weekStart(); void refresh(true); });
$('mensa-next').addEventListener('click', () => { start = addDays(start < weekStart() ? weekStart() : start, 7); void refresh(); });
$('mensa-prev').addEventListener('click', () => { if (start > weekStart()) { start = addDays(start, -7); void refresh(); } });
$('mensa-current').addEventListener('click', () => { start = weekStart(); void refresh(); });
$('mensa-reset').addEventListener('click', () => {
  preferences = normalizePreferences(null);
  try { localStorage.removeItem(MENSA_STORAGE_KEY); $('mensa-storage').hidden = true; } catch { $('mensa-storage').hidden = false; }
  setDropdown(false, true); void refresh();
});
window.addEventListener('hashchange', route);
renderSelection(); renderPrices(); renderWeek(); route();
