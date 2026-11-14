import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSystem, regularMagnets, step, energy, fate, trappedBy, magnetTraps, potential,
} from '../src/model.js';

const three = () => makeSystem(regularMagnets(3));

test('regular magnets sit on a circle, evenly spaced', () => {
  const ms = regularMagnets(4, 2);
  for (const m of ms) assert.ok(Math.abs(Math.hypot(m.x, m.y) - 2) < 1e-12);
  const d01 = Math.hypot(ms[0].x - ms[1].x, ms[0].y - ms[1].y);
  const d12 = Math.hypot(ms[1].x - ms[2].x, ms[1].y - ms[2].y);
  assert.ok(Math.abs(d01 - d12) < 1e-12);
  assert.ok(Math.abs(ms[0].x) < 1e-12 && ms[0].y > 0, 'first magnet straight up');
});

test('without friction the energy holds steady over a long swing', () => {
  const sys = makeSystem(regularMagnets(3), { friction: 0, dt: 0.005 });
  const s = { x: 1.6, y: -0.4, vx: 0, vy: 0.3 };
  const e0 = energy(sys, s);
  for (let n = 0; n < 4000; n++) step(sys, s);
  assert.ok(Math.abs(energy(sys, s) - e0) < 1e-3 * Math.abs(e0) + 1e-4);
});

test('with friction the energy never rises', () => {
  const sys = three();
  const s = { x: -1.7, y: 1.2, vx: 0, vy: 0 };
  let e = energy(sys, s);
  for (let n = 0; n < 3000; n++) {
    step(sys, s);
    const e2 = energy(sys, s);
    assert.ok(e2 <= e + 1e-9, `energy rose at step ${n}`);
    e = e2;
  }
});

test('every magnet has a well, and the rim lies above its floor', () => {
  const sys = three();
  for (const [i, t] of sys.traps.entries()) {
    assert.ok(t.hasWell, `magnet ${i}`);
    assert.ok(potential(sys, t.x, t.y) < t.rim);
  }
});

test('a bob released on top of a magnet is caught at once', () => {
  const sys = three();
  const m = sys.magnets[1];
  assert.deepEqual(fate(sys, m.x, m.y), { magnet: 1, time: 0 });
});

test('a bob released just beyond a magnet falls onto it', () => {
  const sys = three();
  const r = fate(sys, 0, 1.7);
  assert.equal(r.magnet, 0);
  assert.ok(r.time > 0 && r.time < 50);
});

test('turning the start by a third of a circle moves the fate to the next magnet', () => {
  const sys = three();
  const starts = [[1.9, 0.7], [-0.4, -1.8], [1.1, -1.5], [-1.3, 0.2]];
  const turn = (2 * Math.PI) / 3;
  for (const [x, y] of starts) {
    const a = fate(sys, x, y);
    const b = fate(sys, x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn));
    assert.notEqual(a.magnet, -1);
    assert.equal(b.magnet, (a.magnet + 1) % 3, `start ${x},${y}`);
    assert.ok(Math.abs(a.time - b.time) < 0.5, 'same path turned, same time');
  }
});

test('once trapped, a bob stays inside its trap for good', () => {
  const sys = three();
  const s = { x: 2.1, y: -1.4, vx: 0, vy: 0 };
  let caught = -1;
  for (let n = 0; n < 20000 && caught < 0; n++) {
    caught = trappedBy(sys, s);
    if (caught < 0) step(sys, s);
  }
  assert.ok(caught >= 0);
  const t = sys.traps[caught];
  for (let n = 0; n < 5000; n++) {
    step(sys, s);
    assert.ok(Math.hypot(s.x - t.x, s.y - t.y) < t.radius);
  }
});

test('magnets too weak to beat the centre pull form no well and catch nothing', () => {
  const sys = makeSystem(regularMagnets(3, 1, 0.02), { pull: 2, maxTime: 30 });
  assert.ok(sys.traps.every((t) => !t.hasWell));
  assert.equal(fate(sys, 1.2, 0.4).magnet, -1);
});

test('traps never overlap, however close the magnets', () => {
  const sys = makeSystem([{ x: 0, y: 0, strength: 1 }, { x: 0.3, y: 0, strength: 1 }]);
  const [a, b] = magnetTraps(sys);
  assert.ok(a.radius + b.radius < 0.3);
});
