import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGallery, MAX_ENTRIES } from '../src/gallery.js';
import { PRESETS, randomDesign } from '../src/presets.js';
import { encodeDesign } from '../src/share.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock() {
  let t = 1_000_000;
  return () => (t += 1000);
}

test('saved designs persist and reload in newest-first order', () => {
  const storage = memoryStorage();
  const g = createGallery(storage, 'k', clock());
  g.save(PRESETS[0].design, { name: 'first' });
  g.save(PRESETS[1].design, { name: 'second', paletteId: 'night' });
  const reloaded = createGallery(storage, 'k').list();
  assert.deepEqual(reloaded.map((e) => e.name), ['second', 'first']);
  assert.equal(reloaded[0].paletteId, 'night');
  assert.equal(reloaded[1].code, encodeDesign(PRESETS[0].design));
});

test('saving the same design and palette again moves it to the front', () => {
  const g = createGallery(memoryStorage(), 'k', clock());
  const a = g.save(PRESETS[0].design).entry;
  g.save(PRESETS[1].design);
  const again = g.save(PRESETS[0].design, { name: 'renamed' }).entry;
  assert.equal(again.id, a.id);
  assert.deepEqual(g.list().map((e) => e.name), ['renamed', 'Untitled']);
  g.save(PRESETS[0].design, { paletteId: 'ember' });
  assert.equal(g.list().length, 3);
});

test('the gallery keeps only the newest entries', () => {
  const g = createGallery(memoryStorage(), 'k', clock());
  for (let seed = 0; seed < MAX_ENTRIES + 5; seed++) g.save(randomDesign(seed), { name: `s${seed}` });
  const names = g.list().map((e) => e.name);
  assert.equal(names.length, MAX_ENTRIES);
  assert.equal(names[0], `s${MAX_ENTRIES + 4}`);
  assert.ok(!names.includes('s0'));
});

test('entries get unique ids even when saved in the same millisecond', () => {
  const g = createGallery(memoryStorage(), 'k', () => 5);
  const ids = [0, 1, 2].map((s) => g.save(randomDesign(s)).entry.id);
  assert.equal(new Set(ids).size, 3);
});

test('remove deletes by id and design decodes a saved entry', () => {
  const storage = memoryStorage();
  const g = createGallery(storage, 'k', clock());
  const { entry } = g.save(PRESETS[2].design);
  // Designs round-trip through the share encoding, so compare at that precision.
  assert.equal(encodeDesign(g.design(entry.id)), encodeDesign(PRESETS[2].design));
  assert.equal(g.remove('missing'), false);
  assert.equal(g.remove(entry.id), true);
  assert.equal(g.design(entry.id), null);
  assert.deepEqual(createGallery(storage, 'k').list(), []);
});

test('corrupt or foreign storage contents are ignored', () => {
  assert.deepEqual(createGallery(memoryStorage({ k: '{not json' }), 'k').list(), []);
  assert.deepEqual(createGallery(memoryStorage({ k: '{"a":1}' }), 'k').list(), []);
  const mixed = JSON.stringify([{ id: 'ok', code: 'x:0.5,2,0,0.01;y:0.5,3,0,0.01', paletteId: 'ink' }, { id: 'bad', code: 'nope' }, null]);
  assert.deepEqual(createGallery(memoryStorage({ k: mixed }), 'k').list().map((e) => e.id), ['ok']);
});

test('a storage that throws still gives a working in-memory gallery', () => {
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
  };
  const g = createGallery(throwing, 'k', clock());
  const { persisted } = g.save(PRESETS[0].design);
  assert.equal(persisted, false);
  assert.equal(g.list().length, 1);
  assert.equal(createGallery(null, 'k').list().length, 0);
});
