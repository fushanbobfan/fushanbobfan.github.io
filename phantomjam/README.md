# phantomjam

An interactive traffic-jam lab in the browser. Cars circle a ring road
following three simple rules, and jams appear out of nowhere: no accident, no
bottleneck, just one driver easing off the accelerator. Watch the jam roll
backwards against the traffic on a space–time diagram, and map the road's
flow–density curve yourself.

**Live demo:** https://fushanbobfan.github.io/phantomjam/

Runs with no build step and no dependencies. The traffic model, presets,
measurement helpers and drawing geometry are plain ES modules covered by a
Node test suite; only the page glue touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

The dev server is a ~40-line dependency-free static file server; any other
static server works too.

## What you can do

| Control | Effect |
| --- | --- |
| Regime | Load a named density / speed limit / dawdling combination (see below) |
| Density | Cars per cell, 0 to 1. Moving it adds cars to empty cells or removes some, without disturbing the rest |
| Speed limit | Top speed in cells per step, 1 to 9 |
| Dawdling | Probability per step that a driver drops one notch of speed for no reason |
| Road length | Cells around the ring, 50 to 500; changing it rebuilds the road |
| Speed | Simulation steps per animation frame |
| Pause / Step | Freeze the road, or advance it a single step |
| Reset road | Scatter the same number of cars afresh |
| Brake a car | Pick a random moving car and stop it dead, the seed of a phantom jam |
| Sweep density | Walk the density from 0.02 to 0.98, hold each value long enough to measure the flow, and plot every reading |
| Clear diagram | Forget the measured flow–density points |

Click any car on the ring to make that one brake.

Keyboard: <kbd>Space</kbd> pause, <kbd>.</kbd> step, <kbd>B</kbd> brake a car,
<kbd>R</kbd> reset, <kbd>D</kbd> start or stop a sweep, <kbd>[</kbd> / <kbd>]</kbd>
previous or next regime. If your system asks for reduced motion the page opens
paused.

### The three views

- **Ring road.** Every car is a block coloured by speed: red when stopped,
  orange while crawling, pale yellow at the limit. The cyan tick marks the
  finish line where cars are counted.
- **Space–time diagram.** One pixel column per cell, one row per step, newest
  at the bottom, so the road's whole recent history scrolls up the panel. Free
  traffic draws faint diagonal streaks running forward; a jam is a red band
  running the *other* way, because the jam moves backwards while the cars
  inside it move forwards.
- **Flow–density diagram.** Flow is cars passing a point per step. The white
  ring is the live reading; the orange dots are averages recorded at each
  density once the road has settled, so dragging the density slider around
  (or running a sweep) traces the road's fundamental diagram. The dashed
  triangle `min(ρ·vmax, 1 − ρ)` is the exact answer when nobody dawdles; the
  dotted line `ρ·(vmax − p)` is the free-flow branch for the current dawdling
  probability, which the measurements follow until the first jams appear.

### Regimes

| Regime | What it shows |
| --- | --- |
| Phantom jams | Around the critical density: free flow that keeps breaking into jams which drift backwards for hundreds of steps before dissolving |
| Free flow | Light traffic; every dawdle is absorbed before it spreads |
| Stop and go | Twice the cars: several jams circulate at once and everyone alternates between crawling and sprinting |
| Gridlock | Most cells full; cars inch forward one at a time |
| Clockwork drivers | No dawdling; the flow lands exactly on the triangle |
| Nervous drivers | Dawdling 60% of the time; even light traffic jams |
| City street | Speed limit 2; jams are short and dense, and free flow survives far more cars |

## How it works

This is the Nagel–Schreckenberg cellular automaton (1992). The road is a ring
of cells; each car occupies one cell and has an integer speed `v` from 0 to
`vmax`. Every step, all cars update in parallel:

1. **Accelerate.** `v ← min(v + 1, vmax)`.
2. **Brake.** `v ← min(v, gap)`, where `gap` is the number of empty cells to
   the car ahead, so nobody ever hits anyone.
3. **Dawdle.** With probability `p`, `v ← max(v − 1, 0)`.
4. **Move.** `x ← (x + v) mod L`.

Rule 3 is the only randomness and it is what makes the model interesting.
Below a critical density a hesitation costs one car one cell and is forgotten.
Above it the follower, closer than the leader expected, has to brake harder
than the leader did, and the car behind that harder still, until someone
stops. The stopped cluster then drifts upstream: cars leave from its front
faster than they join at its back. Flow per point peaks at the critical
density, which is why adding cars to a busy road delivers fewer of them.

Module layout:

- `src/traffic.js`: the model. `createRoad`, `step` (with per-step flow, mean
  speed, stopped count and finish-line crossings), `setDensity`,
  `stopCarNear` for the braking perturbation, `occupancy` rows for the
  space–time diagram and the deterministic reference curve.
- `src/presets.js`: the named regimes.
- `src/measure.js`: a rolling mean for the status line, the binned
  flow–density record and the density-sweep schedule.
- `src/render.js`: the speed colour ramp, ring geometry with hit-testing,
  chart scales, the scrolling space–time diagram and the chart drawing.
- `src/rng.js`: a small seeded generator so the tests are reproducible.
- `src/main.js`: page glue.

## Tests

```bash
npm test
```

The suite checks that cars are conserved and never share a cell, that speeds
stay within the limit and every car moves by exactly its speed, that the
deterministic model reproduces `min(ρ·vmax, 1 − ρ)` on both branches, that
dawdling pulls flow below that curve, that finish-line counts agree with the
spatial flow, and that each named regime behaves as its description claims.
The measurement and geometry helpers are tested directly, and the space–time
buffer against a tiny fake canvas.

## License

MIT
