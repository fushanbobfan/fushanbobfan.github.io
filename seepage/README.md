# seepage

Percolation in the browser. Fill a grid at random with probability *p*,
watch neighbouring cells join into clusters, and find the point where one
cluster first reaches from one side of the grid to the other.

**Live demo:** https://fushanbobfan.github.io/seepage/

Percolation is the simplest model with a sharp phase transition: water
seeping through porous rock, fire spreading through a forest, current
through a random resistor mesh. On a square grid of open and closed cells,
nothing reaches across while *p* is below about 0.5927, and almost
everything joins one giant cluster soon after.

No build step and no dependencies. The lattice, the cluster labelling, the
threshold sweep, the renderer and the share links are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Drag p through the threshold.** Every cell keeps the same random number
as *p* changes, so moving the slider opens more of the same grid rather
than drawing a new one. Below 0.55 the clusters are scattered islands;
between 0.58 and 0.60 they lock together within a few thousandths of *p*,
and the spanning cluster appears in the accent colour.

**Jump to the threshold.** *Go to this grid's threshold* sets *p* just
above the exact value at which this particular grid first connects top to
bottom. The spanning cluster at that moment is a thin, ragged fractal full
of holes and dead ends, nothing like the solid mass a little higher up.

**Point at a cluster.** Hovering shows its size and whether it spans. Near
the threshold, the *Mean finite cluster* figure (the average size of the
cluster a random open cell belongs to, leaving out the spanning one) grows
sharply; on an infinite grid it would diverge.

**Sweep the threshold.** *Run sweep* draws hundreds of grids and records
each one's threshold. The orange curve is the share of grids that span at
each *p*; the dashed curve is the average share of cells in the largest
cluster. Run it at 32 × 32 and again at 256 × 256: the step sharpens and
the thresholds pile up ever closer to 0.5927.

**Switch to bonds.** In bond percolation every site is present and each
link between neighbours is open with probability *p*. The threshold is
exactly 1/2, a result of Kesten (1980) that follows from the square
lattice being its own dual.

## Controls

| Control | What it does |
| --- | --- |
| Open probability *p* | Opens every cell (or link) whose random number is below *p*. |
| Site / Bond | Open cells with all their links, or all sites with random links. |
| Size, Seed | Grid from 32 × 32 to 512 × 512; the seed fixes every random number. |
| Colouring | Each cluster in its own colour, by cluster size, or the spanning cluster only. |
| Palette | Ink, Ember, Sea or Paper. |
| Threshold sweep | Runs 50, 200 or 1000 grids of the current size and type. |
| Copy link, Save PNG | Share the exact grid and *p*; save a sharp image of the grid. |

Keyboard, with the grid focused: <kbd>←</kbd> and <kbd>→</kbd> nudge *p*
by 0.001 (with <kbd>Shift</kbd>, 0.01), <kbd>T</kbd> jumps to the grid's
threshold, <kbd>N</kbd> draws a new grid, <kbd>B</kbd> switches between
site and bond percolation and <kbd>C</kbd> cycles the colouring.

## How it works

`src/lattice.js` gives each site (or each bond) one random number *u* from
a seeded generator; it is open at *p* when *u* < *p*. Two cells are in the
same cluster when a path of open links joins them, found with union-find
in `src/clusters.js`. A cluster spans when it touches two opposite edges.

The sweep in `src/sweep.js` follows Newman and Ziff (2000). Instead of
relabelling the grid for each *p*, it sorts the cells by their random
numbers and opens them one at a time, merging clusters as they meet and
tracking which ones touch the top and bottom rows. One pass gives the
exact *p* at which this grid first spans, and the size of its largest
cluster at every *p*, in about the time of a single sort.

The test suite checks that:

- raising *p* only ever opens more cells and links, and no link leaves the grid;
- cluster labels agree with an independent flood fill, for site and bond grids;
- the sweep's largest-cluster curve matches full relabelling at every *p*,
  and the grid spans just above its recorded threshold but not at it;
- average thresholds over many grids land within 0.02 of 0.5927 (site)
  and 1/2 (bond), and larger grids give a narrower spread;
- the painted pixels, share links and chart paths come out as expected.

## Accessibility

Every control is a native form element with a label. The grid is
focusable, has keyboard shortcuts and a text description of its current
state, and the status line under it is announced when it changes. Light
and dark page themes follow the system setting.

## References

- M. E. J. Newman and R. M. Ziff, "Efficient Monte Carlo algorithm and
  high-precision results for percolation", *Physical Review Letters* 85,
  4104 (2000).
- H. Kesten, "The critical probability of bond percolation on the square
  lattice equals 1/2", *Communications in Mathematical Physics* 74, 41 (1980).
- D. Stauffer and A. Aharony, *Introduction to Percolation Theory*, 2nd ed.
  (Taylor & Francis, 1994).

## Licence

MIT
