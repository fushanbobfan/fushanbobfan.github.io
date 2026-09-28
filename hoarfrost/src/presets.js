// Named starting points. alpha stays at 1 throughout; beta and gamma move
// the crystal between needles, dendrites, stars and plates.

export const PRESETS = [
  {
    id: 'stellar',
    name: 'Stellar dendrite',
    note: 'Six arms with broad side branches, the classic snowflake.',
    params: { alpha: 1, beta: 0.5, gamma: 0.003 },
  },
  {
    id: 'fern',
    name: 'Fern',
    note: 'Thin vapour and almost nothing added: slim arms with fine, fern-like branches.',
    params: { alpha: 1, beta: 0.4, gamma: 0.0001 },
  },
  {
    id: 'needles',
    name: 'Six needles',
    note: 'Dense vapour and nothing added: six smooth tapering spikes that race to the edge.',
    params: { alpha: 1, beta: 0.9, gamma: 0 },
  },
  {
    id: 'feather',
    name: 'Feathered hexagon',
    note: 'Arms packed with parallel side branches that fill out a hexagon.',
    params: { alpha: 1, beta: 0.7, gamma: 0.001 },
  },
  {
    id: 'lace',
    name: 'Lace plate',
    note: 'A near-solid plate with a lacy rim and hollows at the corners.',
    params: { alpha: 1, beta: 0.95, gamma: 0.02 },
  },
  {
    id: 'star',
    name: 'Broad star',
    note: 'Wide solid arms with smoothly scooped edges between them.',
    params: { alpha: 1, beta: 0.2, gamma: 0.02 },
  },
  {
    id: 'plate',
    name: 'Hexagonal plate',
    note: 'So much vapour is captured that the edge advances evenly: a solid hexagon.',
    params: { alpha: 1, beta: 0.4, gamma: 0.3 },
  },
];

export function findPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}
