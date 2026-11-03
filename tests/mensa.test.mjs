import test from 'node:test';
import assert from 'node:assert/strict';
import { CANTEENS, canteenById, searchCanteens, normalizePreferences, berlinToday, weekStart, weekDates, addDays, formatWeekRange, availablePriceGroups, categoryTone, mealUrl, normalizeMeals, formatMealPrice, loadWeek, groupPastaMeals } from '../public/mensa.js';
import { readFile } from 'node:fs/promises';

test('Lokaler Katalog hat eindeutige IDs und die richtige Mensa 69', () => {
  assert.ok(CANTEENS.length >= 1306);
  assert.equal(new Set(CANTEENS.map(c => c.id)).size, CANTEENS.length);
  assert.match(canteenById(69).name, /Schönauer Straße/);
  assert.equal(canteenById(69).city, 'Leipzig');
  assert.ok(searchCanteens('leipzig schonauer strasse').some(c => c.id === 69));
  assert.deepEqual(searchCanteens('nichtvorhandene-mensa-xyz'), []);
});
test('Ungültige gespeicherte Auswahl fällt auf gültige Vorgaben zurück', () => {
  assert.deepEqual(normalizePreferences({ canteenId: 9999999, priceGroup: '<script>' }), { canteenId: 69, priceGroup: 'students' });
  assert.deepEqual(normalizePreferences({ canteenId: '70', priceGroup: 'others' }), { canteenId: 70, priceGroup: 'others' });
});
test('Montag bis Sonntag funktioniert an Jahresgrenzen und zur Zeitumstellung', () => {
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
  assert.equal(weekStart('2026-11-08'), '2026-11-02');
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(berlinToday(new Date('2026-11-02T23:30:00Z')), '2026-11-03');
  assert.equal(berlinToday(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});
test('Essen-URL verwendet ausschließlich eine lokale ID und ein gültiges Datum', () => {
  assert.equal(mealUrl(69, '2026-11-03'), 'https://openmensa.org/api/v2/canteens/69/days/2026-11-03/meals');
  assert.throws(() => mealUrl('69/../70', '2026-11-03'));
  assert.throws(() => mealUrl(69, '2026-02-30'));
  assert.throws(() => mealUrl(69, '2026-11-03?x=1'));
});
test('Wochenbeschriftung nennt bei Monats- und Jahresgrenzen beide Seiten', () => {
  assert.equal(formatWeekRange('2026-11-02'), '02.–08. November 2026');
  assert.equal(formatWeekRange('2026-11-30'), '30. November–06. Dezember 2026');
  assert.equal(formatWeekRange('2026-12-28'), '28. Dezember 2026–03. Januar 2027');
});
test('Preisgruppen stammen aus vorhandenen Preisen; kostenlose Gerichte zählen mit', () => {
  const meals = normalizeMeals([{ name: 'Suppe', prices: { students: 0, employees: 3, pupils: null } }, { name: 'Salat', prices: { others: 4 } }]);
  assert.deepEqual(availablePriceGroups([{ meals }]), ['students', 'employees', 'others']);
  assert.deepEqual(availablePriceGroups([{ meals: [] }]), []);
  assert.equal(categoryTone('Fleischgericht'), 'meat');
  assert.equal(categoryTone('Veganes Gericht'), 'veg');
  assert.equal(categoryTone('Vegetarisches Gericht'), 'veg');
  assert.equal(categoryTone('Pastateller'), 'pasta');
});
test('Pastateller vom 04.11.2026 wird einmal mit drei Komponenten und vier Hinweisen dargestellt', async () => {
  const raw = JSON.parse(await readFile(new URL('./fixtures/openmensa-69-2026-11-04.json', import.meta.url), 'utf8'));
  const meals = normalizeMeals(raw), before = JSON.stringify(meals);
  const displayed = groupPastaMeals(meals, 'students');
  assert.equal(displayed.length, 2);
  assert.equal(displayed[0].name, 'Basmatireis mit Lauchzwiebeln');
  assert.equal(displayed[1].name, 'Spirelli mit Curry-Sahnesoße mit Hähnchenfleisch, Geriebener Gouda');
  assert.equal(displayed[1].prices.students, 2.1);
  assert.deepEqual(displayed[1].notes, ['glutenhaltiges Getreide', 'Weizen', 'Milch/ Milchzucker', 'Vegan']);
  assert.equal(JSON.stringify(meals), before);
});
test('beliebig viele Gerichte und Pasta-Preisgruppen bleiben an ihrer ersten Position', () => {
  const meals = normalizeMeals([
    { name: 'Suppe', category: 'Vegetarisches Gericht', prices: { students: 2.1 } },
    { name: 'Spirelli', category: 'Pastateller', prices: { students: 2.1 }, notes: ['Weizen'] },
    { name: 'Premium-Pasta', category: 'Pastateller', prices: { students: 3.5 } },
    { name: 'Schnitzel', category: 'Fleischgericht', prices: { students: 2.1 } },
    { name: 'Soße', category: 'Pastateller', prices: { students: 2.1 }, notes: ['Weizen', 'Milch'] },
    { name: 'Premium-Soße', category: 'Pastateller', prices: { students: 3.5 } },
    { name: 'Gouda', category: 'Pastateller', prices: { students: 2.1 } },
    { name: 'Pesto', category: 'Nudelgericht', prices: { students: 2.1 } }
  ]);
  const displayed = groupPastaMeals(meals, 'students');
  assert.deepEqual(displayed.map(m => m.name), ['Suppe', 'Spirelli mit Soße, Gouda', 'Premium-Pasta mit Premium-Soße', 'Schnitzel', 'Pesto']);
  assert.deepEqual(displayed[1].notes, ['Weizen', 'Milch']);
  assert.equal(displayed[0], meals[0]);
});
test('aktive Preisgruppe entscheidet; fehlende Preise werden nicht als gleiche Preise behandelt', () => {
  const meals = normalizeMeals([
    { name: 'Pasta', category: 'Pastateller', prices: { students: 2.1, employees: 4.6, others: 0 } },
    { name: 'Soße', category: 'Pastateller', prices: { students: 2.1, employees: 5, others: 0 } },
    { name: 'Ohne Preis', category: 'Pastateller' },
    { name: 'Auch ohne Preis', category: 'Pastateller' }
  ]);
  assert.equal(groupPastaMeals(meals, 'students').length, 3);
  assert.equal(groupPastaMeals(meals, 'employees').length, 4);
  assert.equal(groupPastaMeals(meals, 'others').length, 3);
  assert.equal(groupPastaMeals(meals, 'pupils').length, 4);
  assert.deepEqual(groupPastaMeals([], 'students'), []);
  const days = [meals.slice(0, 1), meals.slice(1, 2)].map(day => groupPastaMeals(day, 'students'));
  assert.deepEqual(days.map(day => day[0].name), ['Pasta', 'Soße']);
});
test('Preise unterscheiden fehlende Angaben von einem kostenlosen Gericht', () => {
  const [meal] = normalizeMeals([{ name: '<img src=x>', prices: { students: 0, employees: null, others: -2 }, notes: ['Vegan', null] }]);
  assert.equal(formatMealPrice(meal, 'students').replace(/\s/g, ''), '0,00€');
  assert.equal(formatMealPrice(meal, 'employees'), 'Preis nicht angegeben');
  assert.equal(meal.prices.others, null);
  assert.deepEqual(meal.notes, ['Vegan']);
  assert.throws(() => normalizeMeals({ meals: [] }));
  assert.throws(() => normalizeMeals([{}]));
});
test('Wochenabruf ruft nur sieben Essen-URLs auf, cached und aktualisiert ausdrücklich', async () => {
  let calls = [];
  let time = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => [{ name: 'Testgericht', prices: { students: 2.4 } }] };
  };
  const options = { fetchImpl, now: () => time };
  const result = await loadWeek(69, '2026-11-02', options);
  assert.equal(calls.length, 7);
  assert.ok(calls.every(c => /^https:\/\/openmensa.org\/api\/v2\/canteens\/69\/days\/2026-11-0[2-8]\/meals$/.test(c.url)));
  assert.ok(calls.every(c => c.options.credentials === 'omit' && c.options.referrerPolicy === 'no-referrer'));
  assert.equal(result[1].date, '2026-11-03');
  assert.ok(result.every(d => d.status === 'ready'));
  time = 60000;
  const cached = await loadWeek(69, '2026-11-02', options);
  assert.ok(cached.every(d => d.cached && d.fetchedAt === 0));
  assert.equal(calls.length, 7);
  await loadWeek(70, '2026-11-02', options); assert.equal(calls.length, 14);
  await loadWeek(69, '2026-11-02', { ...options, force: true }); assert.equal(calls.length, 21);
  time += 15 * 60 * 1000;
  await loadWeek(69, '2026-11-02', options); assert.equal(calls.length, 28);
});
test('Teilfehler, fehlender Plan und ungültige API-Daten bleiben unterscheidbar', async () => {
  const result = await loadWeek(69, '2026-11-09', { force: true, fetchImpl: async url => {
    const day = Number(url.split('/').at(-2).slice(-2));
    if (day === 9) return { ok: false, status: 404 };
    if (day === 10) return { ok: true, status: 200, json: async () => [] };
    if (day === 11) return { ok: false, status: 503 };
    if (day === 12) return { ok: true, status: 200, json: async () => ({ error: 'broken' }) };
    if (day === 13) throw new TypeError('offline');
    return { ok: true, status: 200, json: async () => [{ name: 'Suppe' }] };
  } });
  assert.deepEqual(result.map(d => d.status), ['unpublished', 'unpublished', 'error', 'error', 'error', 'ready', 'ready']);
});
test('Abbruch verhindert veraltete Antworten; Zeitlimit liefert Tagesfehler', async () => {
  const controller = new AbortController();
  const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  const loading = loadWeek(69, '2026-11-16', { signal: controller.signal, fetchImpl, force: true });
  controller.abort();
  await assert.rejects(loading);
  const timeout = await loadWeek(69, '2026-11-16', { fetchImpl, force: true, timeoutMs: 5 });
  assert.ok(timeout.every(day => day.status === 'error' && /lange/.test(day.message)));
});
