// A* search: Dijkstra plus a heuristic (Manhattan distance to the end) that biases exploration
// toward the end instead of expanding outward evenly in every direction, usually visiting far
// fewer cells for the same shortest path. The heuristic never overestimates the true remaining
// cost as long as every cell's weight is at least 1 (grid.js's default, and the only kind of
// weighted terrain this project adds), which is what keeps A* guaranteed-shortest rather than
// just fast.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

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
 * Runs A* search from `start` to `end` over `grid`, using each cell's `weight` as the cost of
 * entering it and Manhattan distance as the heuristic.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 */
export function astar(grid, start, end) {
  const visitedOrder = [];
  const cameFrom = new Map();
  const bestCost = new Map([[key(start.row, start.col), 0]]);
  const visited = new Set();
  const frontier = [{ row: start.row, col: start.col, cost: 0, priority: manhattan(start, end) }];

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
        frontier.push({ row: next.row, col: next.col, cost, priority: cost + manhattan(next, end) });
      }
    }
  }

  return { visitedOrder, path: [], found: false };
}
