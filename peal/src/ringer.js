// Ringing one bell yourself: when your bell should strike, and how close
// your own blows came. Times are in seconds.

import { blowTime } from './striking.js';

// Every moment the given bell should strike, row by row.
export function bellBlowTimes(rows, bell, interval, gap = 1) {
  const stage = rows[0].length;
  return rows.map((row, i) => blowTime(i, row.indexOf(bell), stage, interval, gap));
}

// How far from a blow a press may land and still count for it: half the
// shortest time between two blows of one bell, which is (stage - 1) blows
// when it moves from the back of one row to the front of the next.
export function matchWindow(stage, interval) {
  return ((stage - 1) / 2) * interval;
}

// Pair presses with blows. Each blow takes at most one press, the nearest;
// a press with no blow inside the window, or beaten to its blow by a closer
// press, is an extra. Returns per-blow errors (positive = late) and extras.
export function matchPresses(blowTimes, presses, window) {
  const errors = new Array(blowTimes.length).fill(null);
  const extras = [];
  const sorted = [...presses].sort((a, b) => a - b);
  const claim = new Array(blowTimes.length).fill(-1);
  sorted.forEach((t, p) => {
    const k = nearestIndex(blowTimes, t);
    if (k < 0 || Math.abs(t - blowTimes[k]) > window) {
      extras.push(t);
      return;
    }
    const prev = claim[k];
    if (prev < 0) {
      claim[k] = p;
    } else if (Math.abs(t - blowTimes[k]) < Math.abs(sorted[prev] - blowTimes[k])) {
      extras.push(sorted[prev]);
      claim[k] = p;
    } else {
      extras.push(t);
    }
  });
  claim.forEach((p, k) => {
    if (p >= 0) errors[k] = sorted[p] - blowTimes[k];
  });
  return { errors, extras: extras.sort((a, b) => a - b) };
}

function nearestIndex(sortedTimes, t) {
  if (sortedTimes.length === 0) return -1;
  let lo = 0;
  let hi = sortedTimes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTimes[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(sortedTimes[lo - 1] - t) <= Math.abs(sortedTimes[lo] - t)) return lo - 1;
  return lo;
}

// A summary of the striking so far. Only blows whose window has closed by
// `now` count as missed. A blow is "good" within a quarter of the gap
// between two bells, the tolerance a band would barely hear.
export function strikingReport(blowTimes, match, interval, window, now = Infinity) {
  let struck = 0;
  let missed = 0;
  let good = 0;
  let early = 0;
  let late = 0;
  let sumAbs = 0;
  blowTimes.forEach((t, k) => {
    const e = match.errors[k];
    if (e === null) {
      if (t + window < now) missed += 1;
      return;
    }
    struck += 1;
    sumAbs += Math.abs(e);
    if (Math.abs(e) <= interval / 4) good += 1;
    else if (e < 0) early += 1;
    else late += 1;
  });
  return {
    struck,
    missed,
    extras: match.extras.length,
    good,
    early,
    late,
    meanError: struck ? sumAbs / struck : null,
  };
}
