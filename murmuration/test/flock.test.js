import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMS, separation, alignment, cohesion, flockingForce, flee, avoidEdges,
} from '../src/flock.js';
import { length } from '../src/vec.js';

const boid = (x, y, vx = 0, vy = 0) => ({ x, y, vel: { x: vx, y: vy } });
const params = { ...DEFAULT_PARAMS };

test('a lone boid feels no flocking force', () => {
  const b = boid(10, 10, 1, 0);
  assert.deepEqual(separation(b, [b], params), { x: 0, y: 0 });
  assert.deepEqual(alignment(b, [b], params), { x: 0, y: 0 });
  assert.deepEqual(cohesion(b, [b], params), { x: 0, y: 0 });
  assert.deepEqual(flockingForce(b, [], params), { x: 0, y: 0 });
});

test('separation pushes away from a close neighbour and ignores distant ones', () => {
  const b = boid(0, 0);
  const near = boid(5, 0);
  const far = boid(params.separationRadius + 1, 0);
  const force = separation(b, [b, near, far], params);
  assert.ok(force.x < 0, 'pushes away along -x');
  assert.equal(force.y, 0);
  assert.deepEqual(separation(b, [b, far], params), { x: 0, y: 0 });
});

test('separation weights nearer neighbours more heavily', () => {
  const b = boid(0, 0);
  const close = separation(b, [boid(3, 0), boid(0, -12)], { ...params, maxForce: 100, maxSpeed: 1 });
  // Nearer neighbour on +x dominates so the steer is mostly along -x.
  assert.ok(Math.abs(close.x) > Math.abs(close.y));
});

test('alignment steers towards the neighbours average velocity', () => {
  const b = boid(0, 0, 0, 0);
  const force = alignment(b, [boid(1, 1, 0, 2), boid(-1, 1, 0, 2)], params);
  assert.ok(force.y > 0 && Math.abs(force.x) < 1e-12);
  assert.ok(length(force) <= params.maxForce + 1e-12);
});

test('cohesion steers towards the neighbours centre of mass', () => {
  const b = boid(0, 0);
  const force = cohesion(b, [boid(10, 0), boid(10, 4), boid(10, -4)], params);
  assert.ok(force.x > 0 && Math.abs(force.y) < 1e-12);
});

test('every rule respects maxForce', () => {
  const p = { ...params, maxForce: 0.05 };
  const b = boid(0, 0, 5, 5);
  const others = [boid(1, 0, -9, 9), boid(0, 1, 9, -9), boid(2, 2, 0, 0)];
  for (const rule of [separation, alignment, cohesion]) {
    assert.ok(length(rule(b, others, p)) <= 0.05 + 1e-12, rule.name);
  }
});

test('flockingForce weights each rule', () => {
  const b = boid(0, 0);
  const others = [boid(30, 0, 0, 1)];
  const onlyCohesion = flockingForce(b, others, { ...params, separation: 0, alignment: 0, cohesion: 1 });
  const onlyAlignment = flockingForce(b, others, { ...params, separation: 0, alignment: 1, cohesion: 0 });
  assert.ok(onlyCohesion.x > 0 && Math.abs(onlyCohesion.y) < 1e-12);
  assert.ok(onlyAlignment.y > 0 && Math.abs(onlyAlignment.x) < 1e-12);
  assert.deepEqual(flockingForce(b, others, { ...params, separation: 0, alignment: 0, cohesion: 0 }), { x: 0, y: 0 });
});

test('flee ramps up as the threat gets closer and vanishes outside the radius', () => {
  const b = boid(0, 0);
  const far = flee(b, { x: 40, y: 0 }, 50, params);
  const near = flee(b, { x: 5, y: 0 }, 50, params);
  assert.deepEqual(flee(b, { x: 60, y: 0 }, 50, params), { x: 0, y: 0 });
  assert.ok(far.x < 0 && near.x < 0);
  assert.ok(length(near) > length(far));
});

test('avoidEdges steers back inside near each wall and is silent in the middle', () => {
  const p = { ...params };
  const w = 400;
  const h = 300;
  assert.deepEqual(avoidEdges(boid(200, 150, 1, 0), w, h, 40, p), { x: 0, y: 0 });
  assert.ok(avoidEdges(boid(10, 150, -1, 0), w, h, 40, p).x > 0);
  assert.ok(avoidEdges(boid(390, 150, 1, 0), w, h, 40, p).x < 0);
  assert.ok(avoidEdges(boid(200, 10, 0, -1), w, h, 40, p).y > 0);
  assert.ok(avoidEdges(boid(200, 290, 0, 1), w, h, 40, p).y < 0);
  const corner = avoidEdges(boid(5, 5, -1, -1), w, h, 40, p);
  assert.ok(corner.x > 0 && corner.y > 0);
});
