// Counting rules. Each takes ballots { n, k, order, dist } and returns
// { winner, ... } with whatever working the page shows for that rule.
// Exact ties go to the lower-numbered candidate, so the maps are reproducible.

function argmax(scores) {
  let best = 0;
  for (let c = 1; c < scores.length; c++) if (scores[c] > scores[best]) best = c;
  return best;
}

export function firstChoices(ballots, alive) {
  const { n, k, order } = ballots;
  const tally = new Array(k).fill(0);
  for (let v = 0; v < n; v++) {
    const base = v * k;
    for (let r = 0; r < k; r++) {
      const c = order[base + r];
      if (!alive || alive[c]) {
        tally[c]++;
        break;
      }
    }
  }
  return tally;
}

export function plurality(ballots) {
  const tally = firstChoices(ballots);
  return { winner: argmax(tally), tally };
}

// pair[a*k + b] = number of voters who rank a above b.
export function pairwise(ballots) {
  const { n, k, order } = ballots;
  const pair = new Array(k * k).fill(0);
  const seen = new Uint8Array(k);
  for (let v = 0; v < n; v++) {
    const base = v * k;
    seen.fill(0);
    for (let r = 0; r < k; r++) {
      const a = order[base + r];
      for (let b = 0; b < k; b++) if (!seen[b] && b !== a) pair[a * k + b]++;
      seen[a] = 1;
    }
  }
  return pair;
}

// The candidate who beats every other one head to head, or -1.
export function condorcetWinner(pair, k) {
  for (let a = 0; a < k; a++) {
    let beatsAll = true;
    for (let b = 0; b < k && beatsAll; b++) {
      if (b !== a && pair[a * k + b] <= pair[b * k + a]) beatsAll = false;
    }
    if (beatsAll) return a;
  }
  return -1;
}

// Top two by first choices meet in a second round, unless one already has a majority.
export function runoff(ballots) {
  const { n, k } = ballots;
  const first = firstChoices(ballots);
  const ranked = [...first.keys()].sort((a, b) => first[b] - first[a] || a - b);
  if (first[ranked[0]] * 2 > n || k === 1) {
    return { winner: ranked[0], first, finalists: null, second: null };
  }
  const alive = new Array(k).fill(false);
  alive[ranked[0]] = alive[ranked[1]] = true;
  const second = firstChoices(ballots, alive);
  const [a, b] = ranked[0] < ranked[1] ? [ranked[0], ranked[1]] : [ranked[1], ranked[0]];
  return { winner: second[b] > second[a] ? b : a, first, finalists: [ranked[0], ranked[1]], second };
}

// Instant runoff: drop the candidate with the fewest first choices until someone has a majority.
// A tie for last drops the higher-numbered candidate.
export function instantRunoff(ballots) {
  const { k } = ballots;
  const alive = new Array(k).fill(true);
  const rounds = [];
  for (let left = k; ; left--) {
    const tally = firstChoices(ballots, alive);
    const counted = tally.reduce((s, t, c) => s + (alive[c] ? t : 0), 0);
    let top = -1, bottom = -1;
    for (let c = 0; c < k; c++) {
      if (!alive[c]) continue;
      if (top < 0 || tally[c] > tally[top]) top = c;
      if (bottom < 0 || tally[c] <= tally[bottom]) bottom = c;
    }
    if (tally[top] * 2 > counted || left === 1) {
      rounds.push({ tally, eliminated: -1 });
      return { winner: top, rounds };
    }
    rounds.push({ tally, eliminated: bottom });
    alive[bottom] = false;
  }
}

// k-1 points for a first choice, k-2 for a second, down to 0 for the last.
export function borda(ballots) {
  const { n, k, order } = ballots;
  const score = new Array(k).fill(0);
  for (let v = 0; v < n; v++) {
    for (let r = 0; r < k; r++) score[order[v * k + r]] += k - 1 - r;
  }
  return { winner: argmax(score), score };
}

// Each voter approves every candidate nearer than their average distance,
// which always includes the favourite.
export function approval(ballots) {
  const { n, k, dist, order } = ballots;
  const score = new Array(k).fill(0);
  for (let v = 0; v < n; v++) {
    const base = v * k;
    let mean = 0;
    for (let c = 0; c < k; c++) mean += dist[base + c];
    mean /= k;
    for (let c = 0; c < k; c++) {
      if (dist[base + c] < mean || c === order[base]) score[c]++;
    }
  }
  return { winner: argmax(score), score };
}

// Minimax: the candidate whose worst head-to-head defeat is smallest.
// It always picks the Condorcet winner when there is one.
export function minimax(ballots) {
  const { k } = ballots;
  const pair = pairwise(ballots);
  const worst = new Array(k).fill(0);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a !== b && pair[b * k + a] > pair[a * k + b]) {
        worst[a] = Math.max(worst[a], pair[b * k + a]);
      }
    }
  }
  let winner = 0;
  for (let c = 1; c < k; c++) if (worst[c] < worst[winner]) winner = c;
  return { winner, pair, worst, condorcet: condorcetWinner(pair, k) };
}

export const METHODS = [
  { id: 'plurality', name: 'Plurality', count: plurality,
    rule: 'Each voter names one candidate. Most votes wins.' },
  { id: 'runoff', name: 'Two-round runoff', count: runoff,
    rule: 'If nobody has a majority of first choices, the top two meet again.' },
  { id: 'irv', name: 'Instant runoff', count: instantRunoff,
    rule: 'Voters rank everyone. The last-placed candidate drops out and their ballots move on, until someone has a majority.' },
  { id: 'borda', name: 'Borda count', count: borda,
    rule: 'Voters rank everyone. With k candidates a ballot gives k−1 points to its first choice, k−2 to its second, down to 0.' },
  { id: 'approval', name: 'Approval', count: approval,
    rule: 'Each voter approves every candidate closer than their average distance. Most approvals wins.' },
  { id: 'minimax', name: 'Condorcet (minimax)', count: minimax,
    rule: 'Every pair meets head to head. The winner is whoever beats all the others, or else whoever loses least badly.' },
];
