// The wind tunnel: a lattice, an obstacle from the settings, walls painted
// by hand, and the step loop with a guard that restarts a run that blows up.

import {
  boundaryLinks,
  collide,
  createLattice,
  equilibrium,
  fillUniform,
  linkForce,
  stream,
  tunnelEdges,
} from './lattice.js';
import { rasterize } from './obstacles.js';
import { analyse, clearHistory, coefficients, createHistory, record } from './shedding.js';
import { gridHeight } from './settings.js';
import { relaxation } from './units.js';

export function createSim(settings) {
  const nx = settings.width;
  const ny = gridHeight(nx);
  const lat = createLattice(nx, ny);
  const sim = {
    lat,
    nx,
    ny,
    settings,
    shape: null,
    shapeMask: new Uint8Array(nx * ny),
    walls: new Uint8Array(nx * ny),
    steps: 0,
    restarts: 0,
    relax: null,
    links: new Int32Array(0),
    force: [0, 0],
    history: createHistory(),
  };
  configure(sim, settings, { keepWalls: false });
  return sim;
}

// Apply new settings. The obstacle and viscosity change in place; the flow
// restarts only when asked (a new grid width always restarts).
export function configure(sim, settings, { keepWalls = true, restart = true } = {}) {
  sim.settings = settings;
  const { nx, ny, lat } = sim;
  sim.shape =
    settings.shape === 'none'
      ? null
      : {
          kind: settings.shape,
          naca: settings.naca,
          angle: settings.angle,
          size: settings.size,
          x: Math.round(nx * 0.25),
          y: (ny - 1) / 2,
        };
  rasterize(sim.shape, nx, ny, sim.shapeMask);
  if (!keepWalls) sim.walls.fill(0);
  sim.relax = relaxation(settings.speed, settings.size, settings.re);
  const before = lat.solid.slice();
  rebuildSolid(sim);
  sim.links = boundaryLinks(lat, sim.shapeMask);
  clearHistory(sim.history);
  if (restart) reset(sim);
  else refill(sim, before);
}

// Forces are sampled every this many steps.
export const SAMPLE_EVERY = 10;

function rebuildSolid(sim) {
  const { lat, shapeMask, walls } = sim;
  for (let c = 0; c < lat.n; c++) lat.solid[c] = shapeMask[c] | walls[c];
}

// Cells that just stopped being solid start at rest; cells that just became
// solid lose their populations.
function refill(sim, before) {
  const { lat } = sim;
  const { n, f, solid } = lat;
  for (let c = 0; c < n; c++) {
    if (before[c] === solid[c]) continue;
    for (let i = 0; i < 9; i++) f[i * n + c] = solid[c] ? 0 : equilibrium(i, 1, 0, 0);
    lat.rho[c] = solid[c] ? 0 : 1;
    lat.ux[c] = 0;
    lat.uy[c] = 0;
  }
}

// Start from the free stream with a small sideways nudge behind the
// obstacle, so a symmetric wake does not wait on rounding errors to break.
export function reset(sim) {
  const { lat, nx, ny } = sim;
  const U = sim.settings.speed;
  fillUniform(lat, 1, U, 0);
  const x0 = sim.shape ? Math.round(sim.shape.x) : 0;
  const nudge = 0.05 * U;
  for (let y = 0; y < ny / 2; y++) {
    for (let x = x0; x < Math.min(nx, x0 + 2 * sim.settings.size); x++) {
      const c = y * nx + x;
      if (lat.solid[c]) continue;
      for (let i = 0; i < 9; i++) lat.f[i * lat.n + c] = equilibrium(i, 1, U, nudge);
    }
  }
  sim.steps = 0;
  sim.force = [0, 0];
  clearHistory(sim.history);
}

export function step(sim, count = 1) {
  const { lat } = sim;
  const { omega } = sim.relax;
  const U = sim.settings.speed;
  for (let k = 0; k < count; k++) {
    collide(lat, omega);
    if (sim.links.length && (sim.steps + 1) % SAMPLE_EVERY === 0) {
      sim.force = linkForce(lat, sim.links);
      const { cd, cl } = coefficients(sim.force[0], sim.force[1], U, sim.settings.size);
      record(sim.history, sim.steps + 1, cd, cl);
    }
    stream(lat);
    tunnelEdges(lat, U);
    sim.steps++;
  }
  if (!healthy(lat)) {
    sim.restarts++;
    reset(sim);
    return false;
  }
  return true;
}

// A run has gone unstable when any moment is not finite or the density has
// strayed far from 1. Checked on the moments from the last collision.
export function healthy(lat) {
  const { n, rho, solid } = lat;
  for (let c = 0; c < n; c++) {
    if (solid[c]) continue;
    const r = rho[c];
    if (!(r > 0.5 && r < 1.5)) return false;
  }
  return true;
}

// Paint or erase walls in a disc of radius r around (x, y). Returns whether
// anything changed. Painting over the obstacle does nothing to it. The inlet
// column and the last two columns stay open: the outlet copies its left
// neighbour, which must not be a wall.
export function paintWalls(sim, x, y, r, on) {
  const { nx, ny, walls, lat } = sim;
  const before = lat.solid.slice();
  let changed = false;
  for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(ny - 1, Math.ceil(y + r)); j++) {
    for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(nx - 1, Math.ceil(x + r)); i++) {
      if ((i - x) ** 2 + (j - y) ** 2 > r * r) continue;
      if (i === 0 || i >= nx - 2) continue;
      const c = j * nx + i;
      if (walls[c] !== (on ? 1 : 0)) {
        walls[c] = on ? 1 : 0;
        changed = true;
      }
    }
  }
  if (changed) {
    rebuildSolid(sim);
    refill(sim, before);
    sim.links = boundaryLinks(lat, sim.shapeMask);
    clearHistory(sim.history);
  }
  return changed;
}

// Time in flow units: how many obstacle lengths the free stream has moved.
export function flowTime(sim) {
  return (sim.steps * sim.settings.speed) / sim.settings.size;
}

// Drag, lift and shedding over the last `window` flow times. Early in a run
// the wake is still forming, so `settling` stays true for the first
// `settle` flow times.
export function wakeReport(sim, { window = 40, settle = 25 } = {}) {
  const { speed: U, size: D } = sim.settings;
  const fromStep = sim.steps - (window * D) / U;
  const r = analyse(sim.history, U, D, { fromStep });
  if (!r) return null;
  return { ...r, settling: flowTime(sim) < settle };
}
