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

const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;

// The n - 1 nodes of an orbital: n - l - 1 spheres where R changes sign, and
// l surfaces through the nucleus where Y does. cos(m phi) or sin(|m| phi)
// gives |m| planes containing the z axis; the l - |m| roots of the Legendre
// factor in cos(theta) give cones, and when there is an odd number of them
// the middle one, at cos(theta) = 0, is the flat xy plane.
export function nodeCounts(n, l, m) {
  const am = Math.abs(m);
  const legendreRoots = l - am;
  const flat = legendreRoots % 2;
  return { spheres: n - l - 1, planes: am + flat, cones: legendreRoots - flat };
}

export function describeNodes(n, l, m) {
  if (n === 1) return 'No nodes at all: the only orbital of shell 1.';
  const { spheres, planes, cones } = nodeCounts(n, l, m);
  const parts = [spheres ? plural(spheres, 'sphere', 'spheres') : 'no spheres'];
  const through = [];
  if (planes) through.push(plural(planes, 'plane', 'planes'));
  if (cones) through.push(plural(cones, 'cone', 'cones'));
  parts.push(through.length ? through.join(' and ') + ' through the nucleus' : 'nothing through the nucleus');
  return `Nodes: ${parts.join(', ')}. That makes ${n - 1}, n − 1 for every orbital of shell ${n}.`;
}
