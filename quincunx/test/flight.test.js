import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IN_FLIGHT, busy, createFlight, enqueue, step } from '../src/flight.js';
import { mulberry32 } from '../src/rng.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);

test('every queued ball eventually lands, once', () => {
  const f = createFlight(10, 0.5, mulberry32(1));
  enqueue(f, 25);
  let landed = 0;
  for (let i = 0; i < 2000 && busy(f); i++) landed += step(f, 0.1);
  assert.equal(landed, 25);
  assert.equal(sum(f.counts), 25);
  assert.equal(busy(f), false);
});

test('balls are released spaced out rather than all at once', () => {
  const f = createFlight(10, 0.5, mulberry32(2));
  enqueue(f, 10);
  step(f, 0.2);
  assert.equal(f.balls.length, 1);
  assert.equal(f.queued, 9);
  step(f, 0.2);
  assert.equal(f.balls.length, 1);
  step(f, 0.3);
  assert.equal(f.balls.length, 2);
  const [a, b] = f.balls;
  assert.ok(a.t - b.t > 0.44);
});

test('a big frame step releases several balls at staggered heights', () => {
  const f = createFlight(30, 0.5, mulberry32(3));
  enqueue(f, 8);
  step(f, 2);
  assert.equal(f.balls.length, 5);
  const ts = f.balls.map((b) => b.t);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i - 1] > ts[i]);
  assert.ok(ts.every((t) => t >= 0));
});

test('anything beyond the animation limit goes straight into the bins', () => {
  const f = createFlight(8, 0.5, mulberry32(4));
  const animated = enqueue(f, MAX_IN_FLIGHT + 250);
  assert.equal(animated, MAX_IN_FLIGHT);
  assert.equal(sum(f.counts), 250);
  assert.equal(enqueue(f, 10), 0);
  assert.equal(sum(f.counts), 260);
});

test('a custom landing rule decides when a ball is counted', () => {
  const f = createFlight(4, 1, mulberry32(5));
  enqueue(f, 1);
  step(f, 0.5, (b) => b.t > 3);
  assert.equal(sum(f.counts), 0);
  step(f, 3, (b) => b.t > 3);
  assert.deepEqual(f.counts, [0, 0, 0, 0, 1]);
});
