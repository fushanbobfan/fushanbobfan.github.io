import { pluckShape, nudgeShape, bumpShape, modeOnly } from './model.js';

// Starting shapes are described relative to the string so they survive a
// change in the number of beads.
export function initialShape(init, n) {
  const amp = init.amp ?? 0.6;
  switch (init.type) {
    case 'mode':
      return modeOnly(n, init.k === 'top' ? n : Math.min(n, init.k), amp);
    case 'pluck': {
      // Keep the corner where it was along the string, even between beads,
      // so a centred pluck stays symmetric for any number of beads.
      const corner = Math.min(n + 0.5, Math.max(0.5, init.at * (n + 1)));
      const shape = pluckShape(n, corner, amp);
      const peak = Math.max(...shape);
      return peak > 0 ? shape.map((v) => (v * amp) / peak) : shape;
    }
    case 'nudge':
      return nudgeShape(n, Math.min(n, init.bead), amp);
    case 'bump':
      return bumpShape(n, init.at * (n + 1), Math.max(1, init.width * (n + 1)), amp);
    case 'still':
    case 'strike':
      return new Float64Array(n);
    default:
      throw new Error(`unknown start ${init.type}`);
  }
}

// A strike starts the string from rest with one bead moving; every other
// start has no initial motion.
export function initialVelocity(init, n) {
  if (init.type !== 'strike') return null;
  const bead = Math.min(n, Math.max(1, Math.round(init.at * (n + 1))));
  return nudgeShape(n, bead, init.amp ?? 0.6);
}

export const PRESETS = [
  {
    id: 'fundamental',
    name: 'The fundamental',
    n: 12,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'mode', k: 1 },
    note: 'The whole string swings as one arch, every bead in step. This is the lowest frequency the string has.',
  },
  {
    id: 'middle',
    name: 'Plucked in the middle',
    n: 15,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'pluck', at: 0.5 },
    note: 'Only modes 1, 3, 5 and so on carry energy. A pluck at the centre is symmetric, and every even-numbered mode is lopsided, so none of them is touched.',
  },
  {
    id: 'near-end',
    name: 'Plucked near the end',
    n: 24,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'pluck', at: 0.12 },
    note: 'A pluck close to a wall puts energy into many overtones. The corner of the triangle runs back and forth along the string.',
  },
  {
    id: 'struck',
    name: 'Struck near the end',
    n: 24,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'strike', at: 0.12 },
    note: 'The same spot struck instead of plucked: one bead is knocked sideways from rest, like a piano hammer hitting a string. A blow gives each mode energy in proportion to the square of that mode’s height at the struck bead, no matter how fast the mode is, so the bars form an even comb and the upper half of the modes gets half the energy, against about 6% for the pluck. Turn on the sound to hear the brighter tone.',
  },
  {
    id: 'zigzag',
    name: 'Neighbours opposed',
    n: 12,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'mode', k: 'top' },
    note: 'The highest mode: each bead swings against its neighbours. Its frequency is just under twice the coupling, the most a string of beads can carry, because no wave can be shorter than two beads.',
  },
  {
    id: 'pulse',
    name: 'A pulse and its echo',
    n: 40,
    params: { coupling: 1, anchor: 0, damping: 0 },
    init: { type: 'bump', at: 0.2, width: 0.1 },
    note: 'A bump splits into two halves that run apart. Each comes back upside down after it meets a wall; the strip below draws their paths as a V and its reflections.',
  },
  {
    id: 'pendulum-pulse',
    name: 'A pulse on a row of pendulums',
    n: 40,
    params: { coupling: 1, anchor: 0.8, damping: 0 },
    init: { type: 'bump', at: 0.2, width: 0.1 },
    note: 'The same bump, but every bead also hangs on its own spring. Each wavelength now travels at its own speed and long waves barely travel at all, so most of the bump keeps ringing where it started while its energy leaks away as a slow train of ripples.',
  },
  {
    id: 'beats',
    name: 'Two coupled pendulums',
    n: 2,
    params: { coupling: 0.4, anchor: 1, damping: 0 },
    init: { type: 'nudge', bead: 1 },
    note: 'Two pendulums joined by a weak spring. Start one swinging and its motion drains into the other and then comes back. One full exchange and return takes the beat period shown in the readout.',
  },
  {
    id: 'damped',
    name: 'Fading out',
    n: 24,
    params: { coupling: 1, anchor: 0, damping: 0.05 },
    init: { type: 'pluck', at: 0.25 },
    note: 'Damping that drags on each bead in proportion to its speed takes energy from every mode at the same average rate, halving it about every 14 time units. The bars shrink together (the slow modes wobble as they go) while the string falls quiet.',
  },
];

export const SLIDERS = [
  { key: 'coupling', label: 'Coupling (string tension)', min: 0, max: 2, step: 0.05 },
  { key: 'anchor', label: 'Anchor (each bead’s own spring)', min: 0, max: 2, step: 0.05 },
  { key: 'damping', label: 'Damping', min: 0, max: 0.5, step: 0.01 },
];

export const BEADS = { min: 1, max: 48 };
