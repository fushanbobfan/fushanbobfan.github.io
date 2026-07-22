// Greedy best-first search: always expands whichever frontier cell looks closest to the end
// (by Manhattan distance) next, ignoring how expensive the path to reach it actually was. That
// makes it fast and often "good enough", but — unlike BFS, Dijkstra, and A* — it has no
// optimality guarantee at all: a heuristic pointing straight at a dead end can walk it in
// before ever considering the detour that was actually shorter.

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
 * Runs greedy best-first search from `start` to `end` over `grid`. Terrain weight is
 * deliberately never consulted — the algorithm only ever looks at Manhattan distance to `end`,
 * which is the entire point of contrasting it with Dijkstra/A*.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 */
export function greedyBestFirstSearch(grid, start, end) {
  const visitedOrder = [];
  const cameFrom = new Map();
  const visited = new Set();
  const enqueued = new Set([key(start.row, start.col)]);
  const frontier = [{ row: start.row, col: start.col, priority: manhattan(start, end) }];

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
      if (visited.has(nextKey) || enqueued.has(nextKey)) continue;
      enqueued.add(nextKey);
      cameFrom.set(nextKey, { row: current.row, col: current.col });
      frontier.push({ row: next.row, col: next.col, priority: manhattan(next, end) });
    }
  }

  return { visitedOrder, path: [], found: false };
}
