// A whole run: trail layer, particles, generator and settings, stepped together.
// Settings use degrees and cell units, as shown in the page.

import { createTrail, diffuseDecay, clearTrail } from './trail.js';
import { createAgents, stepAgents } from './agents.js';
import { spawn, LAYOUTS } from './spawn.js';
import { createRng } from './rng.js';
import { feed } from './food.js';

const deg = Math.PI / 180;

export const DEFAULTS = {
  width: 360,
  height: 240,
  population: 14000,
  layout: 'scatter',
  sensorAngle: 22.5,
  sensorDistance: 9,
  turnAngle: 45,
  stepSize: 1,
  depositAmount: 5,
  decay: 0.1,
  spread: 1,
  foodStrength: 3,
  wrap: true,
  seed: 1,
};

export const LIMITS = {
  width: [40, 1200],
  height: [40, 1200],
  population: [0, 400000],
  sensorAngle: [0, 180],
  sensorDistance: [0, 60],
  turnAngle: [0, 180],
  stepSize: [0.1, 6],
  depositAmount: [0, 50],
  decay: [0, 1],
  spread: [0, 1],
  foodStrength: [0, 50],
};

export function normalizeSettings(input = {}) {
  const s = { ...DEFAULTS, ...input };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    const v = Number(s[key]);
    s[key] = Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : DEFAULTS[key];
  }
  s.width = Math.round(s.width);
  s.height = Math.round(s.height);
  s.population = Math.round(s.population);
  s.wrap = Boolean(s.wrap);
  if (!Object.hasOwn(LAYOUTS, s.layout)) s.layout = DEFAULTS.layout;
  s.seed = Number(s.seed) >>> 0;
  return s;
}

export function motorParams(s) {
  return {
    sensorAngle: s.sensorAngle * deg,
    sensorDistance: s.sensorDistance,
    turnAngle: s.turnAngle * deg,
    stepSize: s.stepSize,
    depositAmount: s.depositAmount,
  };
}

export function createSim(input) {
  const settings = normalizeSettings(input);
  const sim = {
    settings,
    params: motorParams(settings),
    trail: createTrail(settings.width, settings.height),
    agents: createAgents(settings.population),
    rng: createRng(settings.seed),
    foods: [],
    steps: 0,
  };
  resetSim(sim);
  return sim;
}

// Starts over from the seed with the current settings.
export function resetSim(sim) {
  const s = sim.settings;
  sim.rng = createRng(s.seed);
  clearTrail(sim.trail);
  spawn(sim.agents, s.layout, s.population, s.width, s.height, sim.rng);
  sim.steps = 0;
}

// Changes the behaviour settings of a running simulation without restarting.
export function retune(sim, changes) {
  sim.settings = normalizeSettings({ ...sim.settings, ...changes });
  sim.params = motorParams(sim.settings);
}

export function stepSim(sim, n = 1) {
  const s = sim.settings;
  for (let k = 0; k < n; k++) {
    feed(sim.trail, sim.foods, s.foodStrength, s.wrap);
    stepAgents(sim.agents, sim.trail, sim.params, sim.rng, s.wrap);
    diffuseDecay(sim.trail, s.spread, s.decay, s.wrap);
    sim.steps++;
  }
}
