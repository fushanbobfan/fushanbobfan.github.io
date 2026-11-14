import { regularMagnets } from './model.js';

// Each setup: the magnets, the three knobs, and a sentence on what to look for.
export const PRESETS = [
  {
    id: 'three',
    name: 'Three magnets',
    magnets: regularMagnets(3),
    pull: 0.5,
    friction: 0.2,
    height: 0.25,
    note: 'Near each magnet the colour is solid: start there and that magnet wins. Farther out the colours braid into ribbons; zoom into an edge and finer ribbons appear between them.',
  },
  {
    id: 'slippery',
    name: 'Little friction',
    magnets: regularMagnets(3),
    pull: 0.5,
    friction: 0.08,
    height: 0.25,
    note: 'With less drag the bob makes many more passes before it is caught. The solid patches shrink and the braided zone takes over most of the map.',
  },
  {
    id: 'sticky',
    name: 'Heavy friction',
    magnets: regularMagnets(3),
    pull: 0.5,
    friction: 0.6,
    height: 0.25,
    note: 'Heavy drag lets the bob swing past a magnet only once or twice. The map is three broad lobes with a few thin fringes along their edges.',
  },
  {
    id: 'two',
    name: 'Two magnets',
    magnets: regularMagnets(2, 1, 1, 0),
    pull: 0.5,
    friction: 0.15,
    height: 0.25,
    note: 'Two magnets are already enough: away from them the map breaks into bands of the two colours.',
  },
  {
    id: 'four',
    name: 'Four magnets',
    magnets: regularMagnets(4, 1, 1, Math.PI / 4),
    pull: 0.5,
    friction: 0.2,
    height: 0.25,
    note: 'Four magnets on a square. The map keeps the square\'s symmetry: turn it a quarter and every colour moves on by one.',
  },
  {
    id: 'lopsided',
    name: 'One strong magnet',
    magnets: [
      { x: 0, y: 1, strength: 1.6 },
      ...regularMagnets(3).slice(1),
    ],
    pull: 0.5,
    friction: 0.2,
    height: 0.25,
    note: 'The top magnet is 60% stronger and catches more than half of all starting points, yet bands of the other two colours still reach in toward it.',
  },
  {
    id: 'stiff',
    name: 'Strong pull to the centre',
    magnets: regularMagnets(3, 0.6),
    pull: 1.6,
    friction: 0.25,
    height: 0.3,
    note: 'A stiff pull back to the middle sends far-out starts through the centre at speed. Far more of the map is braided than in the first setup.',
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}
