// Named rules worth watching. Every claim in a note is checked in
// test/presets.test.js against the simulation.

export const PRESETS = [
  {
    id: 'langton',
    name: "Langton's ant",
    rule: 'RL',
    note:
      'Two colours. About ten thousand steps of chaos, then at step 9977 the ant starts building a diagonal highway that repeats every 104 steps and never stops.',
  },
  {
    id: 'chaos',
    name: 'Chaotic blob',
    rule: 'RLR',
    note: 'Three colours. Grows as a ragged blob with no highway in sight, even after two million steps.',
  },
  {
    id: 'mirror',
    name: 'Mirror symmetry',
    rule: 'LLRR',
    note:
      'Four colours. The ant keeps coming home: every time it stands on its first cell facing up again, the whole pattern is an exact mirror image across the edge below that cell.',
  },
  {
    id: 'square',
    name: 'Filled square',
    rule: 'LRRRRRLLR',
    note: 'Nine colours. Packs its colours into a solid square that keeps growing around the start.',
  },
  {
    id: 'triangle',
    name: 'Growing triangle',
    rule: 'RRLLLRLLLRRR',
    note: 'Twelve colours. Builds a filled triangle that grows and slides away from where it began.',
  },
  {
    id: 'long-highway',
    name: 'Convoluted highway',
    rule: 'LLRRRLRLRLLR',
    note:
      'Twelve colours. Wanders for about thirty thousand steps, then lays a broad straight highway whose pattern repeats only every 1968 steps.',
  },
  {
    id: 'loop',
    name: 'Going in circles',
    rule: 'RR',
    note: 'Always turning right, the ant walks round the same four cells forever, repainting them as it goes.',
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) ?? null;
}
