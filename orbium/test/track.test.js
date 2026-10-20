import test from 'node:test';
import assert from 'node:assert/strict';
import { Tracker, compass } from '../src/track.js';
import { World } from '../src/world.js';
import { speciesById, speciesRule, speciesPattern } from '../src/patterns.js';

test('positions unwrap across the seam and speed counts the real distance', () => {
  const t = new Tracker(100);
  t.push(0, { x: 96, y: 50 });
  t.push(1, { x: 99, y: 50 });
  t.push(2, { x: 2, y: 50 });
  t.push(3, { x: 5, y: 50 });
  assert.equal(t.samples[3].x, 105);
  const m = t.motion(10);
  assert.ok(Math.abs(m.speed - 3) < 1e-12);
  assert.ok(Math.abs(m.heading) < 1e-9);
});

test('heading follows the screen: moving up the grid is 90 degrees', () => {
  const t = new Tracker(64);
  t.push(0, { x: 10, y: 40 });
  t.push(1, { x: 10, y: 38 });
  assert.ok(Math.abs(t.motion().heading - 90) < 1e-9);
  t.reset();
  t.push(0, { x: 10, y: 10 });
  t.push(1, { x: 8, y: 12 });
  assert.ok(Math.abs(t.motion().heading - 225) < 1e-9);
  assert.equal(compass(225), 'south-west');
  assert.equal(compass(-10), 'east');
  assert.equal(compass(91), 'north');
});

test('an empty world or a rewind starts a new track, and capacity is kept', () => {
  const t = new Tracker(64, 3);
  for (let i = 0; i < 5; i++) t.push(i, { x: i, y: 0 });
  assert.equal(t.samples.length, 3);
  t.push(1, { x: 0, y: 0 });
  assert.equal(t.samples.length, 1);
  assert.equal(t.motion(), null);
  t.push(2, null);
  assert.equal(t.samples.length, 0);
});

test('the trail splits where the path wraps', () => {
  const t = new Tracker(100);
  for (const [i, x] of [[0, 90], [1, 95], [2, 99], [3, 3], [4, 8]]) t.push(i, { x, y: 10 });
  const segs = t.segments();
  assert.equal(segs.length, 2);
  assert.deepEqual(segs[0].map((p) => p[0]), [90, 95, 99]);
  assert.deepEqual(segs[1].map((p) => p[0]), [3, 8]);
});

test('a tracked Orbium glides at a steady speed', () => {
  const s = speciesById('orbium');
  const w = new World(128, speciesRule(s));
  const p = speciesPattern(s);
  w.place(p, 54, 54);
  const t = new Tracker(128);
  const speeds = [];
  for (let i = 1; i <= 400; i++) {
    w.step();
    if (i % 5 === 0) t.push(w.time, w.centroid());
    if (i % 100 === 0) speeds.push(t.motion(5).speed);
  }
  const lo = Math.min(...speeds);
  const hi = Math.max(...speeds);
  assert.ok(lo > 1, `speed ${lo}`);
  assert.ok(hi / lo < 1.2, `speeds ${speeds.map((v) => v.toFixed(2)).join(', ')}`);
});
