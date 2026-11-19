// Stable matching between two equal sides with strict, complete preference lists.
// prefs.left[i] lists right-side indices best first; prefs.right[j] lists left-side indices best first.

export function rankTable(lists) {
  return lists.map((list) => {
    const rank = new Array(list.length);
    list.forEach((who, pos) => { rank[who] = pos; });
    return rank;
  });
}

export function validatePrefs(prefs) {
  const n = prefs.left.length;
  if (prefs.right.length !== n) throw new Error('both sides need the same number of people');
  for (const side of [prefs.left, prefs.right]) {
    for (const list of side) {
      if (list.length !== n || new Set(list).size !== n || list.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) {
        throw new Error('every list must rank everyone on the other side exactly once');
      }
    }
  }
  return n;
}

// Swap the roles so the right side proposes; results are mapped back by the caller.
export function flip(prefs) {
  return { left: prefs.right, right: prefs.left };
}

// Deferred acceptance. Returns every proposal in order, so the page can replay it one step at a time.
// Each event: { proposer, receiver, outcome: 'held' | 'swapped' | 'rejected', dropped }
// where dropped is the proposer the receiver let go ('swapped'), or the one turned away ('rejected').
export function deferredAcceptance(prefs) {
  const n = validatePrefs(prefs);
  const recvRank = rankTable(prefs.right);
  const next = new Array(n).fill(0);
  const holding = new Array(n).fill(-1);
  const free = [];
  for (let i = n - 1; i >= 0; i--) free.push(i);
  const events = [];
  while (free.length) {
    const p = free.pop();
    const r = prefs.left[p][next[p]++];
    const current = holding[r];
    if (current === -1) {
      holding[r] = p;
      events.push({ proposer: p, receiver: r, outcome: 'held', dropped: -1 });
    } else if (recvRank[r][p] < recvRank[r][current]) {
      holding[r] = p;
      free.push(current);
      events.push({ proposer: p, receiver: r, outcome: 'swapped', dropped: current });
    } else {
      free.push(p);
      events.push({ proposer: p, receiver: r, outcome: 'rejected', dropped: p });
    }
  }
  const match = new Array(n);
  holding.forEach((p, r) => { match[p] = r; });
  return { match, events };
}

// State after the first `count` events: who each receiver holds and how far down each proposer has gone.
export function replay(n, events, count) {
  const holding = new Array(n).fill(-1);
  const asked = new Array(n).fill(0);
  for (let k = 0; k < count && k < events.length; k++) {
    const e = events[k];
    asked[e.proposer]++;
    if (e.outcome !== 'rejected') holding[e.receiver] = e.proposer;
  }
  return { holding, asked };
}

// match[i] = right partner of left i. A blocking pair prefers each other to the partners they have.
export function blockingPairs(prefs, match) {
  const n = prefs.left.length;
  const leftRank = rankTable(prefs.left);
  const rightRank = rankTable(prefs.right);
  const partnerOfRight = new Array(n).fill(-1);
  match.forEach((r, i) => { if (r >= 0) partnerOfRight[r] = i; });
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (match[i] === j) continue;
      const leftWants = match[i] < 0 || leftRank[i][j] < leftRank[i][match[i]];
      const rightWants = partnerOfRight[j] < 0 || rightRank[j][i] < rightRank[j][partnerOfRight[j]];
      if (leftWants && rightWants) pairs.push([i, j]);
    }
  }
  return pairs;
}

export function isStable(prefs, match) {
  return blockingPairs(prefs, match).length === 0;
}

export function invert(match) {
  const out = new Array(match.length);
  match.forEach((r, i) => { out[r] = i; });
  return out;
}

// Positions (0 = first choice) each person gets under a matching.
export function partnerRanks(prefs, match) {
  const leftRank = rankTable(prefs.left);
  const rightRank = rankTable(prefs.right);
  const back = invert(match);
  return {
    left: match.map((r, i) => leftRank[i][r]),
    right: back.map((i, r) => rightRank[r][i]),
  };
}

// Every stable matching, by trying all n! pairings. Fine for the eight people a side the page allows.
export function allStableMatchings(prefs) {
  const n = validatePrefs(prefs);
  const leftRank = rankTable(prefs.left);
  const rightRank = rankTable(prefs.right);
  const match = new Array(n);
  const used = new Array(n).fill(false);
  const out = [];
  // A partial pairing can be cut as soon as a pair inside it blocks.
  const blocksWithin = (k) => {
    const i = k;
    const j = match[k];
    for (let a = 0; a < k; a++) {
      const b = match[a];
      if (leftRank[i][b] < leftRank[i][j] && rightRank[b][i] < rightRank[b][a]) return true;
      if (leftRank[a][j] < leftRank[a][b] && rightRank[j][a] < rightRank[j][i]) return true;
    }
    return false;
  };
  const extend = (k) => {
    if (k === n) { out.push(match.slice()); return; }
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      match[k] = j;
      if (blocksWithin(k)) continue;
      used[j] = true;
      extend(k + 1);
      used[j] = false;
    }
  };
  extend(0);
  // Order from best for the left side to best for the right side.
  const leftCost = (m) => m.reduce((s, r, i) => s + leftRank[i][r], 0);
  out.sort((a, b) => leftCost(a) - leftCost(b) || a.join().localeCompare(b.join()));
  return out;
}
