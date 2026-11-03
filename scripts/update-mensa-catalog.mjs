// Maintenance only. The shipped app never downloads the canteen directory.
import { writeFile } from 'node:fs/promises';
const source = 'https://openmensa.org/api/v2/canteens';
const canteens = [], seenPages = new Set(), ids = new Set();
let next = source;
while (next) {
  const url = new URL(next);
  if (url.origin !== 'https://openmensa.org' || url.pathname !== '/api/v2/canteens' || seenPages.has(next)) throw new Error('Ungültige Verzeichnis-Paginierung.');
  seenPages.add(next);
  const response = await fetch(next, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok) throw new Error(`Verzeichnis nicht geladen: HTTP ${response.status}`);
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error('Ungültiges Verzeichnis.');
  for (const c of entries) {
    if (!Number.isInteger(c.id) || c.id <= 0 || typeof c.name !== 'string' || !c.name || ids.has(c.id)) throw new Error('Ungültige oder doppelte Mensa-ID.');
    ids.add(c.id);
    canteens.push({ id: c.id, name: c.name, city: typeof c.city === 'string' ? c.city : '', address: typeof c.address === 'string' ? c.address : '' });
  }
  next = response.headers.get('link')?.split(',').map(part => part.match(/<([^>]+)>;\s*rel="next"/)).find(Boolean)?.[1] || null;
}
if (!ids.has(69)) throw new Error('Die vorausgewählte Mensa 69 fehlt. Der bisherige Export bleibt erhalten.');
const catalog = { updatedAt: new Date().toISOString().slice(0, 10), source, canteens: canteens.sort((a, b) => a.id - b.id) };
const records = catalog.canteens.map(c => `    ${JSON.stringify(c)}`).join(',\n');
await writeFile(new URL('../public/mensa-canteens.js', import.meta.url), `// Einmaliger Verzeichnisexport. Aktualisierung: node scripts/update-mensa-catalog.mjs\nexport const CANTEEN_CATALOG = {\n  updatedAt: ${JSON.stringify(catalog.updatedAt)},\n  source: ${JSON.stringify(source)},\n  canteens: [\n${records}\n  ]\n};\n`);
console.log(`${canteens.length} Mensen lokal gespeichert. Bitte Änderungen prüfen und die App neu bauen.`);
