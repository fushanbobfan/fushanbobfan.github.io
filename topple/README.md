# topple

An Abelian sandpile you can play with in the browser. Every cell of a square
grid holds a few grains of sand; a cell that reaches four grains topples and
hands one grain to each neighbour, which may make them topple in turn. Grains
pushed past the edge are gone. That one rule gives fractal towers, avalanches
with no typical size, and a finite group with a strikingly patterned identity.

**Live demo:** https://fushanbobfan.github.io/topple/

No build step and no dependencies. The model, avalanche bookkeeping,
statistics, sandpile-group helpers, colours and settings are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Three experiments

**Tower.** Put 2^k grains on the centre cell and let them spread. The grid is
sized so that nothing reaches the edge, and the settled pile is a rough disc
whose interior is full of nested, repeating patches. Try 2^16 and watch the
patches sharpen as the collapse finishes.

**Rain.** Drop grains one at a time on random cells, letting the pile settle
completely between drops. At first most grains just sit there; once the pile
fills up, a single grain can set off anything from nothing to an avalanche
that sweeps the grid. The chart plots the distribution of avalanche sizes
(number of topplings) on log-log axes, with a straight-line fit over the
middle of the range. The straight stretch is the signature of
self-organized criticality: nobody tuned a parameter to reach it. The fitted
slope is a rough finite-size estimate and moves with the grid size and the
fit range; the bend at the right is where avalanches start to feel the edge.
The most recent non-empty avalanche is highlighted on the grid.

**Identity.** The stable piles that rain eventually visits (the *recurrent*
ones) form a finite group: add two piles cell by cell and let the result
settle. The page computes that group's identity element with the standard
recipe `e = settle(2m − settle(2m))`, where `m` is three grains on every
cell, and shows both settling stages. Adding `e` to any recurrent pile leaves
it unchanged.

**Regions.** Rain and Identity can run on a square, a disc, a diamond or a
ring cut out of the grid. Cells outside the region behave exactly like the
edge: grains sent there are gone. Each region has its own sandpile group, and
the identities are strikingly different: the disc's is dominated by broad
flat bands, the ring's by lacy triangles around the hole.

Click or drag on the grid to drop extra grains in any experiment.

## Two views

**Grains per cell** colours each cell by its height, 0 to 3, and marks cells
that are still unstable (or, in Rain, the latest avalanche).

**Times toppled** colours each cell by its *odometer*: how many times it has
fired since the experiment started, on a logarithmic scale up to the busiest
cell. The odometer is the smooth potential hidden under the patterned pile:
at every cell, the grains that arrived minus four times the cell's own
topplings plus its neighbours' topplings give exactly the final height. In
Rain it maps where avalanches pass most often; in Identity it covers the
second settling stage.

## Controls

| Control | What it does |
| --- | --- |
| Experiment | Tower, Rain or Identity |
| Tower height | 2^6 to 2^17 grains on the centre cell |
| Grid side | 16 to 256 cells for Rain and Identity |
| Region | Square, disc, diamond or ring for Rain and Identity |
| New seed | Reshuffles where rain lands; the seed goes into share links |
| Speed | Sweep passes (Tower, Identity) or dropped grains (Rain) per frame |
| Show | Grains per cell or times toppled |
| Colours | Four palettes; heights 0–3 always run dark to light or light to dark |
| Copy link | Puts the current settings in the address bar and clipboard |
| Save PNG | Saves the grid, scaled up with crisp cells |

Keys: <kbd>Space</kbd> pauses and resumes, <kbd>N</kbd> steps, <kbd>R</kbd>
restarts.

## How it works

- `src/sandpile.js` holds the grid as a `Uint32Array`. Rain uses a work queue
  that only visits cells that may be unstable. Towers and the identity use a
  scanning pass that fires each unstable cell `floor(h / 4)` times at once;
  by the Abelian property both reach the same stable pile, and the tests
  check that they agree, including when either is paused part-way.
- Both relaxations keep a per-cell odometer; a test checks that it solves
  the discrete Poisson equation `final = start − Δ odometer` cell by cell.
- `src/avalanche.js` drops a grain, settles the pile and records the number
  of topplings, the number of distinct cells that toppled and the grains that
  fell off, using a seeded random site picker so runs replay.
- `src/stats.js` bins avalanche sizes logarithmically, turns counts into a
  density per unit size and fits a least-squares line in log-log space.
- `src/shapes.js` builds the region masks; `src/sandpile.js` treats a
  switched-off neighbour like the edge.
- `src/group.js` adds piles, computes the identity and checks recurrence with
  Dhar's burning test: add one grain per edge to the sink and see whether
  every cell topples exactly once. All of it works on any region, and the
  tests check the identity on each one.

## Limits

- The boundary is always open: grains leave through the grid edge and
  through any switched-off cell. There is no closed or periodic option.
- Towers above 2^17 grains are left out because they take too long to settle
  in a browser frame budget.
- The fitted slope is for exploration, not a measurement of the critical
  exponent: grids here are small and the fit range is fixed.

## References

- P. Bak, C. Tang and K. Wiesenfeld, "Self-organized criticality: An
  explanation of the 1/f noise", *Physical Review Letters* 59 (1987).
- D. Dhar, "Self-organized critical state of sandpile automaton models",
  *Physical Review Letters* 64 (1990).

## License

MIT
