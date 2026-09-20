import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, EDGE_MODES, DEFAULT_OBSTACLE_RADIUS, MIN_OBSTACLE_RADIUS } from '../src/simulation.js';
import { length } from '../src/vec.js';

const make = (opts = {}) => new Simulation({ width: 400, height: 300, count: 50, seed: 7, ...opts });

test('constructor validates the world size', () => {
  assert.throws(() => new Simulation({ width: 0, height: 10 }), RangeError);
  assert.throws(() => new Simulation({ width: 10, height: -1 }), RangeError);
});

test('spawns the requested number of boids inside the world', () => {
  const sim = make();
  assert.equal(sim.boids.length, 50);
  for (const b of sim.boids) {
    assert.ok(b.x >= 0 && b.x < 400 && b.y >= 0 && b.y < 300);
    assert.ok(length(b.vel) <= sim.params.maxSpeed + 1e-12);
  }
});

test('the same seed reproduces the same flock and trajectory', () => {
  const a = make();
  const b = make();
  for (let i = 0; i < 30; i++) {
    a.step();
    b.step();
  }
  assert.deepEqual(a.boids, b.boids);
  assert.equal(a.tick, 30);
});

test('boids get unique ids that reset restores', () => {
  const sim = make();
  const ids = sim.boids.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  sim.setCount(60);
  assert.equal(new Set(sim.boids.map((b) => b.id)).size, 60);
  sim.reset();
  assert.deepEqual(sim.boids.map((b) => b.id), Array.from({ length: 60 }, (_, i) => i));
});

test('setCount grows and shrinks without disturbing survivors', () => {
  const sim = make();
  const first = { ...sim.boids[0] };
  sim.setCount(80);
  assert.equal(sim.boids.length, 80);
  assert.deepEqual(sim.boids[0], first);
  sim.setCount(10);
  assert.equal(sim.boids.length, 10);
  assert.deepEqual(sim.boids[0], first);
  sim.setCount(-5);
  assert.equal(sim.boids.length, 0);
});

test('reset restores the initial flock', () => {
  const sim = make();
  const initial = JSON.stringify(sim.boids);
  for (let i = 0; i < 10; i++) sim.step();
  assert.notEqual(JSON.stringify(sim.boids), initial);
  sim.reset();
  assert.equal(JSON.stringify(sim.boids), initial);
  assert.equal(sim.tick, 0);
});

test('speed never exceeds maxSpeed after many steps', () => {
  const sim = make({ count: 120 });
  for (let i = 0; i < 200; i++) sim.step();
  for (const b of sim.boids) assert.ok(length(b.vel) <= sim.params.maxSpeed + 1e-9);
});

test('avoid mode keeps the flock inside the world', () => {
  const sim = make({ count: 150, edgeMode: 'avoid' });
  for (let i = 0; i < 600; i++) sim.step();
  for (const b of sim.boids) {
    assert.ok(b.x >= 0 && b.x <= 400, `x out of bounds: ${b.x}`);
    assert.ok(b.y >= 0 && b.y <= 300, `y out of bounds: ${b.y}`);
  }
});

test('wrap mode keeps every boid inside [0, size)', () => {
  const sim = make({ count: 150, edgeMode: 'wrap' });
  for (let i = 0; i < 600; i++) sim.step();
  for (const b of sim.boids) {
    assert.ok(b.x >= 0 && b.x < 400);
    assert.ok(b.y >= 0 && b.y < 300);
  }
});

test('a boid pushed through a wall in avoid mode is reflected back inside', () => {
  const sim = make({ count: 1, edgeMode: 'avoid', params: { maxSpeed: 5 } });
  const b = sim.boids[0];
  b.x = 399;
  b.y = 150;
  b.vel = { x: 5, y: 0 };
  sim.step();
  assert.ok(b.x <= 400);
  assert.ok(b.vel.x < 0, 'velocity reflected');
});

test('wrapping carries a boid to the opposite edge', () => {
  const sim = make({ count: 1, edgeMode: 'wrap', params: { maxSpeed: 5 } });
  const b = sim.boids[0];
  b.x = 399.5;
  b.y = 0.5;
  b.vel = { x: 5, y: -5 };
  sim.step();
  assert.ok(b.x < 10 && b.y > 290);
});

test('setEdgeMode rejects unknown modes and lists the supported ones', () => {
  const sim = make();
  assert.throws(() => sim.setEdgeMode('bounce'), RangeError);
  for (const mode of EDGE_MODES) sim.setEdgeMode(mode);
  assert.equal(sim.edgeMode, EDGE_MODES[EDGE_MODES.length - 1]);
});

test('setParams merges and rebuilds the hash when perception changes', () => {
  const sim = make();
  const before = sim.hash;
  sim.setParams({ cohesion: 2 });
  assert.equal(sim.params.cohesion, 2);
  assert.equal(sim.hash, before);
  sim.setParams({ perception: 90 });
  assert.notEqual(sim.hash, before);
  assert.equal(sim.hash.cellSize, 90);
});

test('a threat drives nearby boids away from it', () => {
  const sim = make({ count: 0 });
  sim.setCount(0);
  sim.boids.push({ x: 200, y: 150, vel: { x: 0, y: 0 } });
  sim.setThreat({ x: 190, y: 150 });
  for (let i = 0; i < 20; i++) sim.step();
  assert.ok(sim.boids[0].x > 200);
  sim.setThreat(null);
  assert.equal(sim.threat, null);
});

test('resize scales positions proportionally', () => {
  const sim = make({ count: 1 });
  sim.boids[0].x = 100;
  sim.boids[0].y = 150;
  sim.resize(800, 600);
  assert.deepEqual([sim.boids[0].x, sim.boids[0].y], [200, 300]);
  assert.throws(() => sim.resize(0, 1), RangeError);
});

test('cohesion pulls a scattered flock closer together over time', () => {
  const sim = make({ count: 60, params: { separation: 0.3, cohesion: 2, perception: 150 } });
  const spread = () => {
    const cx = sim.boids.reduce((s, b) => s + b.x, 0) / sim.boids.length;
    const cy = sim.boids.reduce((s, b) => s + b.y, 0) / sim.boids.length;
    return sim.boids.reduce((s, b) => s + Math.hypot(b.x - cx, b.y - cy), 0) / sim.boids.length;
  };
  const before = spread();
  for (let i = 0; i < 150; i++) sim.step();
  assert.ok(spread() < before, `spread did not shrink: ${before} -> ${spread()}`);
});

test('obstacles can be added, removed by point and cleared', () => {
  const sim = make();
  const o = sim.addObstacle(100, 100, 20);
  assert.deepEqual(o, { x: 100, y: 100, r: 20 });
  assert.equal(sim.addObstacle(50, 50, 1).r, MIN_OBSTACLE_RADIUS, 'radius has a floor');
  assert.equal(sim.addObstacle(200, 200).r, DEFAULT_OBSTACLE_RADIUS);
  assert.equal(sim.obstacles.length, 3);
  assert.equal(sim.removeObstacleAt(115, 100), true, 'inside the first obstacle');
  assert.equal(sim.removeObstacleAt(300, 10), false, 'empty space');
  assert.equal(sim.obstacles.length, 2);
  sim.clearObstacles();
  assert.equal(sim.obstacles.length, 0);
});

test('obstacles survive reset and rescale with the world', () => {
  const sim = make();
  sim.addObstacle(200, 150, 20);
  sim.reset();
  assert.equal(sim.obstacles.length, 1);
  sim.resize(800, 600);
  assert.deepEqual(sim.obstacles[0], { x: 400, y: 300, r: 40 });
});

test('no boid ends a frame inside an obstacle', () => {
  const sim = make({ count: 300, params: { cohesion: 3, separation: 0 } });
  const obstacles = [sim.addObstacle(200, 150, 40), sim.addObstacle(80, 80, 25), sim.addObstacle(320, 220, 30)];
  for (let i = 0; i < 400; i++) {
    sim.step();
    for (const b of sim.boids) {
      for (const o of obstacles) {
        assert.ok(Math.hypot(b.x - o.x, b.y - o.y) >= o.r - 1e-9, `boid inside obstacle at tick ${sim.tick}`);
      }
    }
  }
});

test('collideObstacles puts an intruding boid on the rim and reflects it', () => {
  const sim = make({ count: 0 });
  sim.addObstacle(100, 100, 30);
  const b = { id: 0, x: 110, y: 100, vel: { x: -2, y: 1 } };
  sim.collideObstacles(b);
  assert.ok(Math.abs(Math.hypot(b.x - 100, b.y - 100) - 30) < 1e-9);
  assert.ok(b.vel.x > 0, 'inward x component reflected');
  assert.equal(b.vel.y, 1, 'tangential component untouched');
});

test('the flock actually steers around an obstacle in its path', () => {
  // A tight stream heading straight at a wall: without avoidance most of it
  // would hit; with it, hardly any boid should need the hard collision guard.
  const sim = make({ count: 0, params: { cohesion: 0, alignment: 0, separation: 0 } });
  sim.setEdgeMode('wrap');
  const wall = sim.addObstacle(250, 150, 30);
  for (let i = 0; i < 40; i++) sim.boids.push({ id: i, x: 20 + (i % 5) * 4, y: 140 + (i % 8) * 3, vel: { x: 3, y: 0 } });
  let contacts = 0;
  for (let t = 0; t < 120; t++) {
    sim.step();
    for (const b of sim.boids) if (Math.hypot(b.x - wall.x, b.y - wall.y) < wall.r + 0.5) contacts++;
  }
  assert.ok(contacts <= 4, `expected the stream to part around the wall, got ${contacts} rim contacts`);
  assert.ok(sim.boids.every((b) => b.x > wall.x), 'the stream made it past the wall');
});
