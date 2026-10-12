// Particles of Jeff Jones's Physarum model (Artificial Life, 2010).
// Each one has a position and a heading. Every step it moves forward and
// deposits trail (motor stage), then smells the trail at three sensors ahead
// of it and turns towards the strongest (sensory stage).

import { deposit, sample, isWall } from './trail.js';

const TAU = Math.PI * 2;

export function createAgents(capacity) {
  return {
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    heading: new Float32Array(capacity),
    // Which colony each particle belongs to; every colony has its own trail.
    species: new Uint8Array(capacity),
  };
}

export function addAgent(agents, x, y, heading, species = 0) {
  if (agents.count >= agents.x.length) return false;
  const i = agents.count++;
  agents.x[i] = x;
  agents.y[i] = y;
  agents.heading[i] = heading;
  agents.species[i] = species;
  return true;
}

// What a particle of colony `s` smells at a point: its own colony's trail
// minus `repel` times the trail of every other colony.
export function smell(layers, s, x, y, repel, wrap) {
  if (layers.length === 1) return sample(layers[0], x, y, wrap);
  let v = 0;
  for (let k = 0; k < layers.length; k++) {
    const t = sample(layers[k], x, y, wrap);
    v += k === s ? t : -repel * t;
  }
  return v;
}

// Which way to turn given the three readings: -1 left, +1 right, 0 straight,
// 2 for "either way" when the front is the weakest of the three.
export function chooseTurn(left, front, right) {
  if (front > left && front > right) return 0;
  if (front < left && front < right) return 2;
  if (left < right) return 1;
  if (right < left) return -1;
  return 0;
}

// Advances every particle by one step. `p` holds angles in radians:
// sensorAngle, sensorDistance, turnAngle, stepSize, depositAmount, and
// optionally repel. `trails` is one trail layer, or one per colony; the
// first layer carries the walls.
export function stepAgents(agents, trails, p, rng, wrap) {
  const layers = Array.isArray(trails) ? trails : [trails];
  const trail = layers[0];
  const repel = p.repel ?? 0;
  const { x, y, heading, species } = agents;
  const w = trail.width;
  const h = trail.height;
  for (let i = 0; i < agents.count; i++) {
    let a = heading[i];

    let nx = x[i] + Math.cos(a) * p.stepSize;
    let ny = y[i] + Math.sin(a) * p.stepSize;
    if (wrap) {
      if (nx < 0) nx += w; else if (nx >= w) nx -= w;
      if (ny < 0) ny += h; else if (ny >= h) ny -= h;
    }
    if (trail.wallCount > 0 && isWall(trail, nx, ny, wrap)) {
      // A wall works like the rim: stay put and face a random new way.
      a = rng.next() * TAU;
    } else if (wrap) {
      x[i] = nx;
      y[i] = ny;
      deposit(layers[species[i]] || trail, nx, ny, p.depositAmount, true);
    } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      // Hitting the rim: stay put and face a random new way.
      a = rng.next() * TAU;
    } else {
      x[i] = nx;
      y[i] = ny;
      deposit(layers[species[i]] || trail, nx, ny, p.depositAmount, false);
    }

    const d = p.sensorDistance;
    const sa = p.sensorAngle;
    const px = x[i];
    const py = y[i];
    const sp = species[i];
    const f = smell(layers, sp, px + Math.cos(a) * d, py + Math.sin(a) * d, repel, wrap);
    const l = smell(layers, sp, px + Math.cos(a - sa) * d, py + Math.sin(a - sa) * d, repel, wrap);
    const r = smell(layers, sp, px + Math.cos(a + sa) * d, py + Math.sin(a + sa) * d, repel, wrap);
    const turn = chooseTurn(l, f, r);
    if (turn === 2) a += rng.next() < 0.5 ? -p.turnAngle : p.turnAngle;
    else a += turn * p.turnAngle;

    if (a < 0) a += TAU; else if (a >= TAU) a -= TAU;
    heading[i] = a;
  }
}
