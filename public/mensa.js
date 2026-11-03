import { CANTEEN_CATALOG } from './mensa-canteens.js';

export const CANTEENS = Object.freeze(CANTEEN_CATALOG.canteens.map(c => Object.freeze(c)));
export const DEFAULT_CANTEEN_ID = 69;
export const MENSA_STORAGE_KEY = 'campuscore.mensa.v1';
export const PRICE_GROUPS = ['students', 'employees', 'pupils', 'others'];
const byId = new Map(CANTEENS.map(c => [c.id, c]));
const cache = new Map();
const dayCache = new Map();
const CACHE_MS = 15 * 60 * 1000;

export function canteenById(id) { return byId.get(Number(id)); }
export function normalizePreferences(value) {
  return {
    canteenId: canteenById(value?.canteenId)?.id ?? DEFAULT_CANTEEN_ID,
    priceGroup: PRICE_GROUPS.includes(value?.priceGroup) ? value.priceGroup : 'students'
  };
}
const searchable = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('de').replace(/ß/g, 'ss');
export function searchCanteens(query) {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  return CANTEENS.filter(c => words.every(word => searchable(`${c.city} ${c.name} ${c.address}`).includes(word)))
    .sort((a, b) => a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de') || a.id - b.id);
}

// Calendar dates are evaluated in the canteens' German timezone, including DST.
export function berlinToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ungültiges Datum.');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Ungültiges Datum.');
  return parsed;
}
export function addDays(date, count) {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + count);
  return parsed.toISOString().slice(0, 10);
}
export function weekStart(date = berlinToday()) {
  const day = parseDate(date).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function weekDates(start) { return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
export function mensaDayLayout(days, start, today, mobile = false) {
  const primary = days.slice(0, 5), weekend = days.slice(5);
  if (!mobile || start !== weekStart(today)) return { primary, weekend };
  const current = days.find(day => day.date === today);
  if (!current) return { primary, weekend };
  return { primary: [current, ...primary.filter(day => day !== current)], weekend: weekend.filter(day => day !== current) };
}
export function formatWeekRange(start) {
  const from = parseDate(start), to = parseDate(addDays(start, 6));
  const day = date => String(date.getUTCDate()).padStart(2, '0') + '.';
  const month = date => new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(date);
  if (from.getUTCFullYear() !== to.getUTCFullYear()) return `${day(from)} ${month(from)} ${from.getUTCFullYear()}–${day(to)} ${month(to)} ${to.getUTCFullYear()}`;
  if (from.getUTCMonth() !== to.getUTCMonth()) return `${day(from)} ${month(from)}–${day(to)} ${month(to)} ${to.getUTCFullYear()}`;
  return `${day(from)}–${day(to)} ${month(to)} ${to.getUTCFullYear()}`;
}
export function availablePriceGroups(days) {
  return PRICE_GROUPS.filter(group => days.some(day => day.meals.some(meal => typeof meal.prices[group] === 'number')));
}
export function categoryTone(category) {
  if (/^Fleischgericht$/i.test(category.trim())) return 'meat';
  if (/^Pastateller$/i.test(category.trim())) return 'pasta';
  if (/^(Vegetarisches|Veganes) Gericht$/i.test(category.trim())) return 'veg';
  return 'other';
}
export function mealUrl(canteenId, date) {
  const canteen = canteenById(canteenId);
  if (!canteen) throw new Error('Diese Mensa ist nicht im gespeicherten Verzeichnis.');
  parseDate(date);
  return `https://openmensa.org/api/v2/canteens/${canteen.id}/days/${date}/meals`;
}
export function normalizeMeals(data) {
  if (!Array.isArray(data) || data.some(meal => !meal || typeof meal.name !== 'string' || !meal.name.trim())) throw new Error('Ungültige Speiseplandaten.');
  return data.map(meal => ({
    name: meal.name,
    category: typeof meal.category === 'string' ? meal.category : '',
    notes: Array.isArray(meal.notes) ? meal.notes.filter(note => typeof note === 'string') : [],
    prices: Object.fromEntries(PRICE_GROUPS.map(group => [group, typeof meal.prices?.[group] === 'number' && Number.isFinite(meal.prices[group]) && meal.prices[group] >= 0 ? meal.prices[group] : null]))
  }));
}
export function formatMealPrice(meal, group) {
  const price = meal.prices[group];
  return typeof price === 'number' ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price) : 'Preis nicht angegeben';
}

// Display grouping is scoped to one day and the currently selected price group.
// Keep the API meals unchanged so another price group can be grouped afresh.
export function groupPastaMeals(meals, priceGroup) {
  const result = [], groups = new Map();
  for (const meal of meals) {
    const price = meal.prices[priceGroup];
    if (!/^Pastateller$/i.test(meal.category.trim()) || typeof price !== 'number' || !Number.isFinite(price)) {
      result.push(meal);
      continue;
    }
    let group = groups.get(price);
    if (!group) {
      group = { ...meal, notes: [...new Set(meal.notes)], components: [] };
      groups.set(price, group);
      result.push(group);
    }
    group.components.push(meal.name);
    group.notes = [...new Set([...group.notes, ...meal.notes])];
    group.name = group.components.join(', ');
  }
  return result;
}

async function requestJson(url, { signal, fetchImpl, timeoutMs, allowMissing = false }) {
  if (signal?.aborted) throw signal.reason;
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error' });
    if (allowMissing && response.status === 404) return { data: [], missing: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (signal?.aborted) throw signal.reason;
    return { data, pages: Number(response.headers?.get('x-total-pages') || 1) };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('Die Anfrage hat zu lange gedauert.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function loadWeek(canteenId, start, { signal, force = false, fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  // The canteen ID still comes exclusively from the local catalog. Check which
  // days exist before requesting meals, avoiding routine 404 network errors.
  const urls = weekDates(start).map(date => ({ date, url: mealUrl(canteenId, date) }));
  const options = { signal, fetchImpl, timeoutMs };
  const cachedMeal = url => {
    const entry = cache.get(url);
    return !force && entry && now() - entry.time < CACHE_MS ? entry.result : null;
  };
  if (signal?.aborted) throw signal.reason;
  if (urls.every(({ url }) => cachedMeal(url))) return urls.map(({ url }) => ({ ...cachedMeal(url), cached: true }));
  const daysUrl = `https://openmensa.org/api/v2/canteens/${Number(canteenId)}/days?start=${start}`;
  let available = dayCache.get(daysUrl), availabilityError;
  if (force || !available || now() - available.time >= CACHE_MS) {
    try {
      const days = new Map();
      let page = 1, pages = 1;
      do {
        const response = await requestJson(daysUrl + (page > 1 ? `&page=${page}` : ''), options);
        if (!Array.isArray(response.data) || !Number.isInteger(response.pages) || response.pages < 1 || response.pages > 20) throw new Error('Ungültige Liste der Speiseplantage.');
        pages = response.pages;
        for (const day of response.data) {
          if (!day || typeof day.closed !== 'boolean') throw new Error('Ungültiger Speiseplantag.');
          parseDate(day.date);
          if (days.has(day.date) && days.get(day.date) !== day.closed) throw new Error('Widersprüchliche Speiseplantage.');
          days.set(day.date, day.closed);
        }
        page++;
      } while (page <= pages);
      if (signal?.aborted) throw signal.reason;
      available = { days, time: now() };
      if (dayCache.size >= 56) dayCache.delete(dayCache.keys().next().value);
      dayCache.set(daysUrl, available);
    } catch (error) {
      if (signal?.aborted) throw error;
      availabilityError = error;
    }
  }
  return Promise.all(urls.map(async ({ date, url }) => {
    if (signal?.aborted) throw signal.reason;
    const cached = cachedMeal(url);
    if (cached) return { ...cached, cached: true };
    try {
      if (availabilityError) throw availabilityError;
      let meals = [], fetchedAt = available.time;
      if (available.days.get(date) === false) {
        const response = await requestJson(url, { ...options, allowMissing: true });
        meals = normalizeMeals(response.data);
        fetchedAt = now();
        // A listed day can disappear between requests. Handle that race and
        // recheck availability on the next uncached load.
        if (response.missing) dayCache.delete(daysUrl);
      }
      const result = { date, status: meals.length ? 'ready' : 'unpublished', meals, fetchedAt };
      if (signal?.aborted) throw signal.reason;
      if (cache.size >= 280) cache.delete(cache.keys().next().value);
      cache.set(url, { time: now(), result });
      return { ...result, cached: false };
    } catch (error) {
      if (signal?.aborted) throw error;
      return { date, status: 'error', meals: [], message: error.message === 'Die Anfrage hat zu lange gedauert.' ? error.message : 'Der Speiseplan konnte nicht geladen werden.' };
    }
  }));
}
