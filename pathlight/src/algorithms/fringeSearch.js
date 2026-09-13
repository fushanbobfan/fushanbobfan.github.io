// Fringe Search: the same cheapest-total-cost guarantee as A*, reached without a priority
// queue. A* keeps its frontier sorted so it can always pop the cheapest node next; fringe
// search instead keeps an unordered "fringe" list and repeatedly sweeps it at a rising cost
// threshold, expanding whatever is within the current threshold and leaving everything else in
// place for the next sweep. Where iterative-deepening A* gets the same threshold-sweep idea by
// restarting a fresh depth-first search from scratch every time the threshold rises — recomputing
// large parts of the search tree on every sweep — fringe search's list persists across sweeps:
// a node already reached keeps its place (or is moved, not duplicated) as cheaper routes to it
// turn up, so nothing already settled is ever recomputed from nothing the way IDA*'s restarts
// force it to be.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function reconstructPath(cache, start, end) {
  const path = [end];
  let current = end;
  while (current.row !== start.row || current.col !== start.col) {
    current = cache.get(key(current.row, current.col)).parent;
    path.unshift(current);
  }
  return path;
}

/**
 * Runs fringe search from `start` to `end` over `grid`, using each cell's `weight` as the cost
 * of entering it and Manhattan distance as the heuristic — the same cost model and heuristic
 * astar.js uses, so the two share the same optimality guarantee.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 */
export function fringeSearch(grid, start, end) {
  const visitedOrder = [];
  const cache = new Map([[key(start.row, start.col), { g: 0, parent: null }]]);
  const fringe = [{ row: start.row, col: start.col }];
  let flimit = manhattan(start, end);

  while (fringe.length > 0) {
    let nextLimit = Infinity;
    let i = 0;

    while (i < fringe.length) {
      const node = fringe[i];
      const nodeKey = key(node.row, node.col);
      const g = cache.get(nodeKey).g;
      const f = g + manhattan(node, end);

      // Over the current threshold: leave it in the fringe for a later sweep, and note how far
      // over it was, so the next threshold is the smallest one that actually admits something
      // new rather than an arbitrary increment.
      if (f > flimit) {
        if (f < nextLimit) nextLimit = f;
        i++;
        continue;
      }

      visitedOrder.push({ row: node.row, col: node.col });
      if (node.row === end.row && node.col === end.col) {
        return { visitedOrder, path: reconstructPath(cache, start, end), found: true };
      }

      // Newly reached (or re-reached, more cheaply) neighbors are spliced in right after this
      // node — keeping related cells near each other in the list, the same locality fringe
      // search's original linked-list design relies on — and any earlier, costlier entry for
      // the same cell is removed first so the fringe never holds two entries for one cell.
      let insertAt = i + 1;
      for (const next of neighbors(grid, node.row, node.col)) {
        const nextKey = key(next.row, next.col);
        const g2 = g + grid[next.row][next.col].weight;
        const existing = cache.get(nextKey);
        if (existing && existing.g <= g2) continue;

        cache.set(nextKey, { g: g2, parent: { row: node.row, col: node.col } });

        const existingIndex = fringe.findIndex((n) => n.row === next.row && n.col === next.col);
        if (existingIndex !== -1) {
          fringe.splice(existingIndex, 1);
          if (existingIndex < insertAt) insertAt--;
        }
        fringe.splice(insertAt, 0, { row: next.row, col: next.col });
        insertAt++;
      }

      // Fully expanded: settled for this g-value, so it leaves the fringe. If a cheaper route
      // to it turns up later, the loop above reinserts it — nothing here forgets it forever.
      fringe.splice(i, 1);
    }

    if (nextLimit === Infinity) break;
    flimit = nextLimit;
  }

  return { visitedOrder, path: [], found: false };
}
