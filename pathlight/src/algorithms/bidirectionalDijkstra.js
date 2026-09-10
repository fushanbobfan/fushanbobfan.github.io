// Bidirectional Dijkstra: run Dijkstra outward from the start and, at the same time, inward
// from the end, and stop once the two searches provably cannot find a cheaper connection than
// the best one already seen. Where the plain bidirectional search meets in the middle but
// treats every step as unit cost (so it ignores weighted terrain), this one keeps Dijkstra's
// cheapest-total-cost guarantee while still exploring the smaller two-half area instead of one
// big circle out from the start.
//
// Cost convention, matching dijkstra.js: entering a cell costs that cell's own `weight`; the
// cell a search begins on is free. The forward search accumulates the weight of every cell it
// steps *into*. The backward search, walking from the end toward the start, accumulates the
// weight of every cell it steps *out of* — so for any cell on a route, `distF` plus `distB`
// is exactly the full forward cost of that route, with nothing double-counted or dropped.
//
// Termination is the standard rule for bidirectional Dijkstra with non-negative weights: once
// the smallest key still in the forward frontier plus the smallest still in the backward
// frontier is not less than `mu` (the cheapest start-to-end cost connected so far), no
// unexplored path can beat `mu`, so `mu` is optimal and the search stops.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

/** Cheapest entry in a re-sorted frontier array, or Infinity when it is empty. */
function minKey(frontier) {
  let best = Infinity;
  for (const node of frontier) {
    if (node.cost < best) best = node.cost;
  }
  return best;
}

function reconstruct(cameFrom, from, to) {
  const path = [to];
  let current = to;
  while (current.row !== from.row || current.col !== from.col) {
    current = cameFrom.get(key(current.row, current.col));
    path.unshift(current);
  }
  return path;
}

/**
 * Runs bidirectional Dijkstra from `start` to `end` over `grid`, using each cell's `weight` as
 * the cost of entering it.
 *
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 * `visitedOrder` interleaves the cells settled by the forward and backward searches, in the
 * order they were settled and with each cell listed only the first time either side reaches
 * it — the sequence a step-by-step animation should reveal. `path` is the cheapest route
 * found, assembled from the forward half and the backward half at the connecting edge, and is
 * empty when `end` is unreachable.
 */
export function bidirectionalDijkstra(grid, start, end) {
  const visitedOrder = [];

  if (start.row === end.row && start.col === end.col) {
    visitedOrder.push({ row: start.row, col: start.col });
    return { visitedOrder, path: [{ row: start.row, col: start.col }], found: true };
  }

  const startKey = key(start.row, start.col);
  const endKey = key(end.row, end.col);

  const distF = new Map([[startKey, 0]]);
  const distB = new Map([[endKey, 0]]);
  const cameFromF = new Map();
  const cameFromB = new Map();
  const settledF = new Set();
  const settledB = new Set();
  const seen = new Set();

  let frontierF = [{ row: start.row, col: start.col, cost: 0 }];
  let frontierB = [{ row: end.row, col: end.col, cost: 0 }];

  // Best start-to-end cost connected so far, and the edge it crosses: `linkF` on the forward
  // side, `linkB` on the backward side (the two are grid neighbors).
  let mu = Infinity;
  let linkF = null;
  let linkB = null;

  /**
   * Pop the cheapest node from `frontier`, settle it, and relax its neighbours on `side`.
   * `ownDist`/`ownCameFrom`/`ownSettled` belong to this side; `otherDist`/`otherSettled` to
   * the opposite one, for spotting a connection. Returns the settled node, or null when the
   * frontier held nothing new to settle.
   */
  function expand(side) {
    const isForward = side === "F";
    const frontier = isForward ? frontierF : frontierB;
    const ownDist = isForward ? distF : distB;
    const ownCameFrom = isForward ? cameFromF : cameFromB;
    const ownSettled = isForward ? settledF : settledB;
    const otherDist = isForward ? distB : distF;
    const otherSettled = isForward ? settledB : settledF;

    let current = null;
    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost);
      const candidate = frontier.shift();
      const candidateKey = key(candidate.row, candidate.col);
      if (ownSettled.has(candidateKey)) continue;
      current = candidate;
      ownSettled.add(candidateKey);
      break;
    }
    if (!current) return null;

    const currentKey = key(current.row, current.col);
    if (!seen.has(currentKey)) {
      seen.add(currentKey);
      visitedOrder.push({ row: current.row, col: current.col });
    }

    for (const next of neighbors(grid, current.row, current.col)) {
      const nextKey = key(next.row, next.col);
      // Forward pays the weight of the cell it steps into; backward pays the weight of the
      // cell it steps out of. Both make distF + distB a route's true forward cost.
      const stepCost = isForward
        ? grid[next.row][next.col].weight
        : grid[current.row][current.col].weight;
      const tentative = current.cost + stepCost;

      if (tentative < (ownDist.get(nextKey) ?? Infinity)) {
        ownDist.set(nextKey, tentative);
        ownCameFrom.set(nextKey, { row: current.row, col: current.col });
        frontier.push({ row: next.row, col: next.col, cost: tentative });
      }

      // A connection: this side reaches `next`, the other side already has a cost to it.
      const otherCost = otherDist.get(nextKey);
      if (otherCost !== undefined) {
        const linkCost = isForward
          ? grid[next.row][next.col].weight
          : grid[current.row][current.col].weight;
        const total = current.cost + linkCost + otherCost;
        if (total < mu) {
          mu = total;
          linkF = isForward ? { row: current.row, col: current.col } : { row: next.row, col: next.col };
          linkB = isForward ? { row: next.row, col: next.col } : { row: current.row, col: current.col };
        }
      }
    }
    return current;
  }

  while (frontierF.length > 0 && frontierB.length > 0) {
    if (minKey(frontierF) + minKey(frontierB) >= mu) break;
    expand("F");

    if (minKey(frontierF) + minKey(frontierB) >= mu) break;
    expand("B");
  }

  if (mu === Infinity || !linkF || !linkB) {
    return { visitedOrder, path: [], found: false };
  }

  const forwardHalf = reconstruct(cameFromF, start, linkF);
  const backwardHalf = reconstruct(cameFromB, end, linkB);
  backwardHalf.reverse();
  return { visitedOrder, path: [...forwardHalf, ...backwardHalf], found: true };
}
