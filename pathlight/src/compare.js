// Runs every algorithm on the same grid and start/end so their results can be compared
// side by side, kept free of any DOM dependency like the individual algorithms themselves.

import { bfs } from "./algorithms/bfs.js";
import { dijkstra } from "./algorithms/dijkstra.js";
import { astar } from "./algorithms/astar.js";
import { greedyBestFirstSearch } from "./algorithms/greedy.js";
import { bidirectionalSearch } from "./algorithms/bidirectional.js";

const ALGORITHMS = [
  { key: "bfs", label: "Breadth-First Search", run: bfs },
  { key: "dijkstra", label: "Dijkstra's Algorithm", run: dijkstra },
  { key: "astar", label: "A* Search", run: astar },
  { key: "greedy", label: "Greedy Best-First Search", run: greedyBestFirstSearch },
  { key: "bidirectional", label: "Bidirectional Search", run: bidirectionalSearch },
];

/**
 * The total weight paid to walk `path`, i.e. the sum of every cell's weight except the first —
 * matching dijkstra.js's own accounting, where the start's weight never matters since the
 * search begins there at cost 0. Returns 0 for a path of zero or one cells.
 */
export function pathCost(grid, path) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    cost += grid[path[i].row][path[i].col].weight;
  }
  return cost;
}

/**
 * Runs every supported algorithm from `start` to `end` over the same `grid` and reports each
 * one's result stats — how many cells it explored, and (if it found one) the path's length in
 * steps and its total weighted cost. Useful for seeing "fewest steps," "cheapest route," and
 * "fewest cells explored" actually diverge, or agree, on one concrete maze instead of only in
 * the abstract.
 * @returns {{key: string, label: string, visitedCount: number, found: boolean, steps: number|null, cost: number|null}[]}
 */
export function compareAlgorithms(grid, start, end) {
  return ALGORITHMS.map(({ key, label, run }) => {
    const { visitedOrder, path, found } = run(grid, start, end);
    return {
      key,
      label,
      visitedCount: visitedOrder.length,
      found,
      steps: found ? path.length - 1 : null,
      cost: found ? pathCost(grid, path) : null,
    };
  });
}
