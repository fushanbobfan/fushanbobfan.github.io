// The running scene: the source moving along its path, a crest sent out at
// every tick of the emitted tone, and the track the listener's images are
// read from.

import { WORLD, SOUND_SPEED, pathAt, steer } from './path.js';
import { History } from './history.js';
import { images } from './doppler.js';

export const STEP = 1 / 120;

// Long enough for sound to cross the world from a source just off screen.
export function historySpan(world = WORLD, c = SOUND_SPEED) {
  return (Math.hypot(world.width, world.height) + 80) / c + 1;
}

export function createSim({ path = 'line', mach = 0.6, rate = 2.5, world = WORLD, c = SOUND_SPEED } = {}) {
  const sim = {
    world, c, path, mach, rate,
    t: 0,
    src: null,
    target: { x: world.width / 2, y: world.height / 2 },
    fronts: [],
    history: new History(historySpan(world, c)),
    nextEmit: 0,
  };
  sim.src = pathAt(path === 'drag' ? 'still' : path, 0, mach * c, world);
  sim.history.push(0, sim.src.x, sim.src.y, sim.src.vx, sim.src.vy, true);
  emitDue(sim, sim.src, sim.src);
  return sim;
}

// Largest radius a crest from (x, y) needs before it has left the world.
function reach(world, x, y) {
  const dx = Math.max(Math.abs(x), Math.abs(world.width - x));
  const dy = Math.max(Math.abs(y), Math.abs(world.height - y));
  return Math.hypot(dx, dy);
}

// Send out every crest due between the previous and the current state,
// placed where the source was at that instant.
function emitDue(sim, before, after) {
  const t1 = sim.t;
  const t0 = t1 - STEP;
  while (sim.nextEmit <= t1 + 1e-12) {
    const s = t1 > t0 && after.lap === before.lap ? Math.min(1, Math.max(0, (sim.nextEmit - t0) / (t1 - t0))) : 1;
    const x = before.x + (after.x - before.x) * s;
    const y = before.y + (after.y - before.y) * s;
    sim.fronts.push({ t0: sim.nextEmit, x, y, vx: after.vx, vy: after.vy, reach: reach(sim.world, x, y) });
    sim.nextEmit += 1 / sim.rate;
  }
}

export function stepSim(sim) {
  const before = sim.src;
  sim.t += STEP;
  const speed = sim.mach * sim.c;
  sim.src = sim.path === 'drag' ? steer(before, sim.target, STEP, speed) : pathAt(sim.path, sim.t, speed, sim.world);
  sim.history.push(sim.t, sim.src.x, sim.src.y, sim.src.vx, sim.src.vy, sim.src.lap !== before.lap);
  emitDue(sim, before, sim.src);
  sim.fronts = sim.fronts.filter((f) => sim.c * (sim.t - f.t0) <= f.reach);
}

// Radius of a crest at the sim's current time.
export function radius(sim, front) {
  return sim.c * (sim.t - front.t0);
}

export function heard(sim, listener) {
  return images(sim.history, listener.x, listener.y, sim.t, sim.c);
}
