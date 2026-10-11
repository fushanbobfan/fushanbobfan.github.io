// Named rules worth watching, on the square or the hexagonal grid. Every
// claim in a note is checked in test/presets.test.js against the simulation.

export const PRESETS = [
  {
    id: 'langton',
    name: "Langton's ant",
    lattice: 'square',
    rule: 'RL',
    note:
      'Two colours. About ten thousand steps of chaos, then at step 9977 the ant starts building a diagonal highway that repeats every 104 steps and carries it off into empty grid.',
  },
  {
    id: 'chaos',
    name: 'Chaotic blob',
    lattice: 'square',
    rule: 'RLR',
    note: 'Three colours. Grows as a ragged blob with no highway in sight, even after two million steps.',
  },
  {
    id: 'mirror',
    name: 'Mirror symmetry',
    lattice: 'square',
    rule: 'LLRR',
    note:
      'Four colours. The ant keeps coming home: every time it stands on its first cell facing up again, the whole pattern is an exact mirror image across the edge below that cell.',
  },
  {
    id: 'square',
    name: 'Filled square',
    lattice: 'square',
    rule: 'LRRRRRLLR',
    note: 'Nine colours. Packs its colours into a solid square that keeps growing around the start.',
  },
  {
    id: 'triangle',
    name: 'Growing triangle',
    lattice: 'square',
    rule: 'RRLLLRLLLRRR',
    note: 'Twelve colours. Builds a filled triangle that grows and slides away from where it began.',
  },
  {
    id: 'long-highway',
    name: 'Convoluted highway',
    lattice: 'square',
    rule: 'LLRRRLRLRLLR',
    note:
      'Twelve colours. Wanders for about thirty thousand steps, then lays a broad straight highway whose pattern repeats only every 1968 steps.',
  },
  {
    id: 'loop',
    name: 'Going in circles',
    lattice: 'square',
    rule: 'RR',
    note: 'Always turning right, the ant walks round the same four cells forever, repainting them as it goes.',
  },
  {
    id: 'hex-langton',
    name: "Langton's ant on hexagons",
    lattice: 'hex',
    rule: 'L1R1',
    note:
      'Turning 60° instead of 90°. No highway in three million steps, but the ant keeps coming home facing east, and every time the pattern is an exact mirror image across the edge on the west side of its first cell.',
  },
  {
    id: 'hex-track',
    name: 'Narrow track',
    lattice: 'hex',
    rule: 'L2R2',
    note: 'Turning 120° each way, the ant lays a straight track two cells wide from its first steps, repeating every 8 steps.',
  },
  {
    id: 'hex-rim',
    name: 'Lapping the rim',
    lattice: 'hex',
    rule: 'L1L2NUL2L1R2',
    note:
      'Seven colours. From step 101,404 the ant walks round the rim of its own hexagon, laying every edge with the same 698-step pattern turned 60° at each corner, so the hexagon grows lap by lap. It looks like a highway along each edge but never breaks away.'
  },
  {
    id: 'hex-mirror',
    name: 'Hexagonal mirror',
    lattice: 'hex',
    rule: 'L1L1R1R1',
    note:
      'The hexagonal cousin of LLRR. Like the 60° Langton ant it returns home facing east again and again, each time leaving a pattern that is its own mirror image.',
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) ?? null;
}
