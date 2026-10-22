// Breadth-first search: explores the grid one ring of distance at a time, so the first time it
// reaches the end is guaranteed to be via the fewest possible steps (every step costs the same,
// unlike Dijkstra/A* which account for weighted terrain).

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
 * Runs BFS from `start` to `end` over `grid`.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 * `visitedOrder` is every cell dequeued, in the order BFS reached it — the sequence a step-by-step
 * animation should reveal. `path` is the shortest route found, empty if `end` is unreachable.
 */
export function bfs(grid, start, end) {
  const visitedOrder = [];
  const cameFrom = new Map();
  const visited = new Set([key(start.row, start.col)]);
  const queue = [start];
  let found = false;

  while (queue.length > 0) {
    const current = queue.shift();
    visitedOrder.push(current);

    if (current.row === end.row && current.col === end.col) {
      found = true;
      break;
    }

    for (const next of neighbors(grid, current.row, current.col)) {
      const nextKey = key(next.row, next.col);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }
  }

  return { visitedOrder, path: found ? reconstructPath(cameFrom, start, end) : [], found };
}
