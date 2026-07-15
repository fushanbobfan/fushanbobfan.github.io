# Gravity Garden

An interactive playground for Newtonian gravity, built with plain HTML5 canvas and
vanilla JavaScript — no build step, no dependencies.

Watch planets orbit a sun, two stars circle a shared center of mass, three equal
masses trace a stable figure-eight, or a random cluster of bodies pull each other
into loose clumps and slingshots.

## Running it

Any static file server works, since the page is loaded as ES modules over HTTP
(opening `index.html` directly via `file://` will not load the modules). For example:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL in a browser.

## Controls

- **Scenario** — switch between the built-in presets.
- **Pause / Reset** — stop the simulation or reload the current scenario's initial conditions.
- **Speed** — scale the simulation timestep.
- **Show trails** — toggle position trails for each body.
- **Show conservation chart** — toggle a small live chart of energy and momentum drift (see below).
- **Show predicted paths** — toggle a dashed ghost path per body, forecasting where it's headed
  (see below).
- **Click empty space on the canvas** — drop a new body at that point, with zero initial
  velocity. Focus the canvas and press <kbd>Enter</kbd> or <kbd>Space</kbd> to do the same from
  the keyboard, at a random point.
- **Click an existing body** — select it and open the inspector panel, showing its live mass,
  position, speed, and kinetic energy (see below), plus a **Keep centered** checkbox to have the
  view follow it. Click it again, or the panel's **Deselect** button, to close it.
- **Drag the canvas** — pan the view. **Scroll** over it — zoom in or out, centered on the
  pointer. **Reset view** — return to the default pan and zoom.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `R` | Reset the current scenario |
| `↑` / `↓` | Raise / lower speed |
| `T` | Toggle trails |
| `C` | Toggle the conservation chart |
| `P` | Toggle predicted paths |
| `Enter` / `Space` (canvas focused) | Drop a new body at a random point |
| `[` / `]` | Select the previous / next body |
| `Esc` | Deselect the current body |
| `+` / `-` | Zoom in / out, centered on the canvas |
| `0` | Reset the view |
| `←` / `→` | Pan left / right |
| `Shift`+`↑` / `Shift`+`↓` | Pan up / down |

Shortcuts are ignored while a form control (the scenario dropdown, speed slider, etc.) has
focus, so their own native keyboard behavior still works as expected.

## Presets

| Scenario | Description |
| --- | --- |
| Sun & Planets | A central mass with three planets in circular orbits at increasing radii. |
| Binary Star + Planet | Two unequal-mass stars orbiting their common center of mass, with a planet further out. |
| Figure-Eight Three-Body | The Chenciner–Montgomery choreography: three equal masses chasing each other around a stable figure-eight curve. |
| Rogue Flyby | A sun and one orbiting planet, plus a fast interloper on a hyperbolic path that gets deflected by a gravitational slingshot. |
| Random Cluster | A randomized cluster of bodies with varied mass, useful for watching chaotic multi-body dynamics emerge. |

## Physics

Every pair of bodies attracts the other according to Newton's law of universal
gravitation, `F = G * m1 * m2 / r^2`. The system is integrated with
[velocity Verlet](https://en.wikipedia.org/wiki/Verlet_integration) (a symplectic,
time-reversible method), which conserves energy and momentum far better than a
naive Euler step over long simulation runs. A small softening length is added to
the squared distance in the force calculation so that accelerations stay finite
if two bodies pass very close to each other, a standard technique in N-body
simulation.

When two bodies overlap, they merge into one inelastic body that conserves
total mass and momentum, rather than orbiting forever at zero distance.

The core simulation logic lives in [`src/physics.js`](src/physics.js) and has no
dependency on the DOM or canvas, so it can be tested and reused on its own.

### Conservation chart

Energy and momentum should stay constant in a real Newtonian system; any drift
you see is purely numerical error from the leapfrog integrator taking finite
steps. The conservation chart plots that drift live, as a percentage of each
quantity's value when tracking started, so you can watch the integrator's
accuracy hold up (or degrade at high speeds/small softening) instead of only
checking it in a test suite. [`src/diagnostics.js`](src/diagnostics.js) keeps a
short rolling history of these samples and has no DOM dependency either.

### Predicted paths

[`src/trajectory.js`](src/trajectory.js) forecasts each body's future path by re-running the
same leapfrog integrator on a throwaway copy of the current state, without touching the live
simulation. The result is drawn as a dashed ghost line ahead of each body — a look at where
gravity is about to take it, updated every few ticks (or immediately, if the number of bodies
changes). The forecast doesn't run collision merging, so a predicted close encounter shows the
bodies' unmerged paths rather than the merge itself.

### Inspector panel

Selecting a body (by clicking it, or cycling with <kbd>[</kbd>/<kbd>]</kbd>) opens a panel
showing its current mass, position, speed, and kinetic energy, refreshed every tick — useful
for, say, watching a planet's speed peak at perihelion or a rogue body's kinetic energy stay
enormous even as gravity bends its path. Selection tracks the body by identity across ticks;
if the selected body merges with another, the resulting fused body has no history to select, so
the panel closes automatically. [`src/inspector.js`](src/inspector.js) has no DOM dependency
either — it just picks a body from a point or a neighbor in the list, and reads off its stats.

The panel's **Keep centered** checkbox re-centers the view on the selected body every tick,
handy for following a fast body (like the rogue flyby's interloper) without it drifting out of
frame. Panning manually — by dragging or with the arrow keys — turns it back off, so the two
don't fight over the viewport.

### Pan and zoom

The canvas has its own viewport, independent of the physics: [`src/viewport.js`](src/viewport.js)
maps world coordinates (where the simulation actually lives) to screen pixels through a pan
offset and a zoom factor, with no DOM dependency of its own. Zooming keeps the world point under
the cursor fixed on screen, the same way map applications zoom toward the pointer rather than
the canvas center, so a scroll while examining a tight binary pair doesn't fling it off-screen.
Switching presets or hitting **Reset** also resets the view, so a scenario always starts framed
the same way.

## Development

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and check physical
invariants of the simulation: Newton's third law, conservation of momentum and
(approximate) energy over a long run, and that the center of mass of a
symmetric system stays fixed.

## License

MIT, see [LICENSE](LICENSE).
