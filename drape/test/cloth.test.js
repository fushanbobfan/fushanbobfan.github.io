import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloth, step, relax, strain, maxStrain, windAt } from '../src/cloth.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('a grid has one link per neighbouring pair', () => {
  const c = createCloth({ cols: 5, rows: 4, spacing: 0.1 });
  assert.equal(c.n, 20);
  assert.equal(c.links.count, 4 * 4 + 5 * 3);
  for (let m = 0; m < c.links.count; m++) close(strain(c, m), 0, 1e-12);
});

test('an unpinned particle falls by g dt^2 n(n+1)/2 under position Verlet', () => {
  const c = createCloth({ cols: 1, rows: 1, spacing: 0.1 });
  const dt = 1 / 120;
  const steps = 60;
  for (let s = 0; s < steps; s++) step(c, dt, { damping: 0 });
  close(c.y[0], (9.81 * dt * dt * steps * (steps + 1)) / 2, 1e-12);
  close(c.time, steps * dt, 1e-12);
});

test('pinned particles never move', () => {
  const c = createCloth({ cols: 6, rows: 6, spacing: 0.1, pins: (i, j) => j === 0 });
  const before = Array.from(c.y.slice(0, 6));
  for (let s = 0; s < 300; s++) step(c, 1 / 120, { wind: 4 });
  assert.deepEqual(Array.from(c.y.slice(0, 6)), before);
});

test('relaxation restores a stretched link to its rest length', () => {
  const c = createCloth({ cols: 2, rows: 1, spacing: 1 });
  c.x[1] = 3;
  relax(c);
  close(c.x[1] - c.x[0], 1, 1e-12);
  close((c.x[0] + c.x[1]) / 2, 1.5, 1e-12, 'midpoint stays put');
});

test('a link to a pin moves only the free end', () => {
  const c = createCloth({ cols: 2, rows: 1, spacing: 1, pins: (i) => i === 0 });
  c.x[1] = 2.5;
  relax(c);
  assert.equal(c.x[0], 0);
  close(c.x[1], 1, 1e-12);
});

test('a hanging chain settles close to its rest lengths, tension largest at the top', () => {
  const c = createCloth({ cols: 1, rows: 12, spacing: 0.05, pins: (i, j) => j === 0 });
  for (let s = 0; s < 2000; s++) step(c, 1 / 240, { iterations: 40, damping: 0.02 });
  const top = strain(c, 0);
  const bottom = strain(c, c.links.count - 1);
  assert.ok(maxStrain(c) < 0.01, `max strain ${maxStrain(c)}`);
  assert.ok(top > bottom, `top ${top} bottom ${bottom}`);
  for (let k = 1; k < c.n; k++) close(c.x[k], 0, 1e-9, 'stays vertical');
});

test('a link pulled past the tear ratio snaps and stays broken', () => {
  const c = createCloth({ cols: 3, rows: 1, spacing: 1, pins: (i) => i === 0 });
  c.x[2] = 6;
  const snapped = relax(c, 1.5);
  assert.equal(snapped, 1);
  assert.equal(c.brokenCount, 1);
  assert.equal(c.links.broken[1], 1);
  c.x[2] = 2;
  relax(c, 1.5);
  assert.equal(c.links.broken[1], 1);
});

test('without a tear ratio nothing ever breaks', () => {
  const c = createCloth({ cols: 3, rows: 1, spacing: 1, pins: (i) => i === 0 });
  c.x[2] = 100;
  assert.equal(relax(c), 0);
});

test('the floor stops a falling cloth and nothing passes through it', () => {
  const c = createCloth({ cols: 4, rows: 4, spacing: 0.1 });
  for (let s = 0; s < 600; s++) step(c, 1 / 120, { floor: 1 });
  for (let k = 0; k < c.n; k++) assert.ok(c.y[k] <= 1 + 1e-12);
  close(Math.max(...c.y), 1, 1e-12);
});

test('wind always pushes the way it blows and is zero when calm', () => {
  assert.equal(windAt(0, 0.3, 0.2, 1.1), 0);
  for (let t = 0; t < 10; t += 0.37) {
    const w = windAt(5, Math.sin(t), Math.cos(t), t);
    assert.ok(w >= 5 * 0.35 - 1e-12 && w <= 5 + 1e-12, `${w}`);
    assert.ok(windAt(-5, Math.sin(t), Math.cos(t), t) < 0);
  }
});
