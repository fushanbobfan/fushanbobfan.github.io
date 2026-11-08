import { castBallots } from './voters.js';
import { pairwise, condorcetWinner } from './methods.js';

// A Yee map: for every cell of a res-by-res grid over the unit square, put the
// centre of the voter cloud there, hold the election and record each winner.
export function createMap({ res, candidates, cloud, spread, methods }) {
  return {
    res,
    candidates,
    cloud,
    spread,
    methods,
    winners: methods.map(() => new Uint8Array(res * res)),
    // -1 where the cell has no Condorcet winner.
    condorcet: new Int8Array(res * res),
    done: 0,
    scratch: null,
  };
}

// Fill rows [y0, y1). The page calls this a few rows per frame so dragging stays smooth.
export function fillRows(map, y0, y1) {
  const { res, candidates, cloud, spread, methods, winners, condorcet } = map;
  const k = candidates.length;
  for (let y = y0; y < Math.min(y1, res); y++) {
    for (let x = 0; x < res; x++) {
      const cell = y * res + x;
      map.scratch = castBallots(cloud, (x + 0.5) / res, (y + 0.5) / res, spread, candidates, map.scratch);
      for (let m = 0; m < methods.length; m++) winners[m][cell] = methods[m].count(map.scratch).winner;
      condorcet[cell] = condorcetWinner(pairwise(map.scratch), k);
    }
  }
  map.done = Math.max(map.done, Math.min(y1, res));
  return map;
}

export function fillAll(map) {
  return fillRows(map, 0, map.res);
}

// Share of cells each candidate wins under one method.
export function shares(map, m) {
  const k = map.candidates.length;
  const counts = new Array(k).fill(0);
  const w = map.winners[m];
  const cells = map.done * map.res;
  for (let i = 0; i < cells; i++) counts[w[i]]++;
  return counts.map((c) => (cells ? c / cells : 0));
}

// Share of cells with a Condorcet winner where the method elected someone else.
export function condorcetMisses(map, m) {
  const w = map.winners[m];
  let with_ = 0, missed = 0;
  const cells = map.done * map.res;
  for (let i = 0; i < cells; i++) {
    if (map.condorcet[i] < 0) continue;
    with_++;
    if (w[i] !== map.condorcet[i]) missed++;
  }
  return with_ ? missed / with_ : 0;
}
