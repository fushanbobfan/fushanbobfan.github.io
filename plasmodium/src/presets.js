// Named starting points. Each note describes what the probe script shows for
// that preset at its own size and seed; test/presets.test.js checks the
// measurable part of every note.

import { DEFAULTS } from './sim.js';

export const PRESETS = {
  reference: {
    label: "Jones's reference",
    note:
      'Sensors 22.5 degrees apart, turns of 45. A fine mesh appears within fifty steps, then keeps ' +
      'coarsening: strands merge and the tube cover falls by more than half in a few hundred steps.',
    settings: { sensorAngle: 22.5, turnAngle: 45, sensorDistance: 9, layout: 'scatter' },
    food: 'none',
  },
  oats: {
    label: 'Oat flakes in a dish',
    note:
      'Five food sources in a closed dish. The particles lay a single network of tubes that runs ' +
      'through all five, with cells between them, the way a real plasmodium links oat flakes.',
    settings: {
      sensorAngle: 45, turnAngle: 22.5, sensorDistance: 15, foodStrength: 20,
      population: 11000, wrap: false, layout: 'scatter',
    },
    food: 'pentagon',
  },
  lattice: {
    label: 'Lasting lattice',
    note:
      'Narrow sensors and sharp 90 degree turns. Straight struts meet at junctions and the web ' +
      'keeps far more of the dish covered than the reference does.',
    settings: { sensorAngle: 22.5, turnAngle: 90, sensorDistance: 9, layout: 'scatter' },
    food: 'none',
  },
  cells: {
    label: 'Long sight',
    note: 'Sensors 25 cells ahead. Strands gather into a few large rounded cells.',
    settings: { sensorAngle: 30, turnAngle: 30, sensorDistance: 25, layout: 'scatter' },
    food: 'none',
  },
  threads: {
    label: 'Short sight',
    note: 'Sensors only 3 cells ahead. Long single threads wander and curl without settling.',
    settings: { sensorAngle: 45, turnAngle: 45, sensorDistance: 3, layout: 'scatter' },
    food: 'none',
  },
  spots: {
    label: 'Glowing spots',
    note:
      'Sensors 90 degrees out to the side but gentle 20 degree turns. Particles fall into tight ' +
      'bright clumps, with drifting arcs between them.',
    settings: { sensorAngle: 90, turnAngle: 20, sensorDistance: 9, layout: 'scatter' },
    food: 'none',
  },
  burst: {
    label: 'Outburst',
    note: 'Twenty thousand particles start at the centre facing out and stretch into a cross of tubes.',
    settings: { population: 20000, layout: 'burst', sensorAngle: 22.5, turnAngle: 45, sensorDistance: 9 },
    food: 'none',
  },
  maze: {
    label: 'Maze',
    note:
      'A maze with food in its first and last rooms. Within fifteen hundred steps the trail along the ' +
      'shortest route between them is several times as dense as in the dead ends.',
    settings: {
      sensorAngle: 45, turnAngle: 22.5, sensorDistance: 20, foodStrength: 50,
      population: 800, width: 240, height: 160, wrap: false, layout: 'scatter',
    },
    food: 'none',
    maze: { corridor: 16, thickness: 4, loops: 0 },
  },
  rivals: {
    label: 'Rival colonies',
    note:
      'Two colonies, each following its own trail and shying away from the other. They split the ' +
      'dish about evenly and almost never share a tube.',
    settings: { colonies: 2, repel: 1, sensorAngle: 22.5, turnAngle: 45, sensorDistance: 9, layout: 'scatter' },
    food: 'none',
  },
  stripes: {
    label: 'Three colonies, five flakes',
    note:
      'Three colonies around five food sources in a closed dish wind into interleaved stripes. Each ' +
      'holds about a third of the tubes, and the dish breaks into dozens of separate pieces.',
    settings: {
      colonies: 3, repel: 1, sensorAngle: 45, turnAngle: 22.5, sensorDistance: 15, foodStrength: 20,
      population: 11000, wrap: false, layout: 'scatter',
    },
    food: 'pentagon',
  },
};

export const DEFAULT_PRESET = 'oats';

// Full settings for a preset: defaults first, so nothing carries over from
// whatever ran before.
export function presetSettings(name) {
  const p = PRESETS[name] || PRESETS[DEFAULT_PRESET];
  return { ...DEFAULTS, ...p.settings };
}
