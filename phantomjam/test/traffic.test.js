import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import {
  carCountFor,
  createRoad,
  density,
  gapAhead,
  step,
  setCarCount,
  setDensity,
  stopCarNear,
  occupancy,
  deterministicFlow,
} from '../src/traffic.js';

function assertWellFormed(road) {
  const { cars, cells, vmax } = road;
  const seen = new Set();
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    assert.ok(Number.isInteger(car.pos) && car.pos >= 0 && car.pos < cells, `position ${car.pos}`);
    assert.ok(Number.isInteger(car.vel) && car.vel >= 0 && car.vel <= vmax, `speed ${car.vel}`);
    assert.ok(!seen.has(car.pos), `two cars share cell ${car.pos}`);
    seen.add(car.pos);
    if (i > 0) assert.ok(cars[i - 1].pos < car.pos, 'cars sorted by position');
  }
}

function run(road, steps) {
  let flow = 0;
  let speed = 0;
  for (let i = 0; i < steps; i++) {
    const s = step(road);
    flow += s.flow;
    speed += s.meanSpeed;
  }
  return { flow: flow / steps, meanSpeed: speed / steps };
}

test('carCountFor rounds and clamps', () => {
  assert.equal(carCountFor(200, 0.2), 40);
  assert.equal(carCountFor(200, 0.0024), 0);
  assert.equal(carCountFor(200, 1.5), 200);
  assert.equal(carCountFor(200, -1), 0);
});

test('createRoad scatters the right number of resting cars over distinct cells', () => {
  const road = createRoad({ cells: 100, density: 0.3, rng: createRng(1) });
  assert.equal(road.cars.length, 30);
  assert.equal(density(road), 0.3);
  assert.ok(road.cars.every((c) => c.vel === 0));
  assertWellFormed(road);
  assert.equal(road.time, 0);
});

test('createRoad rejects nonsense parameters', () => {
  assert.throws(() => createRoad({ cells: 0 }), RangeError);
  assert.throws(() => createRoad({ vmax: 0 }), RangeError);
  assert.throws(() => createRoad({ slow: 1.5 }), RangeError);
});

test('gapAhead counts empty cells and wraps around the ring', () => {
  const road = createRoad({ cells: 10, density: 0, rng: createRng(1) });
  road.cars = [
    { id: 0, pos: 1, vel: 0 },
    { id: 1, pos: 4, vel: 0 },
    { id: 2, pos: 8, vel: 0 },
  ];
  assert.equal(gapAhead(road, 0), 2);
  assert.equal(gapAhead(road, 1), 3);
  assert.equal(gapAhead(road, 2), 2);
  road.cars = [{ id: 0, pos: 3, vel: 0 }];
  assert.equal(gapAhead(road, 0), 9);
});

test('stepping conserves cars, never stacks them and respects vmax', () => {
  for (const rho of [0.05, 0.2, 0.5, 0.9, 1]) {
    const road = createRoad({ cells: 120, density: rho, vmax: 5, slow: 0.3, rng: createRng(5) });
    const n = road.cars.length;
    for (let i = 0; i < 400; i++) {
      step(road);
      assert.equal(road.cars.length, n);
      assertWellFormed(road);
    }
    assert.equal(road.time, 400);
  }
});

test('each car moves forward by exactly its recorded speed', () => {
  const road = createRoad({ cells: 80, density: 0.25, rng: createRng(9) });
  for (let i = 0; i < 50; i++) {
    const before = new Map(road.cars.map((c) => [c.id, c.pos]));
    step(road);
    for (const car of road.cars) {
      assert.equal(car.pos, (before.get(car.id) + car.vel) % road.cells);
    }
  }
});

test('a full road never moves', () => {
  const road = createRoad({ cells: 30, density: 1, rng: createRng(2) });
  const stats = run(road, 20);
  assert.equal(stats.flow, 0);
  assert.equal(road.stats.stopped, 30);
});

test('with slow = 1 every driver hesitates and nobody ever gets going', () => {
  const road = createRoad({ cells: 50, density: 0.1, slow: 1, rng: createRng(3) });
  const stats = run(road, 30);
  assert.equal(stats.flow, 0);
});

test('deterministic free flow reaches vmax everywhere with flow = density × vmax', () => {
  const road = createRoad({ cells: 200, density: 0.1, vmax: 5, slow: 0, rng: createRng(4) });
  run(road, 400);
  assert.ok(road.cars.every((c) => c.vel === 5));
  assert.ok(Math.abs(road.stats.flow - 0.5) < 1e-12);
  assert.equal(road.stats.stopped, 0);
});

test('deterministic congested flow settles on 1 − density', () => {
  const road = createRoad({ cells: 200, density: 0.6, vmax: 5, slow: 0, rng: createRng(4) });
  run(road, 2000);
  const settled = run(road, 200);
  assert.ok(Math.abs(settled.flow - 0.4) < 0.02, `flow ${settled.flow}`);
});

test('dawdling lowers flow below the deterministic curve and speed falls with density', () => {
  const rng = createRng(6);
  const measure = (rho) => {
    const road = createRoad({ cells: 300, density: rho, vmax: 5, slow: 0.3, rng });
    run(road, 500);
    return run(road, 500);
  };
  const light = measure(0.1);
  const busy = measure(0.4);
  const packed = measure(0.8);
  assert.ok(light.meanSpeed > busy.meanSpeed && busy.meanSpeed > packed.meanSpeed);
  assert.ok(busy.flow < deterministicFlow(0.4, 5));
  assert.ok(light.flow > busy.flow * 0.9, 'light traffic flows at least about as well as busy traffic');
});

test('cars crossing the finish line match the average flow over time', () => {
  const road = createRoad({ cells: 150, density: 0.3, slow: 0.3, rng: createRng(8) });
  run(road, 300);
  let passed = 0;
  let flow = 0;
  const T = 3000;
  for (let i = 0; i < T; i++) {
    const s = step(road);
    passed += s.passed;
    flow += s.flow;
  }
  assert.ok(Math.abs(passed / T - flow / T) < 0.02);
});

test('setCarCount adds resting cars to empty cells and keeps the others', () => {
  const road = createRoad({ cells: 60, density: 0.2, rng: createRng(10) });
  run(road, 10);
  const kept = new Map(road.cars.map((c) => [c.id, { ...c }]));
  setCarCount(road, 30);
  assert.equal(road.cars.length, 30);
  assertWellFormed(road);
  for (const [id, old] of kept) {
    const now = road.cars.find((c) => c.id === id);
    assert.deepEqual(now, old);
  }
  assert.equal(road.cars.filter((c) => !kept.has(c.id)).every((c) => c.vel === 0), true);
});

test('setCarCount removes cars without disturbing the rest, and clamps', () => {
  const road = createRoad({ cells: 60, density: 0.5, rng: createRng(11) });
  const before = new Map(road.cars.map((c) => [c.id, { ...c }]));
  setCarCount(road, 12);
  assert.equal(road.cars.length, 12);
  assertWellFormed(road);
  for (const car of road.cars) assert.deepEqual(car, before.get(car.id));
  setCarCount(road, 1000);
  assert.equal(road.cars.length, 60);
  setCarCount(road, -5);
  assert.equal(road.cars.length, 0);
  assert.equal(step(road).flow, 0);
});

test('setDensity converts through carCountFor', () => {
  const road = createRoad({ cells: 250, density: 0.1, rng: createRng(12) });
  setDensity(road, 0.44);
  assert.equal(road.cars.length, 110);
  assert.equal(density(road), 0.44);
});

test('stopCarNear halts the nearest car around the ring', () => {
  const road = createRoad({ cells: 100, density: 0, rng: createRng(1) });
  road.cars = [
    { id: 0, pos: 2, vel: 4 },
    { id: 1, pos: 50, vel: 3 },
    { id: 2, pos: 97, vel: 5 },
  ];
  assert.equal(stopCarNear(road, 0).id, 0);
  assert.equal(road.cars[0].vel, 0);
  assert.equal(stopCarNear(road, 60).id, 1);
  assert.equal(road.cars[1].vel, 0);
  assert.equal(road.cars[2].vel, 5);
  road.cars = [];
  assert.equal(stopCarNear(road, 10), null);
});

test('occupancy marks empty cells with -1 and cars with their speed', () => {
  const road = createRoad({ cells: 8, density: 0, rng: createRng(1) });
  road.cars = [
    { id: 0, pos: 1, vel: 2 },
    { id: 1, pos: 6, vel: 0 },
  ];
  const row = occupancy(road);
  assert.deepEqual(Array.from(row), [-1, 2, -1, -1, -1, -1, 0, -1]);
  const reused = new Int8Array(8).fill(9);
  assert.equal(occupancy(road, reused), reused);
  assert.deepEqual(Array.from(reused), Array.from(row));
});

test('deterministicFlow is the triangle min(ρ·vmax, 1 − ρ)', () => {
  assert.equal(deterministicFlow(0, 5), 0);
  assert.equal(deterministicFlow(0.1, 5), 0.5);
  assert.ok(Math.abs(deterministicFlow(1 / 6, 5) - 5 / 6) < 1e-12);
  assert.equal(deterministicFlow(0.5, 5), 0.5);
  assert.equal(deterministicFlow(1, 5), 0);
});
