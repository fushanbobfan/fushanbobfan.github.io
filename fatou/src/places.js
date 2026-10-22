// Named parameters worth visiting. `period` is the period of the attracting
// cycle at c, or null when there is none (c outside the set, or on its
// boundary); the tests check every value.

const GOLDEN = (Math.sqrt(5) - 1) / 2;

export const PLACES = [
  {
    id: 'basilica',
    name: 'Basilica',
    c: [-1, 0],
    view: [-0.75, 0, 3.2],
    period: 2,
    note: 'Centre of the period-2 disk. The critical point swaps with -1 forever, and the Julia set is a chain of bulbs pinched at every point that eventually lands on the fixed point.',
  },
  {
    id: 'rabbit',
    name: "Douady's rabbit",
    c: [-0.122561166876654, 0.744861766619744],
    view: [-0.12, 0.74, 0.5],
    period: 3,
    note: 'Centre of the 1/3 bulb. Every bounded Fatou component is drawn into a 3-cycle, so three ears meet at each pinch point of the Julia set.',
  },
  {
    id: 'airplane',
    name: 'Airplane',
    c: [-1.754877666246693, 0],
    view: [-1.7549, 0, 0.06],
    period: 3,
    note: 'Centre of the period-3 copy of the set on the real axis, the largest of the small Mandelbrot sets along the needle.',
  },
  {
    id: 'cauliflower',
    name: 'Cauliflower',
    c: [0.25, 0],
    view: [0.25, 0, 0.4],
    period: null,
    note: 'The cusp of the main cardioid. The fixed point has multiplier exactly 1, so the orbit of 0 creeps towards it without ever being captured by an attracting cycle.',
  },
  {
    id: 'san-marco',
    name: 'San Marco',
    c: [-0.75, 0],
    view: [-0.75, 0, 0.3],
    period: null,
    note: 'Where the main cardioid meets the period-2 disk: the fixed point has multiplier -1 and the critical orbit approaches it from two sides, ever more slowly.',
  },
  {
    id: 'dendrite',
    name: 'Dendrite',
    c: [0, 1],
    view: [0, 1, 0.3],
    period: null,
    note: 'c = i lands after two steps on a repelling 2-cycle, so there is no Fatou set inside: the Julia set is a tree with no interior.',
  },
  {
    id: 'siegel',
    name: 'Siegel disk',
    c: [Math.cos(2 * Math.PI * GOLDEN) / 2 - Math.cos(4 * Math.PI * GOLDEN) / 4,
      Math.sin(2 * Math.PI * GOLDEN) / 2 - Math.sin(4 * Math.PI * GOLDEN) / 4],
    view: [-0.39, -0.59, 0.12],
    period: null,
    note: 'On the cardioid at the golden-mean internal angle. The fixed point is neutral and the orbits near it turn round it on invariant curves, filling a disk that rotates without attracting.',
  },
  {
    id: 'seahorse',
    name: 'Seahorse valley',
    c: [-0.7453, 0.1127],
    view: [-0.745, 0.113, 0.03],
    period: null,
    note: 'Just outside the set between the cardioid and the period-2 disk. The critical orbit escapes, so the Julia set breaks up into dust that still remembers the spirals around it.',
  },
  {
    id: 'elephant',
    name: 'Elephant valley',
    c: [0.2925, 0.0151],
    view: [0.2925, 0.0151, 0.03],
    period: null,
    note: 'Right of the cusp the gaps between the trunks are outside the set; c here escapes slowly and the Julia set is a cloud of elephant-like dust.',
  },
];

export function findPlace(id) {
  return PLACES.find((p) => p.id === id) || null;
}
