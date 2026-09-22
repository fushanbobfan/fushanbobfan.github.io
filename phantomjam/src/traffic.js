// The Nagel–Schreckenberg cellular automaton on a ring road.
//
// The road is `cells` sites long and wraps around. Each car sits in one cell
// with an integer speed 0..vmax (cells per step). Every step, all cars update
// in parallel:
//   1. accelerate:  v <- min(v + 1, vmax)
//   2. brake:       v <- min(v, gap)          gap = empty cells ahead
//   3. dawdle:      v <- max(v - 1, 0)        with probability `slow`
//   4. move:        x <- (x + v) mod cells
// Rule 3 is the only randomness and the whole reason jams appear from
// nowhere: one hesitation forces the follower to brake harder, and the wave
// of braking rolls backwards through the traffic.

import { shuffle } from './rng.js';

/** Number of cars a road of `cells` sites holds at a given density. */
export function carCountFor(cells, density) {
  return Math.max(0, Math.min(cells, Math.round(density * cells)));
}

/**
 * Lay out a fresh road. Cars are scattered over random cells with speed 0.
 * `rng` is any function returning floats in [0, 1).
 */
export function createRoad({ cells = 200, density = 0.2, vmax = 5, slow = 0.3, rng = Math.random } = {}) {
  if (!Number.isInteger(cells) || cells < 1) throw new RangeError('cells must be a positive integer');
  if (!Number.isInteger(vmax) || vmax < 1) throw new RangeError('vmax must be a positive integer');
  if (!(slow >= 0 && slow <= 1)) throw new RangeError('slow must lie in [0, 1]');

  const road = {
    cells,
    vmax,
    slow,
    rng,
    cars: [],
    nextId: 0,
    time: 0,
    stats: { flow: 0, meanSpeed: 0, stopped: 0, passed: 0 },
  };
  setCarCount(road, carCountFor(cells, density));
  return road;
}

/** Cars per cell. */
export function density(road) {
  return road.cars.length / road.cells;
}

function byPosition(a, b) {
  return a.pos - b.pos;
}

/** Empty cells between a car and the one ahead of it (ring-aware). */
export function gapAhead(road, index) {
  const { cars, cells } = road;
  if (cars.length === 1) return cells - 1;
  const car = cars[index];
  const next = cars[(index + 1) % cars.length];
  return (next.pos - car.pos - 1 + cells) % cells;
}

/**
 * Advance the road one time step with the parallel update above and record
 * the step's statistics on `road.stats`:
 *   flow       cars × cells travelled per cell (≈ vehicles passing a point per step)
 *   meanSpeed  average speed in cells per step
 *   stopped    number of cars with speed 0
 *   passed     cars that crossed the boundary between the last cell and cell 0
 */
export function step(road) {
  const { cars, cells, vmax, slow, rng } = road;
  const n = cars.length;
  let total = 0;
  let stopped = 0;
  let passed = 0;

  // Decide every speed from the old positions before anyone moves.
  const speeds = new Array(n);
  for (let i = 0; i < n; i++) {
    const car = cars[i];
    let v = Math.min(car.vel + 1, vmax);
    v = Math.min(v, gapAhead(road, i));
    if (v > 0 && slow > 0 && rng() < slow) v -= 1;
    speeds[i] = v;
  }

  for (let i = 0; i < n; i++) {
    const car = cars[i];
    const v = speeds[i];
    car.vel = v;
    const target = car.pos + v;
    if (target >= cells) passed += 1;
    car.pos = target % cells;
    total += v;
    if (v === 0) stopped += 1;
  }

  // Nobody overtakes, so the order only rotates; a sort restores it cheaply.
  cars.sort(byPosition);
  road.time += 1;
  road.stats = {
    flow: total / cells,
    meanSpeed: n === 0 ? 0 : total / n,
    stopped,
    passed,
  };
  return road.stats;
}

/**
 * Add or remove cars so the road holds exactly `count`. New cars appear at
 * rest in random empty cells; removals pick random cars. Cars that stay keep
 * their position, speed and id.
 */
export function setCarCount(road, count) {
  const { cars, cells, rng } = road;
  count = Math.max(0, Math.min(cells, Math.round(count)));
  if (count < cars.length) {
    const doomed = new Set(shuffle(rng, cars.map((c) => c.id)).slice(0, cars.length - count));
    road.cars = cars.filter((c) => !doomed.has(c.id));
    return road;
  }
  if (count > cars.length) {
    const taken = new Uint8Array(cells);
    for (const c of cars) taken[c.pos] = 1;
    const empty = [];
    for (let i = 0; i < cells; i++) if (!taken[i]) empty.push(i);
    shuffle(rng, empty);
    const missing = count - cars.length;
    for (let k = 0; k < missing; k++) {
      cars.push({ id: road.nextId++, pos: empty[k], vel: 0 });
    }
    cars.sort(byPosition);
  }
  return road;
}

/** Set the number of cars from a density in [0, 1]. */
export function setDensity(road, value) {
  return setCarCount(road, carCountFor(road.cells, value));
}

/**
 * Make the car nearest to `cell` (around the ring) slam on its brakes: its
 * speed drops to 0 this instant. Returns the car, or null on an empty road.
 * This is the "one driver hesitates" perturbation that seeds a phantom jam.
 */
export function stopCarNear(road, cell) {
  const { cars, cells } = road;
  if (cars.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const car of cars) {
    const d = Math.abs(car.pos - cell);
    const dist = Math.min(d, cells - d);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  best.vel = 0;
  return best;
}

/**
 * The road as one row: -1 for an empty cell, otherwise the speed of the car
 * in it. Pass an Int8Array of length `cells` to reuse it.
 */
export function occupancy(road, out = new Int8Array(road.cells)) {
  out.fill(-1);
  for (const car of road.cars) out[car.pos] = car.vel;
  return out;
}

/** Steady-state flow of the deterministic (slow = 0) model, min(ρ·vmax, 1 − ρ). */
export function deterministicFlow(rho, vmax) {
  return Math.max(0, Math.min(rho * vmax, 1 - rho));
}
