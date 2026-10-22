import test from 'node:test';
import assert from 'node:assert/strict';
import { makeElement } from '../src/elements.js';
import { trace } from '../src/tracer.js';
import { refractiveIndex, MATERIALS } from '../src/optics.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);
const dir = (s) => {
  const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  return { x: (s.x2 - s.x1) / l, y: (s.y2 - s.y1) / l };
};
const escaped = (segments) => segments.filter((s) => s.fate === 'escape');
const brightest = (segs) => segs.reduce((a, b) => (b.intensity > a.intensity ? b : a));
const n532 = refractiveIndex(MATERIALS.bk7, 532);
const R0 = ((n532 - 1) / (n532 + 1)) ** 2;

// Where a segment crosses the line y = y0.
const crossX = (s, y0) => s.x1 + ((y0 - s.y1) * (s.x2 - s.x1)) / (s.y2 - s.y1);

test('a laser with nothing in the way escapes unchanged', () => {
  const { segments, stats } = trace([makeElement('laser', 0, 0)]);
  assert.equal(segments.length, 1);
  assert.equal(stats.escaped, 1);
  assert.equal(segments[0].intensity, 1);
});

test('normal incidence through a block passes straight through, losing two Fresnel reflections', () => {
  const { segments } = trace([makeElement('laser', 0, 0), makeElement('block', 300, 0)]);
  const out = brightest(escaped(segments).filter((s) => s.x2 > s.x1));
  close(dir(out).x, 1, 1e-9);
  close(out.y1, 0, 1e-9);
  close(out.intensity, (1 - R0) ** 2, 1e-9);
});

test('an oblique ray leaves a slab parallel to how it entered, shifted sideways', () => {
  const angle = 0.5;
  const { segments } = trace([
    makeElement('laser', 0, 0, angle),
    makeElement('block', 400, 0, Math.PI / 2, { width: 1000, height: 100 }),
  ]);
  const out = brightest(escaped(segments).filter((s) => s.x2 > 450));
  const d = dir(out);
  close(Math.atan2(d.y, d.x), angle, 1e-9);
  const inside = segments.find((s) => s.x1 > 349 && s.x1 < 351 && s.x2 > 449);
  const t = Math.atan2(dir(inside).y, dir(inside).x);
  close(Math.sin(angle), n532 * Math.sin(t), 1e-9);
});

test('energy is conserved when nothing absorbs and nothing is dropped', () => {
  const bench = [
    makeElement('beam', 0, 0, 0.1, { width: 120, count: 7 }),
    makeElement('prism', 300, 0, 0.3),
    makeElement('ball', 520, 30, 0, { radius: 60 }),
  ];
  const { segments, stats } = trace(bench, { minIntensity: 1e-6, maxDepth: 400 });
  const total = escaped(segments).reduce((s, x) => s + x.intensity, 0);
  close(total + stats.lost, 7, 1e-9);
  assert.ok(stats.lost < 1e-4);
});

test('a right-angle prism turns a laser through ninety degrees by total internal reflection', () => {
  const prism = makeElement('prism', 0, 0, 0, { apex: 90, side: 200 });
  const s2 = Math.SQRT1_2;
  const laser = makeElement('laser', -140, -80, Math.PI / 4);
  const { segments } = trace([laser, prism]);
  const out = brightest(escaped(segments));
  close(dir(out).x, s2, 1e-9);
  close(dir(out).y, -s2, 1e-9);
  close(out.intensity, (1 - R0) ** 2, 1e-9);
});

test('a convex lens brings a paraxial beam to a focus near the lensmaker focal length', () => {
  const lens = makeElement('convexLens', 0, 0, 0, { radius: 400, aperture: 60 });
  const { segments } = trace([makeElement('beam', -300, 0, 0, { width: 6, count: 2 }), lens]);
  const f = 1 / ((n532 - 1) * (2 / 400));
  const exits = escaped(segments).filter((s) => s.intensity > 0.5);
  assert.equal(exits.length, 2);
  for (const s of exits) close(crossX(s, 0), f, f * 0.03);
});

test('a concave lens spreads a beam out', () => {
  const lens = makeElement('concaveLens', 0, 0);
  const { segments } = trace([makeElement('beam', -300, 0, 0, { width: 40, count: 2 }), lens]);
  const exits = escaped(segments).filter((s) => s.intensity > 0.5);
  const [lo, hi] = exits.sort((a, b) => a.y1 - b.y1);
  assert.ok(dir(lo).y < -0.01 && dir(hi).y > 0.01);
});

test('a concave mirror focuses parallel light at half its radius of curvature', () => {
  const mirror = makeElement('curvedMirror', 0, 0, 0, { radius: 600, aperture: 60 });
  const { segments } = trace([makeElement('beam', -500, 0, 0, { width: 8, count: 2 }), mirror]);
  const back = escaped(segments);
  assert.equal(back.length, 2);
  for (const s of back) {
    assert.ok(s.x2 < s.x1);
    close(crossX(s, 0), -300, 1);
    close(s.intensity, 0.95, 1e-12);
  }
});

test('a blocker absorbs what reaches it', () => {
  const { segments, stats } = trace([makeElement('laser', 0, 0), makeElement('blocker', 100, 0)]);
  assert.equal(segments.length, 1);
  assert.equal(stats.absorbed, 1);
  close(segments[0].x2, 100, 1e-9);
});

test('two facing mirrors are cut off by the depth and segment limits', () => {
  const bench = [
    makeElement('laser', 0, 0),
    makeElement('mirror', 100, 0),
    makeElement('mirror', -100, 0),
  ];
  const deep = trace(bench, { maxDepth: 1000, minIntensity: 0 });
  assert.ok(deep.stats.dropped === 1 || deep.stats.truncated);
  const capped = trace(bench, { maxSegments: 10, minIntensity: 0, maxDepth: 1000 });
  assert.equal(capped.segments.length, 10);
  assert.equal(capped.stats.truncated, true);
});

test('a prism spreads white light: violet leaves bent further than red', () => {
  // Aimed at the middle of the left face near minimum deviation for SF10.
  const beam = makeElement('laser', -221, 74, -0.54, { light: 'white', samples: 7 });
  const prism = makeElement('prism', 0, 0, 0, { material: 'sf10', side: 200 });
  const { segments } = trace([beam, prism]);
  const out = escaped(segments).filter((s) => s.intensity > 0.5 && s.x1 > 0);
  const byWavelength = new Map(out.map((s) => [s.wavelength, s]));
  assert.equal(byWavelength.size, 7);
  const angle = (s) => Math.atan2(dir(s).y, dir(s).x);
  const wls = [...byWavelength.keys()].sort((a, b) => a - b);
  for (let i = 1; i < wls.length; i++) {
    assert.ok(angle(byWavelength.get(wls[i])) < angle(byWavelength.get(wls[i - 1])),
      `${wls[i]} nm should be deviated less than ${wls[i - 1]} nm`);
  }
  for (const s of out) assert.ok(s.share < 1);
});

test('a glass ball sends white light back towards the source, red at a wider angle than violet', () => {
  const ball = makeElement('ball', 0, 0, 0, { radius: 100 });
  const sun = makeElement('laser', -400, -86, 0, { light: 'white', samples: 5 });
  const { segments } = trace([sun, ball], { minIntensity: 1e-4 });
  const returning = escaped(segments).filter((s) => s.x2 < s.x1 && s.x1 > -101 && s.x1 < 0);
  const angles = new Map();
  for (const s of returning) {
    const d = dir(s);
    const dev = (Math.acos(-d.x) * 180) / Math.PI;
    if (!angles.has(s.wavelength) || s.intensity > angles.get(s.wavelength).intensity) {
      angles.set(s.wavelength, { dev, intensity: s.intensity });
    }
  }
  assert.equal(angles.size, 5);
  const wls = [...angles.keys()].sort((a, b) => a - b);
  for (const wl of wls) assert.ok(angles.get(wl).dev > 10 && angles.get(wl).dev < 60);
  // Glass is denser for violet, so violet comes back closer to the source
  // direction than red, as in the primary rainbow.
  for (let i = 1; i < wls.length; i++) assert.ok(angles.get(wls[i]).dev > angles.get(wls[i - 1]).dev);
});
