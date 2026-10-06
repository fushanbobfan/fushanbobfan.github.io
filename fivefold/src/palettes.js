// Colour schemes. `tiles` maps each tile kind to a fill, `ramp` gives the
// ten fills used when tiles are coloured by the direction they point, and
// `overlay` draws the outlines of larger tiles over the small ones, and
// `arcs` colours the two families of matching arcs.

export const PALETTES = {
  slate: {
    name: 'Slate and brass',
    background: '#10161f',
    line: '#0b0f15',
    overlay: '#f2efe6',
    arcs: ['#e8603c', '#7fd1b9'],
    tiles: { kite: '#2f4f74', dart: '#d8a63f', thick: '#2f4f74', thin: '#d8a63f' },
    ramp: ['#24384f', '#2f4f74', '#3d6a8f', '#5a87a6', '#86a7b9', '#d8a63f', '#c58a2f', '#a96d27', '#8a5422', '#6d3f1d'],
  },
  terracotta: {
    name: 'Terracotta',
    background: '#f3ebdd',
    line: '#4a2e22',
    overlay: '#1f3550',
    arcs: ['#1f3550', '#2e7d6b'],
    tiles: { kite: '#c8643b', dart: '#efd9b4', thick: '#c8643b', thin: '#efd9b4' },
    ramp: ['#8f3b21', '#b04f2b', '#c8643b', '#d9835a', '#e5a37c', '#efd9b4', '#d8c39a', '#b9a479', '#8c7b5a', '#635640'],
  },
  garden: {
    name: 'Garden',
    background: '#f6f4ec',
    line: '#253021',
    overlay: '#7a2b5c',
    arcs: ['#c0392b', '#2b5f9e'],
    tiles: { kite: '#5f8a4c', dart: '#d2557a', thick: '#5f8a4c', thin: '#d2557a' },
    ramp: ['#3f6a3a', '#5f8a4c', '#86a65c', '#b6c27a', '#e5d58e', '#f1b07a', '#e6837c', '#d2557a', '#a8437a', '#74386f'],
  },
  ink: {
    name: 'Ink on paper',
    background: '#fbfaf6',
    line: '#1b1b1b',
    overlay: '#c0392b',
    arcs: ['#c0392b', '#1f5fa8'],
    tiles: { kite: '#fbfaf6', dart: '#fbfaf6', thick: '#fbfaf6', thin: '#fbfaf6' },
    ramp: ['#fbfaf6', '#f1efe8', '#e6e3da', '#d9d5ca', '#cbc6b9', '#fbfaf6', '#f1efe8', '#e6e3da', '#d9d5ca', '#cbc6b9'],
  },
};

export const COLOURINGS = {
  kind: 'By tile',
  direction: 'By direction',
  plain: 'Outlines only',
};

// The ten directions a tile can point in are 36 degrees apart; `turn` is
// the angle of one of them, so every palette starts its ramp at the same
// tile regardless of how the seed is rotated.
export function directionIndex(axis, turn = 0) {
  return ((Math.round((axis - turn) / 36) % 10) + 10) % 10;
}

export function tileFill(tile, colouring, palette, turn = 0) {
  if (colouring === 'plain') return palette.background;
  if (colouring === 'direction') return palette.ramp[directionIndex(tile.axis, turn)];
  return palette.tiles[tile.kind];
}
