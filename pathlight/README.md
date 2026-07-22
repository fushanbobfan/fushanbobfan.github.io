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
- **Clear path** — remove the last run's highlighting without touching the walls.
- **Clear walls** — remove every wall, keeping the current start, end, and any highlighting.
- **Place start&hellip; / Place end&hellip;** — arm placement mode, then click any cell to move
  that marker there. Placing one marker on top of the other isn't prevented — the algorithm
  simply reports the trivial single-cell path.
- **Animation delay** — milliseconds paused between each revealed cell; set it to 0 for an
  instant result.
- **Click or drag across empty cells** — draw walls. Click or drag across walls — erase them.
  The very first cell touched in a drag decides whether the whole drag adds or erases walls, so
  dragging back over cells you already toggled doesn't immediately flip them back.

## Algorithms

| Algorithm | Guarantee |
| --- | --- |
| Breadth-First Search | Fewest steps (every move costs the same) |

[`src/algorithms/bfs.js`](src/algorithms/bfs.js) explores the grid one ring of distance at a
time, so the first time it reaches the end is guaranteed to be via the shortest possible route.
It returns both the order cells were explored in (what the animation reveals step by step) and
the reconstructed path, so the UI doesn't need to know anything about how the search itself
works.

## The grid model

[`src/grid.js`](src/grid.js) is a plain 2D array of `{ type, weight }` cells, kept free of any
DOM or canvas dependency so it can be built, mutated, and searched in tests without a browser.
Movement is orthogonal only (no diagonals), a rule every algorithm built on `neighbors` shares,
so "fewest steps" and "cheapest path" mean the same kind of step no matter which one runs.
`setNodeType` moves the start or end rather than creating a second one if either already exists
elsewhere on the grid.

## Development

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and check the grid model's invariants
(bounds, wall-avoidance, single start/end) and each algorithm's correctness (shortest path
length, routing around walls, reporting unreachable when fully walled off).

## License

MIT, see [LICENSE](LICENSE).
