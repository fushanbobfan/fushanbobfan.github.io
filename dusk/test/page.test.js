import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sunLabel, hazeLabel, heightLabel, percent, times, brightness, describe } from '../src/readout.js';
import { renderAll, MIDDAY, middaySky } from '../src/render-worker.js';
import { WAVELENGTHS } from '../src/spectrum.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('every element the script looks up by id is on the page', () => {
  const ids = new Set([...main.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size >= 12);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('every range control and every preset starts inside the limits', () => {
  const ranges = {};
  for (const m of html.matchAll(/<input id="([\w-]+)" type="range" min="([-\d.]+)" max="([\d.]+)" step="([\d.]+)" value="([-\d.]+)">/g)) {
    const [min, max, step, value] = m.slice(2).map(Number);
    ranges[m[1]] = [min, max, step];
    assert.ok(value >= min && value <= max, m[1]);
  }
  assert.deepEqual(Object.keys(ranges).sort(), ['haze', 'height', 'sun']);
  let presets = 0;
  for (const m of html.matchAll(/<button type="button"((?: data-\w+="[-\d.]+")+)>([^<]+)</g)) {
    presets++;
    const data = Object.fromEntries([...m[1].matchAll(/data-(\w+)="([-\d.]+)"/g)].map((d) => [d[1], Number(d[2])]));
    for (const k of ['sun', 'haze', 'height']) {
      const [min, max, step] = ranges[k];
      assert.ok(data[k] >= min && data[k] <= max, `${m[2]}: ${k}`);
      const steps = (data[k] - min) / step;
      assert.ok(Math.abs(steps - Math.round(steps)) < 1e-9, `${m[2]}: ${k} lands on a step`);
    }
    assert.ok(data.fixed === 0 || data.fixed === 1, `${m[2]}: camera`);
  }
  assert.equal(presets, 7);
});

test('the page loads only relative files', () => {
  let checked = 0;
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
    checked++;
    if (m[1].startsWith('https://github.com/')) continue;
    assert.ok(!m[1].startsWith('/') && !m[1].includes('://'), m[1]);
  }
  assert.ok(checked >= 4);
});

test('labels read naturally', () => {
  assert.equal(sunLabel(3), '3° above the horizon');
  assert.equal(sunLabel(-4.5), '4.5° below the horizon');
  assert.equal(sunLabel(0), 'on the horizon');
  assert.equal(hazeLabel(0.06), '0.06 (clear)');
  assert.equal(hazeLabel(0.5), '0.50 (hazy)');
  assert.equal(heightLabel(0), 'sea level');
  assert.equal(heightLabel(500), '500 m');
  assert.equal(heightLabel(11000), '11 km');
  assert.equal(heightLabel(1500), '1.5 km');
  assert.equal(percent(0.684), '68%');
  assert.equal(percent(0.006), '0.6%');
  assert.equal(percent(0.00004), 'under 0.1%');
  assert.equal(percent(0), 'none');
  assert.equal(times(15.2), '15 times as much as with the sun overhead');
  assert.equal(times(1.01), 'about as much as with the sun overhead');
  assert.equal(times(Infinity), 'none: the sun is below your horizon');
  assert.equal(brightness(0.36), '36% as bright as a clear midday sky');
  assert.equal(brightness(0.004), '1/250 as bright as a clear midday sky');
  assert.equal(brightness(1), 'about as bright as a clear midday sky');
});

test('the description follows the sun down', () => {
  const t = (blue, red) => WAVELENGTHS.map((nm) => (nm === 440 ? blue : nm === 660 ? red : 0.5));
  const high = describe({ sun: 60, height: 0, airMass: 1.15, transmission: t(0.7, 0.9), skyRatio: 1 });
  assert.match(high, /stays white/);
  assert.match(high, /blue sky/);
  const low = describe({ sun: 2, height: 0, airMass: 20, transmission: t(0.001, 0.02), skyRatio: 0.2 });
  assert.match(low, /20 times as much air as with the sun overhead/);
  assert.match(low, /orange or red/);
  const set = describe({ sun: -4, height: 0, airMass: Infinity, transmission: t(0, 0), skyRatio: 0.004 });
  assert.match(set, /no sunlight reaches you directly/);
  assert.doesNotMatch(set, /gets through/);
  const up = describe({ sun: 30, height: 30000, airMass: 2, transmission: t(0.98, 0.99), skyRatio: 0.03, fixed: true });
  assert.match(up, /turns dark/);
  assert.match(up, /camera is set for a clear midday/);
});

test('a rough render carries everything the page draws, and the balloon sky is far darker than midday', () => {
  const r = renderAll({ sun: 30, haze: 0.06, height: 30000, fixed: true }, 'rough');
  assert.equal(r.dome.rgb.length, r.dome.size * r.dome.size * 3);
  assert.equal(r.view.rgb.length, r.view.width * r.view.height * 3);
  assert.equal(r.exposure, middaySky().exposure, 'a fixed camera uses the midday exposure');
  assert.ok(r.skyRatio < 0.1, String(r.skyRatio));
  const noon = renderAll({ ...MIDDAY, fixed: false }, 'rough');
  assert.ok(noon.skyRatio > 0.85 && noon.skyRatio < 1.15, String(noon.skyRatio));
  for (const k of ['sun', 'zenith', 'opposite']) assert.equal(noon[k].length, 3);
});
