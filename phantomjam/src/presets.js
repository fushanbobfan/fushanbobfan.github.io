// Named traffic regimes. Each sets the density (cars per cell), the speed
// limit (cells per step) and the dawdling probability.

export const PRESETS = [
  {
    id: 'phantom',
    name: 'Phantom jams',
    description:
      'Right around the critical density. Traffic flows freely for a while, then one hesitation snowballs into a jam that rolls backwards for hundreds of steps before it dissolves.',
    density: 0.14,
    vmax: 5,
    slow: 0.3,
  },
  {
    id: 'free',
    name: 'Free flow',
    description: 'Light traffic: everyone reaches the speed limit and the occasional dawdle is absorbed before it spreads.',
    density: 0.07,
    vmax: 5,
    slow: 0.3,
  },
  {
    id: 'stopgo',
    name: 'Stop and go',
    description: 'Well past the critical density. Several jams circulate at once and every car cycles between crawling and sprinting.',
    density: 0.3,
    vmax: 5,
    slow: 0.3,
  },
  {
    id: 'gridlock',
    name: 'Gridlock',
    description: 'Most cells are full. Cars inch forward a step at a time and jams outnumber the gaps between them.',
    density: 0.65,
    vmax: 5,
    slow: 0.3,
  },
  {
    id: 'clockwork',
    name: 'Clockwork drivers',
    description: 'No dawdling at all. Every car settles into a fixed gap and the flow follows the triangle min(ρ·vmax, 1 − ρ) exactly.',
    density: 0.14,
    vmax: 5,
    slow: 0,
  },
  {
    id: 'nervous',
    name: 'Nervous drivers',
    description: 'Dawdling most of the time. Even light traffic keeps breaking into jams because nobody holds a steady speed.',
    density: 0.12,
    vmax: 5,
    slow: 0.6,
  },
  {
    id: 'city',
    name: 'City street',
    description: 'A low speed limit of 2 cells per step. Jams are shorter and denser, and free flow tolerates far more cars.',
    density: 0.3,
    vmax: 2,
    slow: 0.25,
  },
];

export const DEFAULT_PRESET_ID = 'phantom';

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS.find((p) => p.id === DEFAULT_PRESET_ID);
}
