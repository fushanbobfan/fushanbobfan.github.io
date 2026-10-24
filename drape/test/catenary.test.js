import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveA, catenary, rmsGap } from '../src/catenary.js';
import { createCloth, step } from '../src/cloth.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('solveA recovers a known parameter', () => {
  const a = 0.7;
  const h = 2;
  const lh = 2 * a * Math.sinh(h / (2 * a));
  close(solveA(h, lh), a, 1e-12);
  assert.ok(Number.isNaN(solveA(2, 1.9)), 'too short to span');
});

test('a level catenary passes through both supports with the right length and sag', () => {
  const cat = catenary(0, 0, 2, 0, 3);
  close(cat.yAt(0), 0, 1e-12);
  close(cat.yAt(2), 0, 1e-12);
  close(cat.lowest.x, 1, 1e-12);
  close(cat.lowest.y, cat.a * (Math.cosh(1 / cat.a) - 1), 1e-12, 'sag below the supports');
  close(2 * cat.a * Math.sinh(1 / cat.a), 3, 1e-9, 'arc length');
});

test('an uneven catenary passes through both supports and has the requested length', () => {
  const cat = catenary(0.3, 0.2, 2.1, 0.9, 2.6);
  close(cat.yAt(0.3), 0.2, 1e-9);
  close(cat.yAt(2.1), 0.9, 1e-9);
  let len = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const xa = 0.3 + (1.8 * i) / n;
    const xb = 0.3 + (1.8 * (i + 1)) / n;
    len += Math.hypot(xb - xa, cat.yAt(xb) - cat.yAt(xa));
  }
  close(len, 2.6, 1e-6, 'arc length');
  assert.ok(cat.lowest.y > 0.9, 'dips below the lower support');
});

test('the order of the supports does not matter', () => {
  const p = catenary(0, 0, 2, 0.5, 3);
  const q = catenary(2, 0.5, 0, 0, 3);
  for (const x of [0.1, 0.8, 1.7]) close(p.yAt(x), q.yAt(x), 1e-12);
});

test('a chain too short to reach, or hung vertically, has no catenary', () => {
  assert.equal(catenary(0, 0, 2, 0, 1.9), null);
  assert.equal(catenary(0, 0, 0, 1, 3), null);
});

test('a simulated chain settles onto the catenary', () => {
  const n = 61;
  const spacing = 0.04;
  const span = 1.6;
  const c = createCloth({ cols: n, rows: 1, spacing, pins: (i) => i === 0 || i === n - 1 });
  for (let k = 0; k < n; k++) c.x[k] = c.px[k] = (span * k) / (n - 1);
  for (let s = 0; s < 3000; s++) step(c, 1 / 120, { iterations: 80, damping: 0.03 });
  let length = 0;
  for (let k = 1; k < n; k++) length += Math.hypot(c.x[k] - c.x[k - 1], c.y[k] - c.y[k - 1]);
  close(length, spacing * (n - 1), 0.01 * spacing * (n - 1), 'barely stretched');
  const cat = catenary(c.x[0], c.y[0], c.x[n - 1], c.y[n - 1], length);
  const sag = Math.max(...c.y);
  assert.ok(Math.abs(sag - cat.lowest.y) < 0.01 * cat.lowest.y, `sag ${sag} vs ${cat.lowest.y}`);
  assert.ok(rmsGap(cat, c.x, c.y) < 0.005, `rms gap ${rmsGap(cat, c.x, c.y)}`);
});
