// Weighted A* search: A* with its heuristic scaled up by a constant weight (> 1). Inflating the
// heuristic pushes the frontier harder toward the end, so the search typically expands fewer
// cells than plain A* — but it can also commit to a route before a cheaper detour is found, so
// the path is no longer guaranteed shortest. It is guaranteed close: with heuristic weight `w`
// and an admissible base heuristic, the path's cost is at most `w` times the true optimum.
//
// At `w = 1` this is exactly A*; the larger `w` grows, the more it behaves like greedy
// best-first search, trading optimality for speed.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

/** Default heuristic weight: paths cost at most twice the optimum, usually much less. */
export const DEFAULT_WEIGHT = 2;

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function reconstructPath(cameFrom, start, end) {
  const path = [end];
  let current = end;
  while (current.row !== start.row || current.col !== start.col) {
    current = cameFrom.get(key(current.row, current.col));
    path.unshift(current);
  }
  return path;
}

/**
 * Runs weighted A* from `start` to `end` over `grid`, using each cell's `weight` as the cost of
 * entering it and `weight * Manhattan distance` as the heuristic.
 *
 * @param {{type:string, weight:number}[][]} grid
 * @param {{row:number, col:number}} start
 * @param {{row:number, col:number}} end
 * @param {number} [weight]  heuristic inflation factor; >= 1, defaults to {@link DEFAULT_WEIGHT}
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 */
export function weightedAstar(grid, start, end, weight = DEFAULT_WEIGHT) {
  const w = Number.isFinite(weight) && weight >= 1 ? weight : DEFAULT_WEIGHT;
  const visitedOrder = [];
  const cameFrom = new Map();
  const bestCost = new Map([[key(start.row, start.col), 0]]);
  const visited = new Set();
  const frontier = [
    { row: start.row, col: start.col, cost: 0, priority: w * manhattan(start, end) },
  ];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift();
    const currentKey = key(current.row, current.col);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    visitedOrder.push({ row: current.row, col: current.col });

    if (current.row === end.row && current.col === end.col) {
      return { visitedOrder, path: reconstructPath(cameFrom, start, end), found: true };
    }

    for (const next of neighbors(grid, current.row, current.col)) {
      const nextKey = key(next.row, next.col);
      if (visited.has(nextKey)) continue;
      const cost = current.cost + grid[next.row][next.col].weight;
      if (cost < (bestCost.get(nextKey) ?? Infinity)) {
        bestCost.set(nextKey, cost);
        cameFrom.set(nextKey, { row: current.row, col: current.col });
        frontier.push({
          row: next.row,
          col: next.col,
          cost,
          priority: cost + w * manhattan(next, end),
        });
      }
    }
  }

  return { visitedOrder, path: [], found: false };
}
