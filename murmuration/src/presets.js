// Named parameter sets that show off distinct flocking regimes. Each entry
// only lists the values it changes from DEFAULT_PARAMS.

import { DEFAULT_PARAMS } from './flock.js';

export const PRESETS = Object.freeze({
  murmuration: {
    label: 'Murmuration',
    description: 'Balanced rules: dense, rippling flocks like starlings at dusk.',
    params: { separation: 1.5, alignment: 1.0, cohesion: 1.0, perception: 50, separationRadius: 25 },
  },
  school: {
    label: 'Fish school',
    description: 'Strong alignment and cohesion: one tight body that turns as a whole.',
    params: { separation: 1.2, alignment: 1.8, cohesion: 1.4, perception: 70, separationRadius: 18, maxSpeed: 2.6 },
  },
  swarm: {
    label: 'Swarm',
    description: 'Cohesion with little alignment: a buzzing cloud that never settles.',
    params: { separation: 1.0, alignment: 0.1, cohesion: 1.6, perception: 60, separationRadius: 15, maxSpeed: 3.5, maxForce: 0.15 },
  },
  scatter: {
    label: 'Scatter',
    description: 'Separation only: boids spread out and drift alone.',
    params: { separation: 2.0, alignment: 0.0, cohesion: 0.0, perception: 40, separationRadius: 40 },
  },
  lanes: {
    label: 'Lanes',
    description: 'Alignment only: traffic streams that share a heading but never bunch up.',
    params: { separation: 0.6, alignment: 2.0, cohesion: 0.0, perception: 60, separationRadius: 20 },
  },
});

export const DEFAULT_PRESET = 'murmuration';

export function presetParams(name) {
  const preset = PRESETS[name];
  if (!preset) throw new RangeError(`unknown preset: ${name}`);
  return { ...DEFAULT_PARAMS, ...preset.params };
}
