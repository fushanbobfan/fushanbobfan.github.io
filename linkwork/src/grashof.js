// Grashof's rule: a four-bar has a bar that turns fully relative to the
// others exactly when s + l < p + q, with s the shortest bar, l the longest
// and p, q the other two. Which bar is shortest decides how input and
// output move.

const NAMES = {
  'crank-rocker': 'crank-rocker',
  'double-crank': 'double crank (drag link)',
  'rocker-crank': 'rocker-crank',
  'double-rocker': 'Grashof double rocker',
  'change-point': 'change point',
  'triple-rocker': 'triple rocker (non-Grashof)',
};

export function classify({ a, b, c, g }, tol = 1e-9) {
  const bars = [
    ['ground', g],
    ['crank', a],
    ['coupler', b],
    ['rocker', c],
  ];
  const sorted = [...bars].sort((x, y) => x[1] - y[1]);
  const s = sorted[0][1];
  const l = sorted[3][1];
  const pq = sorted[1][1] + sorted[2][1];
  const margin = pq - (s + l);
  let type;
  if (Math.abs(margin) <= tol * Math.max(1, l)) type = 'change-point';
  else if (margin < 0) type = 'triple-rocker';
  else {
    type = {
      ground: 'double-crank',
      crank: 'crank-rocker',
      rocker: 'rocker-crank',
      coupler: 'double-rocker',
    }[sorted[0][0]];
  }
  return {
    type,
    name: NAMES[type],
    shortest: sorted[0][0],
    margin,
    inputTurns: type === 'crank-rocker' || type === 'double-crank',
    outputTurns: type === 'rocker-crank' || type === 'double-crank',
  };
}

// Can the loop be assembled at all? The longest bar must be shorter than
// the other three together.
export function closes({ a, b, c, g }) {
  const l = Math.max(a, b, c, g);
  return l < a + b + c + g - l;
}
