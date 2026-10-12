// Particles of Jeff Jones's Physarum model (Artificial Life, 2010).
// Each one has a position and a heading. Every step it moves forward and
// deposits trail (motor stage), then smells the trail at three sensors ahead
// of it and turns towards the strongest (sensory stage).

import { deposit, sample } from './trail.js';

const TAU = Math.PI * 2;

export function createAgents(capacity) {
  return {
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    heading: new Float32Array(capacity),
  };
}

export function addAgent(agents, x, y, heading) {
  if (agents.count >= agents.x.length) return false;
  const i = agents.count++;
  agents.x[i] = x;
  agents.y[i] = y;
  agents.heading[i] = heading;
  return true;
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
// sensorAngle, sensorDistance, turnAngle, stepSize, depositAmount.
export function stepAgents(agents, trail, p, rng, wrap) {
  const { x, y, heading } = agents;
  const w = trail.width;
  const h = trail.height;
  for (let i = 0; i < agents.count; i++) {
    let a = heading[i];

    let nx = x[i] + Math.cos(a) * p.stepSize;
    let ny = y[i] + Math.sin(a) * p.stepSize;
    if (wrap) {
      if (nx < 0) nx += w; else if (nx >= w) nx -= w;
      if (ny < 0) ny += h; else if (ny >= h) ny -= h;
      x[i] = nx;
      y[i] = ny;
      deposit(trail, nx, ny, p.depositAmount, true);
    } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      // Hitting the rim: stay put and face a random new way.
      a = rng.next() * TAU;
    } else {
      x[i] = nx;
      y[i] = ny;
      deposit(trail, nx, ny, p.depositAmount, false);
    }

    const d = p.sensorDistance;
    const sa = p.sensorAngle;
    const px = x[i];
    const py = y[i];
    const f = sample(trail, px + Math.cos(a) * d, py + Math.sin(a) * d, wrap);
    const l = sample(trail, px + Math.cos(a - sa) * d, py + Math.sin(a - sa) * d, wrap);
    const r = sample(trail, px + Math.cos(a + sa) * d, py + Math.sin(a + sa) * d, wrap);
    const turn = chooseTurn(l, f, r);
    if (turn === 2) a += rng.next() < 0.5 ? -p.turnAngle : p.turnAngle;
    else a += turn * p.turnAngle;

    if (a < 0) a += TAU; else if (a >= TAU) a -= TAU;
    heading[i] = a;
  }
}
