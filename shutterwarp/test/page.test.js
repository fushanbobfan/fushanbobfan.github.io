import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeProp } from '../src/shutter.js';
import { speedLabel, readoutLabel, turnLabel, slowdown, slowdownLabel, verdict, rows } from '../src/readout.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('every element the script looks up by id is on the page', () => {
  const ids = new Set([...main.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size >= 8);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('every range control starts inside its own limits', () => {
  for (const m of html.matchAll(/<input id="([\w-]+)" type="range" min="([\d.]+)" max="([\d.]+)" step="([\d.]+)" value="([\d.]+)">/g)) {
    const [, id, min, max, , value] = m.map((v, i) => (i > 1 ? Number(v) : v));
    assert.ok(value >= min && value <= max, id);
  }
});

test('the page loads only relative files', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (m[1].startsWith('https://github.com/')) continue;
    assert.ok(!m[1].startsWith('/') && !m[1].includes('://'), m[1]);
  }
});

test('speeds, readouts and turns read naturally', () => {
  assert.equal(speedLabel(0), 'standing still');
  assert.equal(speedLabel(180), '180 rpm (3.0 turns a second)');
  assert.equal(speedLabel(2400), '2,400 rpm (40 turns a second)');
  assert.equal(readoutLabel(0.03), '30 ms from top to bottom');
  assert.equal(turnLabel(0.4), 'less than a degree');
  assert.equal(turnLabel(32.4), '32°');
  assert.equal(turnLabel(540), '540° (1.5 turns)');
  assert.equal(turnLabel(4320), '4,320° (12 turns)');
});

test('the animation stretches one readout over four seconds', () => {
  assert.equal(slowdown(0.04), 100);
  assert.equal(slowdownLabel(0.03), '133 times slower than life');
  assert.equal(slowdownLabel(1), '4.0 times slower than life');
});

test('the verdict grows with the turn during one readout', () => {
  const at = (rpm) => verdict(makeProp({ rpm }), 0.03);
  assert.match(at(0), /straight/);
  assert.match(at(10), /straight/);       // 1.8 degrees
  assert.match(at(180), /gently bent/);   // 32 degrees
  assert.match(at(1200), /curved, lopsided/); // 216 degrees
  assert.match(at(6000), /more than once/);   // 1080 degrees
  const r = rows(makeProp({ rpm: 2400 }), 0.03);
  assert.deepEqual(r.map(([k]) => k), ['Propeller', 'Sensor readout', 'Turn during one readout', 'Animation']);
  assert.equal(r[2][1], '432° (1.2 turns)');
});
