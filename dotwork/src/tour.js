// One continuous line through every dot, the "TSP art" of Kaplan and Bosch
// (Bridges 2005): a closed tour built greedily from nearest neighbours, then
// shortened by 2-opt moves that uncross pairs of edges. A tour is an Int32Array
// of dot indices; the line closes from the last dot back to the first.

import { createBuckets } from './voronoi.js';

function dist(points, a, b) {
  return Math.hypot(points[2 * a] - points[2 * b], points[2 * a + 1] - points[2 * b + 1]);
}

export function tourLength(points, tour) {
  let s = 0;
  for (let i = 0; i < tour.length; i++) s += dist(points, tour[i], tour[(i + 1) % tour.length]);
  return s;
}

function extent(points, count) {
  let w = 1;
  let h = 1;
  for (let i = 0; i < count; i++) {
    w = Math.max(w, points[2 * i] + 1);
    h = Math.max(h, points[2 * i + 1] + 1);
  }
  return { w, h };
}

// Greedy walk: from each dot step to the closest dot not yet visited. Visited
// dots are swapped out of their bucket's live range so later searches skip them.
export function nearestNeighbourTour(points, count) {
  const tour = new Int32Array(count);
  if (count === 0) return tour;
  const { w, h } = extent(points, count);
  const b = createBuckets(points, count, w, h);
  const items = b.items.slice();
  const end = b.start.slice(1);
  const slot = new Int32Array(count);
  const bucketOf = new Int32Array(count);
  for (let c = 0; c < b.cols * b.rows; c++) {
    for (let k = b.start[c]; k < b.start[c + 1]; k++) {
      slot[items[k]] = k;
      bucketOf[items[k]] = c;
    }
  }
  const remove = (i) => {
    const c = bucketOf[i];
    const last = end[c] - 1;
    const j = items[last];
    items[slot[i]] = j;
    slot[j] = slot[i];
    items[last] = i;
    slot[i] = last;
    end[c] = last;
  };
  const maxRing = Math.max(b.cols, b.rows);
  let cur = 0;
  remove(cur);
  tour[0] = cur;
  for (let n = 1; n < count; n++) {
    const x = points[2 * cur];
    const y = points[2 * cur + 1];
    const gx = Math.min(b.cols - 1, Math.floor(x / b.size));
    const gy = Math.min(b.rows - 1, Math.floor(y / b.size));
    let best = -1;
    let bestD2 = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let cy = Math.max(0, gy - r); cy <= Math.min(b.rows - 1, gy + r); cy++) {
        const step = cy === gy - r || cy === gy + r ? 1 : 2 * r;
        for (let cx = gx - r; cx <= gx + r; cx += step) {
          if (cx < 0 || cx >= b.cols) continue;
          const c = cy * b.cols + cx;
          for (let k = b.start[c]; k < end[c]; k++) {
            const i = items[k];
            const d2 = (points[2 * i] - x) ** 2 + (points[2 * i + 1] - y) ** 2;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = i;
            }
          }
        }
      }
      if (best >= 0 && bestD2 <= (r * b.size) ** 2) break;
    }
    remove(best);
    tour[n] = best;
    cur = best;
  }
  return tour;
}

// The k nearest other dots of every dot, as a flat Int32Array of count * k.
export function neighbourLists(points, count, k) {
  const kk = Math.min(k, Math.max(0, count - 1));
  const out = new Int32Array(count * kk);
  if (kk === 0) return { k: 0, list: out };
  const { w, h } = extent(points, count);
  const b = createBuckets(points, count, w, h);
  const maxRing = Math.max(b.cols, b.rows);
  const candD = new Float64Array(kk);
  const candI = new Int32Array(kk);
  for (let a = 0; a < count; a++) {
    const x = points[2 * a];
    const y = points[2 * a + 1];
    const gx = Math.min(b.cols - 1, Math.floor(x / b.size));
    const gy = Math.min(b.rows - 1, Math.floor(y / b.size));
    let found = 0;
    for (let r = 0; r <= maxRing; r++) {
      for (let cy = Math.max(0, gy - r); cy <= Math.min(b.rows - 1, gy + r); cy++) {
        const step = cy === gy - r || cy === gy + r ? 1 : 2 * r;
        for (let cx = gx - r; cx <= gx + r; cx += step) {
          if (cx < 0 || cx >= b.cols) continue;
          const c = cy * b.cols + cx;
          for (let q = b.start[c]; q < b.start[c + 1]; q++) {
            const i = b.items[q];
            if (i === a) continue;
            const d2 = (points[2 * i] - x) ** 2 + (points[2 * i + 1] - y) ** 2;
            if (found < kk || d2 < candD[found - 1]) {
              // Insertion into the sorted candidate list.
              let j = found < kk ? found++ : kk - 1;
              while (j > 0 && candD[j - 1] > d2) {
                candD[j] = candD[j - 1];
                candI[j] = candI[j - 1];
                j--;
              }
              candD[j] = d2;
              candI[j] = i;
            }
          }
        }
      }
      if (found === kk && candD[kk - 1] <= (r * b.size) ** 2) break;
    }
    out.set(candI, a * kk);
  }
  return { k: kk, list: out };
}

// Neighbour-list 2-opt. For each dot a with successor b, try every near
// neighbour c closer to a than b is; joining a-c and b-d (d after c) and
// reversing the stretch between them is kept when it shortens the line.
// Runs whole passes until no move helps or `deadline()` says to stop, and
// returns whether the tour is now 2-opt optimal with respect to the lists.
export function twoOpt(points, tour, neighbours, deadline = () => false) {
  const n = tour.length;
  if (n < 4) return { done: true, moves: 0 };
  const pos = new Int32Array(n);
  for (let i = 0; i < n; i++) pos[tour[i]] = i;
  const reverse = (i, j) => {
    // Reverse tour[i..j], i <= j, positions taken as given.
    while (i < j) {
      const t = tour[i];
      tour[i] = tour[j];
      tour[j] = t;
      pos[tour[i]] = i;
      pos[tour[j]] = j;
      i++;
      j--;
    }
  };
  const { k, list } = neighbours;
  let moves = 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n; i++) {
      if ((i & 255) === 0 && deadline()) return { done: false, moves };
      const a = tour[i];
      const b = tour[(i + 1) % n];
      const dab = dist(points, a, b);
      for (let q = 0; q < k; q++) {
        const c = list[a * k + q];
        const dac = dist(points, a, c);
        if (dac >= dab) break;
        const j = pos[c];
        const d = tour[(j + 1) % n];
        if (c === b || d === a) continue;
        const gain = dab + dist(points, c, d) - dac - dist(points, b, d);
        if (gain > 1e-9) {
          const pi = pos[a];
          if (pi < j) reverse(pi + 1, j);
          else reverse(j + 1, pi);
          moves++;
          improved = true;
          break;
        }
      }
    }
  }
  return { done: true, moves };
}
