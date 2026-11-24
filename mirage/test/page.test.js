import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeAir } from '../src/air.js';
import { criticalAngle, shineStart } from '../src/rays.js';
import { viewRows, describeView } from '../src/view.js';
import { verdict, rows, distanceLabel, degreesLabel, layerLabel, tempLabel } from '../src/readout.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('every element the script looks up by id is on the page', () => {
  const ids = new Set([...main.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size >= 10);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('every colour the script reads is defined in the stylesheet', () => {
  const names = new Set([...main.matchAll(/v\('(--[\w-]+)'\)/g)].map((m) => m[1]));
  for (const m of main.matchAll(/\[([^\]]+)\]\.map\(\(k\) => \[k, (?:hex\()?v\(`(--[\w-]+)\$\{k\}`\)/g)) {
    for (const k of m[1].matchAll(/'(\w+)'/g)) names.add(m[2] + k[1]);
  }
  const listed = [...main.matchAll(/const names = \[([^\]]+)\]/g)][0][1];
  for (const k of listed.matchAll(/'(\w+)'/g)) names.add(`--scene-${k[1]}`);
  assert.ok(names.size >= 15);
  for (const n of names) assert.match(css, new RegExp(`${n}:`), n);
});

test('every range control starts inside its own limits, and every preset too', () => {
  const ranges = {};
  for (const m of html.matchAll(/<input id="([\w-]+)" type="range" min="([\d.]+)" max="([\d.]+)" step="([\d.]+)" value="([\d.]+)">/g)) {
    const [min, max, , value] = m.slice(2).map(Number);
    ranges[m[1]] = [min, max];
    assert.ok(value >= min && value <= max, m[1]);
  }
  assert.equal(Object.keys(ranges).length, [...html.matchAll(/type="range"/g)].length);
  let presets = 0;
  for (const m of html.matchAll(/<button type="button"((?: data-[\w]+="[\d.]+")+)>/g)) {
    presets++;
    for (const d of m[1].matchAll(/data-(\w+)="([\d.]+)"/g)) {
      const [min, max] = ranges[d[1]];
      assert.ok(Number(d[2]) >= min && Number(d[2]) <= max, `${d[1]}=${d[2]}`);
    }
  }
  assert.equal(presets, 4);
});

test('the page loads only relative files', () => {
  let checked = 0;
  for (const m of html.matchAll(/(?:src|href)\s*=\s*(?:"([^"]+)"|'([^']+)')/g)) {
    const url = m[1] ?? m[2];
    checked++;
    if (url.startsWith('https://github.com/')) continue;
    assert.ok(!url.startsWith('/') && !url.includes('://'), url);
  }
  assert.ok(checked >= 4);
});

test('labels read naturally', () => {
  assert.equal(tempLabel(54.6), '55 °C');
  assert.equal(layerLabel(0.1), '10 cm');
  assert.equal(layerLabel(1.6), '1.6 m');
  assert.equal(distanceLabel(86.4), '86 m');
  assert.equal(distanceLabel(212.4), '210 m');
  assert.equal(distanceLabel(1500), '1.5 km');
  assert.equal(distanceLabel(3000), '3 km');
  assert.equal(degreesLabel(0.00634), '0.36°');
  assert.equal(degreesLabel(-0.001), '0.057°');
});

function say(airOpts, scene) {
  const air = makeAir(airOpts);
  const view = describeView(viewRows(air, scene, 240));
  return verdict(air, scene, { critical: criticalAngle(air, scene.eye), shine: shineStart(air, scene.eye), view });
}

test('the verdict follows the scene', () => {
  const summer = say({}, { eye: 1.2, distance: 300 });
  assert.match(summer, /shine from about 210 m ahead/);
  assert.match(summer, /upside-down copy of its lowest 41 cm/);
  assert.doesNotMatch(summer, /missing/);
  assert.match(say({}, { eye: 1.2, distance: 100 }), /nearer than the shine, so it has no copy/);
  const desert = say({ surface: 68, air: 40, layer: 0.3 }, { eye: 1.7, distance: 900 });
  assert.match(desert, /copy of the board above its lowest 86 cm/);
  assert.match(desert, /bottom 86 cm of the board is missing/);
  assert.match(say({ surface: 22, air: 22 }, { eye: 1.2, distance: 300 }), /no warmer than the air/);
  assert.match(say({ surface: 10, air: 22 }, { eye: 1.2, distance: 300 }), /cooler than the air/);
});

test('the readout table names both layers of air and the stretch of the side view', () => {
  const air = makeAir();
  const r = rows(air, { eye: 1.2, distance: 300 }, { critical: criticalAngle(air, 1.2), shine: 212, top: 0.0035, bottom: -0.0079, stretch: 64.6 });
  assert.deepEqual(r.map(([k]) => k), [
    'Air at the road surface', 'Air at eye level (1.2 m)', 'Rays bend back up if aimed within',
    'The shine starts', 'Height of the view', 'Side view',
  ]);
  assert.equal(r[0][1], '55 °C, refractive index 1.000244');
  assert.equal(r[1][1], '30 °C, refractive index 1.000264');
  assert.equal(r[5][1], 'heights stretched 65 times');
});
