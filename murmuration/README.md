# Murmuration

An interactive flocking simulation in the browser, built with plain HTML and vanilla
JavaScript — no build step, no dependencies.

Hundreds of boids follow three local rules — keep apart, line up, stay together — and a
flock emerges. Tune the rules live and watch it tighten into a school, scatter into a swarm,
or ripple away from your cursor.

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

- **Preset** — load a named parameter set. Each one shows a different regime:
  *Murmuration* (balanced), *Fish school* (strong alignment, one turning body), *Swarm*
  (cohesion without alignment, a buzzing cloud), *Scatter* (separation only) and *Lanes*
  (alignment only, parallel traffic streams). Picking a preset moves the sliders below to
  match, and you can keep adjusting from there.
- **Boids** — flock size, from 10 to 1000. Growing keeps the current boids and adds more;
  shrinking removes the newest ones.
- **Separation / Alignment / Cohesion** — the weight of each rule. Setting a weight to 0
  switches that rule off entirely.
- **Perception radius** — how far each boid looks for neighbours. Larger radii make bigger,
  slower-turning groups.
- **Max speed** — the speed cap every boid is clamped to.
- **Edges** — *Steer away from walls* turns boids back before they reach an edge (with a hard
  bounce as a last resort), while *Wrap around* makes the canvas a torus.
- **Colour by** — tint each boid by its heading (a hue wheel), by its speed (blue = slow,
  red = fast), or not at all.
- **Leave trails** — fade the previous frame instead of clearing it, so every boid draws a
  streak.
- **Pause / Reset flock** — freeze the simulation, or start over from a fresh random layout
  with the current settings.
- **Cursor** — what the pointer does over the canvas. *Threat the flock flees* (the default)
  places a threat wherever the pointer is; the dashed ring shows its reach and leaving the
  canvas removes it. *Place an obstacle* drops a disc of the chosen **Obstacle size** on each
  click, and *Remove an obstacle* deletes the disc under the click. Obstacles stay put across
  resets and rescale with the canvas; **Clear obstacles** removes them all.

Keyboard shortcuts (when no control is focused): **Space** pauses, **R** resets, **T**
toggles trails, **O** cycles the cursor mode, **X** clears obstacles. If your system asks for
reduced motion the page opens paused.

## How it works

Each frame, every boid finds the neighbours within its perception radius and computes three
steering forces, following Craig Reynolds' original 1987 rules:

- **Separation** steers away from neighbours closer than the separation radius, weighting
  nearer ones more heavily. Two boids on exactly the same point push off in directions
  derived from their ids, so they never stay stacked.
- **Alignment** steers toward the average velocity of the neighbours.
- **Cohesion** steers toward the neighbours' centre of mass.

Each force is a *desired velocity minus current velocity*, capped at a small maximum so a
boid can only turn so sharply per frame. The weighted sum (plus edge avoidance, obstacle
avoidance and any threat) is added to the velocity, the velocity is clamped to the maximum
speed, and the boid moves. Forces are computed for every boid before any of them moves, so
the result does not depend on storage order.

Obstacle avoidance follows Reynolds' *unaligned collision avoidance*: each boid looks ahead
along its velocity (25 frames' worth, so faster boids react sooner) and, if a disc plus a
small clearance margin crosses that path, steers sideways away from the disc's centre. The
turn is stronger the closer the disc and the more squarely the boid would hit it, and only
the strongest obstacle counts so two discs flanking a gap do not cancel out. A boid heading
dead-centre picks a side from its id, so a stream splits around a disc instead of piling up
on one side. Anything already inside the clearance zone is pushed straight out, and as a
last resort a boid that still ends a frame inside a disc is placed back on its rim with the
inward part of its velocity reflected.

Neighbour lookups go through a uniform spatial hash whose cell size equals the perception
radius, so each query touches at most nine cells instead of the whole flock. That keeps
1000 boids comfortably interactive.

The starting layout comes from a seeded generator, so the same seed always produces the same
flock — the tests rely on this for repeatable trajectories.

## Tests

The pure modules (vectors, the seeded RNG, the spatial hash, the steering rules, the
simulation, presets and the colour helpers) are covered by Node's built-in test runner:

```bash
npm test
```

The renderer test drives the drawing code with a recording stand-in for the canvas context,
so no browser is needed.

## Project layout

```
index.html          page shell and controls
style.css           layout and theme
src/main.js         wires the controls to the simulation and runs the frame loop
src/simulation.js   the flock: spawning, stepping, edge modes, the cursor threat, obstacles
src/flock.js        separation, alignment, cohesion, flee, edge and obstacle avoidance forces
src/spatialHash.js  uniform grid for radius queries
src/render.js       canvas drawing and colour helpers
src/presets.js      named parameter sets
src/vec.js          2D vector helpers
src/rng.js          seeded PRNG
test/               node:test suites, one per module
```

## License

MIT — see [LICENSE](LICENSE).
