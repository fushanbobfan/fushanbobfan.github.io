import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayer } from '../src/gratings.js';
import { boxBlur, composite, renderInks } from '../src/render.js';
import { fringeMask, fringePhase, latticeMoire, lineMoire, ringMoire } from '../src/moire.js';

const deg = (d) => (d * Math.PI) / 180;
const close = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('two equal gratings turned by θ beat with period p / (2 sin θ/2)', () => {
  const a = makeLayer({ period: 10 });
  const b = makeLayer({ period: 10, angle: deg(6) });
  const m = lineMoire(a, b);
  close(m.period, 10 / (2 * Math.sin(deg(3))), 1e-9);
  // Nearly vertical bars give nearly horizontal fringes, along the half angle.
  close(m.stripeAngle, 3, 1e-9);
});

test('parallel gratings with different periods form a vernier', () => {
  const m = lineMoire(makeLayer({ period: 10 }), makeLayer({ period: 11 }));
  close(m.period, 110, 1e-9);
  close(m.stripeAngle, 90, 1e-9);
  // Slide sheet B one pixel and the fringes travel ten.
  close(m.magnification, 10, 1e-9);
});

test('a grating turned by 178° beats like one turned by -2°', () => {
  const a = makeLayer({ period: 10 });
  const m1 = lineMoire(a, makeLayer({ period: 10, angle: deg(178) }));
  const m2 = lineMoire(a, makeLayer({ period: 10, angle: deg(-2) }));
  close(m1.period, m2.period, 1e-9);
  close(m1.stripeAngle, m2.stripeAngle, 1e-9);
});

test('identical gratings have no fringes', () => {
  const m = lineMoire(makeLayer(), makeLayer());
  assert.equal(m.period, Infinity);
  assert.equal(m.stripeAngle, null);
});

test('turned square lattices beat into a lattice of side p / (2 sin θ/2)', () => {
  const a = makeLayer({ kind: 'dots', period: 12 });
  const m = latticeMoire(a, makeLayer({ kind: 'dots', period: 12, angle: deg(5) }));
  const side = 12 / (2 * Math.sin(deg(2.5)));
  close(m.sides[0], side, 1e-6);
  close(m.sides[1], side, 1e-6);
  // A lattice turned by 85° is the same as one turned by -5°.
  const m2 = latticeMoire(a, makeLayer({ kind: 'dots', period: 12, angle: deg(85) }));
  close(m2.sides[0], side, 1e-6);
  assert.equal(latticeMoire(a, makeLayer({ kind: 'dots', period: 12 })).edges, null);
});

test('ring fringes: count across the centres, spacing when concentric', () => {
  const a = makeLayer({ kind: 'rings', period: 12, x: 100, y: 100 });
  const r = ringMoire(a, makeLayer({ kind: 'rings', period: 12, x: 160, y: 100 }));
  assert.equal(r.crossings, 11);
  const c = ringMoire(makeLayer({ kind: 'rings', period: 10 }), makeLayer({ kind: 'rings', period: 12 }));
  assert.ok(c.concentric);
  close(c.spacing, 60, 1e-9);
});

test('dots over lines have no predicted fringe', () => {
  assert.equal(fringePhase(makeLayer({ kind: 'dots' }), makeLayer(), 3, 4), null);
  const mask = fringeMask(20, 20, makeLayer({ kind: 'dots' }), makeLayer());
  assert.ok(mask.every((v) => v === 0));
});

// Render the two sheets, blur away the fine marks, and check that the
// brightness that is left follows the predicted fringe phase: bright where
// the phase is a whole number, dark half way between.
function agreement(a, b, size = 240, blurRadius = 7) {
  const inks = renderInks(size, size, [a, b]);
  const rgb = composite(inks, [[0, 0, 0], [0, 0, 0]], [255, 255, 255], size * size);
  const lum = new Float32Array(size * size);
  for (let p = 0; p < lum.length; p++) lum[p] = rgb[p * 3];
  const blurred = boxBlur(lum, size, size, blurRadius);
  const xs = [];
  const ys = [];
  const m = 30;
  for (let j = m; j < size - m; j += 2) {
    for (let i = m; i < size - m; i += 2) {
      const ph = fringePhase(a, b, i + 0.5, j + 0.5);
      // Only where the fringes are broad enough to survive the blur.
      const step = fringePhase(a, b, i + 1.5, j + 0.5).map((v, k) => v - ph[k]);
      const stepY = fringePhase(a, b, i + 0.5, j + 1.5).map((v, k) => v - ph[k]);
      const fastest = Math.max(...step.map((v, k) => Math.hypot(v, stepY[k])));
      if (fastest * blurRadius * 5 > 1) continue;
      xs.push(ph.reduce((s, v) => s + Math.cos(2 * Math.PI * v), 0));
      ys.push(blurred[j * size + i]);
    }
  }
  assert.ok(xs.length > 300, `only ${xs.length} points with broad fringes`);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let k = 0; k < xs.length; k++) {
    sxy += (xs[k] - mx) * (ys[k] - my);
    sxx += (xs[k] - mx) ** 2;
    syy += (ys[k] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

test('blurred line gratings follow the predicted fringes', () => {
  const a = makeLayer({ period: 8, duty: 0.5, x: 3 });
  const b = makeLayer({ period: 8, duty: 0.5, angle: deg(7), x: 20, y: 11 });
  assert.ok(agreement(a, b) > 0.9);
});

test('the prediction holds for a flipped sheet and unequal duties', () => {
  const a = makeLayer({ period: 8, duty: 0.3 });
  const b = makeLayer({ period: 9, duty: 0.6, angle: deg(183), x: 5 });
  assert.ok(agreement(a, b) > 0.9);
});

test('blurred rings follow the predicted hyperbolas and ellipses', () => {
  const a = makeLayer({ kind: 'rings', period: 8, x: 90, y: 120 });
  const b = makeLayer({ kind: 'rings', period: 8, x: 150, y: 120 });
  assert.ok(agreement(a, b) > 0.85);
});

test('blurred dot lattices follow the predicted moiré lattice', () => {
  const a = makeLayer({ kind: 'dots', period: 8, duty: 0.4 });
  const b = makeLayer({ kind: 'dots', period: 8, duty: 0.4, angle: deg(6), x: 4, y: 2 });
  assert.ok(agreement(a, b) > 0.85);
});

test('the fringe mask traces curves only where the beat is broad', () => {
  const a = makeLayer({ period: 8 });
  const broad = fringeMask(120, 120, a, makeLayer({ period: 8, angle: deg(5) }));
  const lit = broad.filter((v) => v > 128).length;
  assert.ok(lit > 100 && lit < 120 * 120 * 0.2, `${lit} pixels lit`);
  // Crossed at 60° the beat is as fine as the lines: nothing to trace.
  const fine = fringeMask(120, 120, a, makeLayer({ period: 8, angle: deg(60) }));
  assert.ok(fine.every((v) => v === 0));
  // Identical sheets: no beat, nothing traced.
  assert.ok(fringeMask(40, 40, a, makeLayer({ period: 8 })).every((v) => v === 0));
});

test('ring fringe count follows the ink widths as fringePhase measures them', () => {
  const a = makeLayer({ kind: 'rings', period: 10, duty: 0.1, x: 0, y: 0 });
  const b = makeLayer({ kind: 'rings', period: 10, duty: 0.9, x: 82, y: 0 });
  // Centred difference phase runs from -7.8 to 8.6: sixteen whole numbers.
  assert.equal(ringMoire(a, b).crossings, 16);
  // Count the whole-number crossings of the phase itself along the segment.
  let crossings = 0;
  let prev = null;
  for (let x = 0.01; x <= 81.99; x += 0.01) {
    const pa = x / 10 - 0.05;
    const pb = (82 - x) / 10 - 0.45;
    const diff = pa - pb;
    if (prev !== null && Math.floor(diff) !== Math.floor(prev)) crossings++;
    prev = diff;
  }
  assert.equal(crossings, 16);
});
