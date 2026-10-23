import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, traverse, stateAt, pathLength } from '../src/motion.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

function subdivide(x1, y1, x2, y2, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n);
  return pts;
}

test('free fall takes sqrt(2h/g)', () => {
  const path = traverse([0, 0, 0, 2]);
  close(path.total, Math.sqrt((2 * 2) / G), 1e-12);
});

test('a straight incline takes sqrt(2 L^2 / (g h)) however finely it is cut', () => {
  const exact = Math.sqrt((2 * 25) / (G * 4));
  close(traverse([0, 0, 3, 4]).total, exact, 1e-12);
  close(traverse(subdivide(0, 0, 3, 4, 137)).total, exact, 1e-12);
});

test('speed at every vertex is sqrt(2 g y)', () => {
  const pts = [0, 0, 0.5, 1, 1.5, 1.2, 2, 0.4, 3, 0.9];
  const path = traverse(pts);
  for (let i = 0; i < pts.length / 2; i++) close(path.speeds[i], Math.sqrt(2 * G * pts[2 * i + 1]), 1e-12);
});

test('position on an incline follows s = a t^2 / 2', () => {
  const path = traverse([0, 0, 3, 4]);
  const t = path.total / 2;
  const s = 0.5 * G * (4 / 5) * t * t;
  const p = stateAt(path, t);
  close(p.x, (s * 3) / 5, 1e-12);
  close(p.y, (s * 4) / 5, 1e-12);
  assert.equal(p.done, false);
  assert.equal(stateAt(path, path.total + 1).done, true);
});

test('stateAt is continuous across vertices', () => {
  const path = traverse([0, 0, 0.2, 1, 1, 1.3, 2.5, 1.1]);
  for (const k of [1, 2]) {
    const a = stateAt(path, path.times[k] - 1e-9);
    const b = stateAt(path, path.times[k] + 1e-9);
    close(a.x, b.x, 1e-7);
    close(a.y, b.y, 1e-7);
  }
});

test('a valley back up to the release height is reached with zero speed', () => {
  const path = traverse([0, 0, 1, 1, 2, 0]);
  assert.ok(Number.isFinite(path.total));
  close(path.speeds[2], 0, 0);
  close(path.total, 2 * Math.sqrt((2 * 2) / (G * 1)), 1e-12);
});

test('a path that climbs above the start turns the bead back', () => {
  const path = traverse([0, 0, 1, 1, 2, -1, 3, 2]);
  assert.equal(path.total, Infinity);
  assert.equal(path.turn.seg, 1);
  // the climb from y = 1 to y = -1 crosses the release height halfway along
  close(path.turn.s, Math.hypot(1, 2) / 2, 1e-12);
  const T = path.turn.time;
  const top = stateAt(path, T);
  close(top.y, 0, 1e-9);
  close(top.v, 0, 1e-6);
  for (const d of [0.05, 0.3, 0.6]) {
    const a = stateAt(path, T - d), b = stateAt(path, T + d);
    close(a.x, b.x, 1e-9);
    close(a.y, b.y, 1e-9);
  }
  const back = stateAt(path, 2 * T);
  close(back.x, 0, 1e-9);
  close(back.y, 0, 1e-9);
});

test('a flat or rising first piece never lets the bead start', () => {
  for (const pts of [[0, 0, 1, 0, 2, 1], [0, 0, 1, -0.5]]) {
    const path = traverse(pts);
    assert.equal(path.turn.time, 0);
    const p = stateAt(path, 3);
    assert.equal(p.x, 0);
    assert.equal(p.y, 0);
  }
});

test('repeated points cost no time', () => {
  close(traverse([0, 0, 0, 0, 3, 4, 3, 4]).total, traverse([0, 0, 3, 4]).total, 1e-12);
});

test('path length', () => {
  close(pathLength([0, 0, 3, 4, 3, 5]), 6, 1e-12);
});
