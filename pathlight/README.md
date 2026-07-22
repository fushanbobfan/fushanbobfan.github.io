# Pathlight

An interactive pathfinding visualizer for grid search algorithms, built with plain HTML and
vanilla JavaScript — no build step, no dependencies.

Draw walls, place a start and an end, and watch a search algorithm explore the grid one cell
at a time before tracing the path it found.

## Running it

Any static file server works, since the page is loaded as ES modules over HTTP (opening
`index.html` directly via `file://` will not load the modules). For example:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL in a browser.

## Controls

- **Algorithm** — choose which search algorithm to run.
- **Run** — search from the current start to the current end, animating the exploration order
  and then the path it found.
- **Clear path** — remove the last run's highlighting without touching the walls or terrain.
- **Clear walls & terrain** — remove every wall and reset every cell's weight, keeping the
  current start, end, and any highlighting.
- **Generate maze** — replace the grid with a freshly generated, always-solvable maze (see
  below), moving the start and end to its two opposite corners.
- **Place start&hellip; / Place end&hellip;** — arm placement mode, then click any cell to move
  that marker there. Placing one marker on top of the other isn't prevented — the algorithm
  simply reports the trivial single-cell path.
- **Draw walls / Draw weighted terrain** — pick which tool click-drag applies to empty cells
  (see below).
- **Animation delay** — milliseconds paused between each revealed cell; set it to 0 for an
  instant result.
- **Click or drag across empty cells** — draw with the active tool. Click or drag across cells
  already drawn on — erase back to plain empty. The very first cell touched in a drag decides
  whether the whole drag draws or erases, so dragging back over cells you already toggled
  doesn't immediately flip them back. Touch works the same way as a mouse drag.
- **Keyboard** — the grid is a single Tab stop; once focused, arrow keys move between cells and
  <kbd>Enter</kbd>/<kbd>Space</kbd> activates the focused one (drawing, erasing, or placing the
  start/end, exactly like a click — dragging has no keyboard equivalent, so weighted terrain and
  walls can only be drawn one cell at a time this way).

## Algorithms

| Algorithm | Guarantee | Accounts for weighted terrain? |
| --- | --- | --- |
| Breadth-First Search | Fewest steps | No — every step costs the same regardless of terrain |
| Dijkstra's Algorithm | Cheapest total cost | Yes |
| A* Search | Cheapest total cost, usually exploring far fewer cells | Yes |

[`src/algorithms/bfs.js`](src/algorithms/bfs.js) explores the grid one ring of distance at a
time, so the first time it reaches the end is guaranteed to be via the fewest possible steps —
but it has no notion of a step costing more than one, so it walks straight through weighted
terrain as if it were plain empty ground.

[`src/algorithms/dijkstra.js`](src/algorithms/dijkstra.js) instead always expands whichever
frontier cell has the cheapest cost-so-far, so it correctly detours around expensive terrain
for a cheaper overall route, at the cost of potentially exploring more cells than BFS to reach
the same distance.

[`src/algorithms/astar.js`](src/algorithms/astar.js) is Dijkstra plus a Manhattan-distance
heuristic that biases exploration toward the end instead of expanding outward evenly in every
direction — same optimality guarantee as Dijkstra (the heuristic never overestimates the true
remaining cost, as long as every cell's weight is at least 1), usually for a small fraction of
the cells visited.

All three return both the order cells were explored in (what the animation reveals step by
step) and the reconstructed path, so the UI doesn't need to know anything about how the search
itself works.

## Maze generation

[`src/maze.js`](src/maze.js) builds a maze with a randomized depth-first search (the
"recursive backtracker"), a standard maze generation algorithm: starting from the top-left
corner, it repeatedly carves into a random unvisited neighboring passage two cells away,
backtracking when a cell has none left, until every reachable passage has been visited. Only
even-indexed rows and columns are ever passages — the odd ones in between start (and, unless a
carve happens to link through them, stay) walls — so the result is a "perfect" maze: exactly one
path between any two passages, with no cycles and no isolated, unreachable rooms. The random
source is a parameter rather than a direct call to `Math.random`, so the algorithm itself can be
tested deterministically with a seeded generator. **Generate maze** replaces the whole grid with
one of these (clearing existing walls and weighted terrain along with it) and moves the start
and end to the two corners farthest apart on the even-cell grid, so the generated maze is always
solvable end to end.

## The grid model

[`src/grid.js`](src/grid.js) is a plain 2D array of `{ type, weight }` cells, kept free of any
DOM or canvas dependency so it can be built, mutated, and searched in tests without a browser.
Movement is orthogonal only (no diagonals), a rule every algorithm built on `neighbors` shares,
so "fewest steps" and "cheapest path" mean the same kind of step no matter which one runs.
`setNodeType` moves the start or end rather than creating a second one if either already exists
elsewhere on the grid; `setNodeWeight` changes a cell's cost independently of its type, so
clearing a wall back to empty doesn't erase whatever weight the ground underneath had.

## Keyboard navigation

The grid uses a roving `tabindex` (the standard keyboard pattern for a grid of same-role
cells): exactly one cell is a Tab stop at a time, so tabbing into the grid always lands
somewhere sensible and arrow keys move that one focus point instead of requiring Tab to step
through all 450 cells individually. Clicking a cell moves the roving focus there too, so
switching between mouse and keyboard mid-session picks up from wherever you last interacted
rather than jumping back to a stale position. The grid's cells aren't wrapped in `role="row"`
elements — the CSS grid layout is a flat list of cells, and adding row wrappers would need
`display: contents` to keep the visual layout intact, with inconsistent screen reader support
for a flat grid/gridcell hierarchy either way — so each cell's own label spells out its row and
column rather than relying on structure alone to convey position.

## Development

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and check the grid model's invariants
(bounds, wall-avoidance, single start/end, independent weight tracking) and each algorithm's
correctness — shortest path length, routing around walls, reporting unreachable when fully
walled off, and (for Dijkstra and A*) preferring a longer route over cheap terrain to a shorter
one through expensive terrain.

## License

MIT, see [LICENSE](LICENSE).
