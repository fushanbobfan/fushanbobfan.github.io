// Iterative Deepening A*: reaches A*'s exact optimality guarantee — cheapest total cost, via
// the same Manhattan-distance heuristic — using a depth-first search bounded by a rising f-cost
// threshold instead of a priority queue. Each pass walks the grid depth-first, backing off any
// branch whose f = g + h exceeds the current threshold; if the end isn't found, the next
// threshold is the smallest f-value that exceeded this one, discovered during the failed pass.
// A pass only ever needs as much memory as the current path — no open/closed set — but that
// economy comes at a cost: unlike fringe search's persistent list (see fringeSearch.js), nothing
// settled on one pass carries over to the next, so a long corridor with several rising
// thresholds gets walked again from the root on every one of them.
//
// On a grid with many distinct terrain costs, that re-walking is more than a slowdown: every
// distinct sum of weights along a path is a threshold the search can stall on, so the number of
// passes (and cells re-expanded per pass) can grow explosively rather than settling quickly the
// way it does on an unweighted grid. MAX_EXPANSIONS is a hard stop against that blow-up — without
// it, a large weighted maze can run for minutes and grow an unbounded array of visited cells
// before the browser tab gives any sign of what's wrong.

import { neighbors } from "../grid.js";

// A generated maze with random per-cell terrain costs can make IDA* re-expand the same corridor
// across thousands of rising thresholds; this many node visits is comfortably past the point
// where the search has stopped being useful, but still returns well within a second.
export const MAX_EXPANSIONS = 200_000;

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Runs Iterative Deepening A* from `start` to `end` over `grid`, using each cell's `weight` as
 * the cost of entering it and Manhattan distance as the heuristic — the same cost model and
 * heuristic astar.js uses, so the two share the same optimality guarantee whenever the search
 * actually completes.
 *
 * If it hasn't found the end or exhausted the graph after MAX_EXPANSIONS node visits, it gives
 * up and reports `aborted: true` rather than continuing to blow up — the search's own known
 * worst case (see the module comment), not a claim that no path exists.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean, aborted?: boolean}}
 */
export function idaStar(grid, start, end) {
  const visitedOrder = [];
  const path = [{ row: start.row, col: start.col }];
  const onPath = new Set([`${start.row},${start.col}`]);
  let threshold = manhattan(start, end);

  // Depth-first search along `path`, bounded by `threshold`. Returns "found" once it reaches
  // the end, "aborted" once MAX_EXPANSIONS is reached, the smallest f-value seen that exceeded
  // the threshold (the next threshold to try), or Infinity if the whole reachable graph was
  // exhausted without exceeding it.
  function search(g) {
    if (visitedOrder.length >= MAX_EXPANSIONS) return "aborted";

    const current = path[path.length - 1];
    const f = g + manhattan(current, end);
    if (f > threshold) return f;

    visitedOrder.push({ row: current.row, col: current.col });
    if (current.row === end.row && current.col === end.col) return "found";

    let smallestOverage = Infinity;
    for (const next of neighbors(grid, current.row, current.col)) {
      const nextKey = `${next.row},${next.col}`;
      if (onPath.has(nextKey)) continue; // never step back onto the current path

      path.push(next);
      onPath.add(nextKey);
      const result = search(g + grid[next.row][next.col].weight);
      // Only backtrack off a failed branch: popping on the way back up from a "found" (or
      // "aborted") result would strip the path back down to just the start before the caller
      // ever sees it, and there's nothing left to explore either way.
      if (result === "found" || result === "aborted") return result;
      path.pop();
      onPath.delete(nextKey);
      if (result < smallestOverage) smallestOverage = result;
    }
    return smallestOverage;
  }

  while (true) {
    const result = search(0);
    if (result === "found") {
      return { visitedOrder, path: [...path], found: true };
    }
    if (result === "aborted") {
      return { visitedOrder, path: [], found: false, aborted: true };
    }
    if (result === Infinity) return { visitedOrder, path: [], found: false };
    threshold = result;
  }
}
