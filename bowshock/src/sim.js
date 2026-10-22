// The running scene: the source moving along its path, a crest sent out at
// every tick of the emitted tone and carried along by the wind, the listener
// walking back and forth, and the track the listener's images are read from.

import { WORLD, SOUND_SPEED, pathAt, steer } from './path.js';
import { History } from './history.js';
import { images } from './doppler.js';

export const STEP = 1 / 120;

// Strongest wind, as a fraction of the speed of sound. Sound still makes
// headway upwind at a fifth of its usual speed.
export const WIND_MAX = 0.8;

// Long enough for sound to cross the world from a source just off screen,
// even straight into the strongest wind.
export function historySpan(world = WORLD, c = SOUND_SPEED) {
  return (Math.hypot(world.width, world.height) + 80) / (c * (1 - WIND_MAX)) + 1;
}

export function createSim({
  path = 'line', mach = 0.6, rate = 2.5, wind = 0, walk = 0,
  listener = null, world = WORLD, c = SOUND_SPEED,
} = {}) {
  const sim = {
    world, c, path, mach, rate, wind, walk,
    t: 0,
    travelled: 0,
    src: null,
    target: { x: world.width / 2, y: world.height / 2 },
    listener: { x: world.width / 2, y: world.height * 0.2, dir: 1, ...listener },
    air: { x: 0, y: 0 },
    fronts: [],
    history: new History(historySpan(world, c)),
    nextEmit: 0,
  };
  sim.src = pathAt(path === 'drag' ? 'still' : path, 0, mach * c, world);
  sim.history.push(0, sim.src.x, sim.src.y, sim.src.vx, sim.src.vy, true);
  emitDue(sim, sim.src, sim.src);
  return sim;
}

// Wind and listener velocities in world units per second. The wind blows
// along x; a positive setting blows to the right.
export const windVelocity = (sim) => ({ x: sim.wind * sim.c, y: 0 });
export const listenerVelocity = (sim) => ({ x: sim.walk * sim.c * sim.listener.dir, y: 0 });

// Where a crest's centre has drifted to by now: wherever the air it was
// sent into has moved, even if the wind changed on the way.
export function centre(sim, front) {
  return { x: front.x + sim.air.x - front.ax, y: front.y + sim.air.y - front.ay };
}

// Radius of a crest at the sim's current time.
export function radius(sim, front) {
  return sim.c * (sim.t - front.t0);
}

// True once a crest has swept past every corner of the world. Its centre
// drifts slower than it grows, so it never comes back.
function gone(sim, front) {
  const { x, y } = centre(sim, front);
  const dx = Math.max(Math.abs(x), Math.abs(sim.world.width - x));
  const dy = Math.max(Math.abs(y), Math.abs(sim.world.height - y));
  return radius(sim, front) > Math.hypot(dx, dy);
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
    const w = windVelocity(sim);
    const back = t1 - sim.nextEmit;
    sim.fronts.push({
      t0: sim.nextEmit, x, y, vx: after.vx, vy: after.vy,
      ax: sim.air.x - w.x * back, ay: sim.air.y - w.y * back,
    });
    sim.nextEmit += 1 / sim.rate;
  }
}

// The listener paces along its row, turning round at the edges.
function walkListener(sim) {
  const L = sim.listener;
  if (sim.walk <= 0) return;
  L.x += sim.walk * sim.c * L.dir * STEP;
  if (L.x > sim.world.width) {
    L.x = 2 * sim.world.width - L.x;
    L.dir = -1;
  } else if (L.x < 0) {
    L.x = -L.x;
    L.dir = 1;
  }
}

export function stepSim(sim) {
  const before = sim.src;
  const w = windVelocity(sim);
  sim.t += STEP;
  sim.air = { x: sim.air.x + w.x * STEP, y: sim.air.y + w.y * STEP };
  const speed = sim.mach * sim.c;
  sim.travelled += speed * STEP;
  sim.src = sim.path === 'drag' ? steer(before, sim.target, STEP, speed) : pathAt(sim.path, sim.travelled, speed, sim.world);
  sim.history.push(sim.t, sim.src.x, sim.src.y, sim.src.vx, sim.src.vy, sim.src.lap !== before.lap, sim.air.x, sim.air.y);
  emitDue(sim, before, sim.src);
  walkListener(sim);
  sim.fronts = sim.fronts.filter((f) => !gone(sim, f));
}

export function heard(sim) {
  const L = sim.listener;
  return images(sim.history, L.x, L.y, sim.t, sim.c, { wind: windVelocity(sim), obs: listenerVelocity(sim), air: sim.air });
}
