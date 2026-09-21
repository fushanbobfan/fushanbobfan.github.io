// A flow field: the cheapest cost-to-go from every cell to the end, plus the neighbor each cell
// should step to next. Where a search answers "how do I get from this one start to the end,"
// the flow field answers it for every cell at once — the classic tool for steering many agents
// toward a single goal, and a direct picture of what Dijkstra and A* are estimating when they
// rank the frontier. It's Dijkstra run backwards from the end over the whole grid, using the same
// orthogonal `neighbors` and the same rule that stepping into a cell costs that cell's weight, so
// following the arrows from any cell reproduces exactly the cost a forward Dijkstra would find.
//
// No DOM dependency, like the rest of the grid model, so it is unit-tested directly.

import { neighbors, WALL } from "./grid.js";

const key = (row, col) => `${row},${col}`;

/**
 * @param {{type: string, weight: number}[][]} grid
 * @param {{row: number, col: number}} end
 * @returns {{
 *   cost: number[][],                        // cost-to-go; Infinity for walls and unreachable cells
 *   next: ({row: number, col: number}|null)[][], // the neighbor to step to; null at the end, walls and unreachable cells
 *   maxCost: number,                         // largest finite cost, 0 when only the end is reachable
 * }}
 */
export function computeFlowField(grid, end) {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const cost = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const next = Array.from({ length: rows }, () => Array(cols).fill(null));
  if (!end || rows === 0) return { cost, next, maxCost: 0 };

  cost[end.row][end.col] = 0;
  const settled = new Set();
  const frontier = [{ row: end.row, col: end.col, cost: 0 }];
  let maxCost = 0;

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift();
    const currentKey = key(current.row, current.col);
    if (settled.has(currentKey)) continue;
    settled.add(currentKey);
    if (current.cost > maxCost) maxCost = current.cost;

    // Walking backwards: a neighbor `prev` that steps INTO `current` pays current's weight.
    const stepCost = grid[current.row][current.col].weight;
    for (const prev of neighbors(grid, current.row, current.col)) {
      const prevKey = key(prev.row, prev.col);
      if (settled.has(prevKey)) continue;
      const candidate = current.cost + stepCost;
      if (candidate < cost[prev.row][prev.col]) {
        cost[prev.row][prev.col] = candidate;
        next[prev.row][prev.col] = { row: current.row, col: current.col };
        frontier.push({ row: prev.row, col: prev.col, cost: candidate });
      }
    }
  }

  // Walls never enter the frontier, but make the contract explicit for callers that iterate.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type === WALL) {
        cost[r][c] = Infinity;
        next[r][c] = null;
      }
    }
  }

  return { cost, next, maxCost };
}

/** Arrow glyph pointing from one cell to an orthogonally adjacent one. */
export function arrowBetween(from, to) {
  if (!from || !to) return "";
  if (to.row < from.row) return "↑";
  if (to.row > from.row) return "↓";
  if (to.col < from.col) return "←";
  if (to.col > from.col) return "→";
  return "";
}

/**
 * The cells visited by following the field from `start` until the end (or a dead end) is
 * reached, starting with `start` itself. Bounded by the cell count so a malformed field can't
 * loop forever.
 */
export function followFlow(field, start) {
  const path = [];
  let current = start;
  const limit = field.next.length * (field.next[0]?.length ?? 0) + 1;
  while (current && path.length < limit) {
    path.push(current);
    current = field.next[current.row][current.col];
  }
  return path;
}
