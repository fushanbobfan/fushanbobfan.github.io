// A hexagon-shaped patch of a hexagonal grid in axial coordinates (q, r).
// The patch holds every cell within `radius` steps of the centre. Cells are
// stored in a flat list with a precomputed table of their six neighbours;
// cells on the outer ring are marked as boundary and have no neighbour table
// entries outside the patch (those slots hold -1).

// Neighbour offsets in axial coordinates, going round the hexagon.
export const DIRECTIONS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function hexDistance(q, r) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

export function cellCount(radius) {
  return 3 * radius * (radius + 1) + 1;
}

export function makeGrid(radius) {
  if (!Number.isInteger(radius) || radius < 1) throw new RangeError('radius must be a positive integer');
  const count = cellCount(radius);
  const side = 2 * radius + 1;
  const lookup = new Int32Array(side * side).fill(-1);
  const q = new Int16Array(count);
  const r = new Int16Array(count);
  const dist = new Int16Array(count);
  let i = 0;
  for (let rr = -radius; rr <= radius; rr++) {
    for (let qq = -radius; qq <= radius; qq++) {
      const d = hexDistance(qq, rr);
      if (d > radius) continue;
      q[i] = qq;
      r[i] = rr;
      dist[i] = d;
      lookup[(rr + radius) * side + (qq + radius)] = i;
      i++;
    }
  }
  const index = (qq, rr) => {
    if (hexDistance(qq, rr) > radius) return -1;
    return lookup[(rr + radius) * side + (qq + radius)];
  };
  const neighbors = new Int32Array(count * 6);
  const boundary = new Uint8Array(count);
  for (let c = 0; c < count; c++) {
    boundary[c] = dist[c] === radius ? 1 : 0;
    for (let k = 0; k < 6; k++) {
      const [dq, dr] = DIRECTIONS[k];
      neighbors[c * 6 + k] = index(q[c] + dq, r[c] + dr);
    }
  }
  return {
    radius, count, q, r, dist, neighbors, boundary, index, center: index(0, 0),
  };
}

// Rotate an axial position by 60 degrees about the centre, `turns` times, in
// the order DIRECTIONS goes round. Adding 0 turns -0 into 0.
export function rotate(q, r, turns = 1) {
  let x = q;
  let z = r;
  let y = -q - r;
  for (let t = 0; t < ((turns % 6) + 6) % 6; t++) [x, y, z] = [-y, -z, -x];
  return [x + 0, z + 0];
}

// Reflect an axial position across the q axis (the line r = 0).
export function reflect(q, r) {
  return [q + r, 0 - r];
}
