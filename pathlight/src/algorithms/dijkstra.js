// Dijkstra's algorithm: like BFS, but accounts for cells that cost more than one to enter
// (weighted terrain), always expanding the cheapest-so-far cell next rather than the one found
// first. The cost of stepping into a cell is that cell's own weight — the start's weight never
// matters, since the search begins there at cost 0.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

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
 * Runs Dijkstra's algorithm from `start` to `end` over `grid`, using each cell's `weight` as
 * the cost of entering it.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 */
export function dijkstra(grid, start, end) {
  const visitedOrder = [];
  const cameFrom = new Map();
  const bestCost = new Map([[key(start.row, start.col), 0]]);
  const visited = new Set();
  // A plain array re-sorted before each extraction, rather than a binary heap: grid sizes here
  // are small enough (a few hundred cells) that the simplicity is worth more than the constant
  // factor, and the resulting order is identical to a proper priority queue's either way.
  const frontier = [{ row: start.row, col: start.col, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
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
        frontier.push({ row: next.row, col: next.col, cost });
      }
    }
  }

  return { visitedOrder, path: [], found: false };
}
