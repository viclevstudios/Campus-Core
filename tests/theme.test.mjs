import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
function browser({ dark = false, saved = null, blocked = false } = {}) {
  const values = new Map(saved ? [['campusplan.theme', saved]] : []);
  const root = { dataset: {} };
  const listeners = {};
  const attributes = {};
  const label = { textContent: '' };
  let click;
  const button = { setAttribute: (key, value) => { attributes[key] = value; }, addEventListener: (name, fn) => { if (name === 'click') click = fn; } };
  const media = { matches: dark, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = {
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    window: { matchMedia: () => media },
    document: {
      documentElement: root,
      getElementById: id => id === 'theme-button' ? button : label,
      querySelector: () => ({ setAttribute() {} }),
      addEventListener: (name, fn) => { listeners[name] = fn; }
    },
    localStorage: {
      getItem: key => { if (blocked) throw new Error('Storage blocked'); return values.get(key) || null; },
      setItem: (key, value) => { if (blocked) throw new Error('Storage blocked'); values.set(key, value); }
    }
  };
  runInNewContext(source, context);
  return { root, values, attributes, label, ready: () => listeners.DOMContentLoaded(), toggle: () => click(), system: value => { media.matches = value; listeners.change(); } };
}

test('Dunkle Systempräferenz gilt bereits vor dem Laden des Inhalts', () => {
  const b = browser({ dark: true });
  assert.equal(b.root.dataset.theme, 'dark');
  b.ready();
  assert.equal(b.attributes['aria-pressed'], 'true');
  assert.equal(b.label.textContent, 'Heller Modus');
});
test('Gespeicherte Auswahl hat Vorrang vor der Systempräferenz', () => {
  const b = browser({ dark: true, saved: 'light' });
  b.ready();
  assert.equal(b.root.dataset.theme, 'light');
  b.system(false); b.system(true);
  assert.equal(b.root.dataset.theme, 'light');
});
test('Ohne Auswahl folgt die App Änderungen der Systempräferenz', () => {
  const b = browser(); b.ready();
  b.system(true); assert.equal(b.root.dataset.theme, 'dark');
  b.system(false); assert.equal(b.root.dataset.theme, 'light');
});
test('Umschalter speichert Auswahl und hält Beschriftung konsistent', () => {
  const b = browser(); b.ready(); b.toggle();
  assert.equal(b.values.get('campusplan.theme'), 'dark');
  assert.equal(b.attributes['aria-label'], 'Heller Modus');
  const reload = browser({ saved: b.values.get('campusplan.theme') });
  assert.equal(reload.root.dataset.theme, 'dark');
  b.toggle();
  assert.equal(b.root.dataset.theme, 'light');
  assert.equal(b.attributes['aria-label'], 'Dunkelmodus');
});
test('Blockierter Browserspeicher verhindert den Theme-Wechsel nicht', () => {
  const b = browser({ blocked: true }); b.ready(); b.toggle();
  assert.equal(b.root.dataset.theme, 'dark');
  b.system(false);
  assert.equal(b.root.dataset.theme, 'dark');
});
test('Ungültige gespeicherte Präferenz fällt auf die Systemeinstellung zurück', () => {
  const b = browser({ saved: 'invalid', dark: true });
  assert.equal(b.root.dataset.theme, 'dark');
});
