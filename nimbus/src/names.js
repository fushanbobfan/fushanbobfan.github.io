// Chemists' names for the real orbitals.

export const SHELL_LETTERS = ['s', 'p', 'd', 'f', 'g', 'h'];

const SHAPES = {
  1: { '-1': 'y', 0: 'z', 1: 'x' },
  2: { '-2': 'xy', '-1': 'yz', 0: 'z²', 1: 'xz', 2: 'x²−y²' },
  3: {
    '-3': 'y(3x²−y²)',
    '-2': 'xyz',
    '-1': 'yz²',
    0: 'z³',
    1: 'xz²',
    2: 'z(x²−y²)',
    3: 'x(x²−3y²)',
  },
};

// Subscript naming the shape, or the m value where no short name is in use.
export function shapeLabel(l, m) {
  if (l === 0) return '';
  const named = SHAPES[l];
  if (named) return named[m];
  return `m=${m < 0 ? '−' : ''}${Math.abs(m)}`;
}

export function orbitalName(n, l, m) {
  const shape = shapeLabel(l, m);
  return `${n}${SHELL_LETTERS[l]}${shape ? ' ' + shape : ''}`;
}
