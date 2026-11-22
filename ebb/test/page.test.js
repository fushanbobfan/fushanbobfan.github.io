import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderField, arrows, ocean, samplePoints, labelPositions } from '../src/field.js';
import { rows, tideKind, distanceLabel, gFraction, cm } from '../src/readout.js';
import { moon, sun, MOON_PERIGEE, tidalScale } from '../src/tides.js';

const count = (s, re) => (s.match(re) || []).length;

test('the picture draws an arrow or a dot at every sample point and no NaN', () => {
  for (const mode of ['pull', 'tidal']) {
    for (const sunBody of [null, sun(1.2)]) {
      const r = renderField({ moonBody: moon(0.4), sunBody, mode });
      assert.equal(r.arrows, samplePoints().length);
      assert.equal(count(r.svg, /marker-end/g) + count(r.svg, /class="dot"/g), samplePoints().length);
      assert.ok(!r.svg.includes('NaN'));
      assert.equal(count(r.svg, /class="sun"/g), sunBody ? 1 : 0);
    }
  }
});

test('the centre gets no leftover pull, and the full pull there is the longest-ish arrow', () => {
  const t = arrows([moon()], 'tidal');
  assert.ok(t.list[0].size < 1e-12);
  near(t.longest, tidalScale(moon()) * 1.025, 0.02 * tidalScale(moon()));
  const p = arrows([moon()], 'pull');
  const sizes = p.list.map((a) => a.size);
  // Every pull arrow is within a few percent of the longest.
  assert.ok(Math.min(...sizes) / Math.max(...sizes) > 0.93);
});

test('the ocean is drawn longest along the line to the Moon', () => {
  const { pts, exaggeration } = ocean([moon(Math.PI / 2)]);
  const r = (p) => Math.hypot(p.x, p.y);
  const top = pts[45];
  const right = pts[0];
  assert.ok(r(top) > 1.19 && r(top) < 1.21);
  assert.ok(r(right) < 1);
  assert.ok(exaggeration > 3e6 && exaggeration < 4e6);
});

test('readouts name spring and neap tides and the Moon\'s distance', () => {
  assert.match(tideKind(0, Math.PI), /spring/);
  assert.match(tideKind(0, 0.1), /spring/);
  assert.match(tideKind(0, Math.PI / 2), /neap/);
  assert.equal(tideKind(0, Math.PI / 4), '');
  assert.match(distanceLabel(MOON_PERIGEE), /57\.0 Earth radii \(363,300 km, its nearest\)/);
  assert.equal(gFraction(1.13e-6), "about 1/8,700,000 of the Earth's own gravity");
  assert.equal(cm(0.357), '36 cm');
  assert.equal(cm(0.05), '5.0 cm');
  const neap = rows({ moonBody: moon(0), sunBody: sun(Math.PI / 2), longest: 1e-6, exaggeration: 4e6, mode: 'tidal' });
  const both = neap.find(([k]) => k === 'Both together')[1];
  assert.match(both, /^29 cm .*neap/);
  const near = rows({ moonBody: moon(0, MOON_PERIGEE), sunBody: null, longest: 1e-6, exaggeration: 4e6, mode: 'tidal' });
  assert.ok(near.some(([k, v]) => k === 'Against the average Moon' && v === '1.18 times the tide'));
});

test('the Moon and Sun labels stay apart at every pair of directions', () => {
  for (let m = 0; m < 360; m += 5) {
    for (let s = 0; s < 360; s += 5) {
      const L = labelPositions(moon(m * Math.PI / 180), sun(s * Math.PI / 180));
      // Labels are about 0.55 wide and 0.2 tall in drawing units.
      const apart = Math.abs(L.moon.x - L.sun.x) > 0.6 || Math.abs(L.moon.y - L.sun.y) > 0.25;
      assert.ok(apart, `labels collide with Moon at ${m} and Sun at ${s}`);
    }
  }
});

test('the page has the controls the script looks up', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const [, id] of js.matchAll(/\$\('([a-z-]+)'\)/g)) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

function near(a, b, tol) {
  assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
}
