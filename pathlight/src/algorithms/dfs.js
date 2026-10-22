// Depth-first search: dives down one branch as far as it can before backtracking, using a
// stack instead of BFS's queue. It has no notion of "closer" or "cheaper" — the first route it
// commits to is whichever branch it happens to try first, so unlike every other algorithm here
// it offers no shortest-steps or cheapest-cost guarantee at all. Its winding, single-threaded
// exploration order (plunging deep along one wall before backtracking) is the useful contrast:
// where BFS spreads out in even rings and Dijkstra/A* follow cost, DFS commits early and often
// has to backtrack past cells it already ruled out.

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
 * Runs DFS from `start` to `end` over `grid`.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 * `visitedOrder` is every cell popped, in the order DFS committed to it — a stack instead of
 * BFS's queue, otherwise the same visited-on-push bookkeeping so no cell is ever pushed twice.
 * `path` is whichever route DFS happened to find first; neither it nor `visitedOrder`'s length
 * is guaranteed to be minimal.
 */
export function dfs(grid, start, end) {
  const visitedOrder = [];
  const cameFrom = new Map();
  const visited = new Set([key(start.row, start.col)]);
  const stack = [start];
  let found = false;

  while (stack.length > 0) {
    const current = stack.pop();
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
        stack.push(next);
      }
    }
  }

  return { visitedOrder, path: found ? reconstructPath(cameFrom, start, end) : [], found };
}
