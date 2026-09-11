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
- **Undo** — reverse the last add, remove, launch, or mass/color edit (see below).
- **Redo** — reapply the last action **Undo** reversed (see below).
- **Speed** — scale the simulation timestep.
- **Gravitational constant (G) / Softening length** — adjust the simulation's own physics
  constants live, without switching scenarios (see below).
- **Show trails** — toggle position trails for each body.
- **Trail length** — how many past positions each trail keeps before its oldest end drops off.
- **Show conservation chart** — toggle a small live chart of energy and momentum drift (see below).
- **Show predicted paths** — toggle a dashed ghost path per body, forecasting where it's headed
  (see below).
- **Show velocity vectors** — toggle a solid arrow per body, pointing in its current direction
  of travel (see below).
- **Show acceleration vectors** — toggle a dashed arrow per body, pointing the way gravity is
  pulling it right now (see below).
- **Show minimap** — toggle a small overview of the whole system in the corner (see below).
- **Show center of mass** — toggle a crosshair at the system's mass-weighted center (see below).
- **Track center of mass** — keep the viewport panned to that point every tick (see below).
- **Show scale bar** — toggle a map-style scale bar in the corner, showing how many world units a
  given screen length represents at the current zoom (see below).
- **Click empty space on the canvas** — drop a new body at that point, with zero initial
  velocity. Focus the canvas and press <kbd>Enter</kbd> or <kbd>Space</kbd> to do the same from
  the keyboard, at a random point.
- **Click an existing body** — select it and open the inspector panel, showing its live
  position, speed, and kinetic energy, plus editable **Mass** and **Color** fields (see below)
  and a **Keep centered** checkbox to have the view follow it. Click it again, or the panel's
  **Deselect** button, to close it. Its **Remove body** button (or
  <kbd>Delete</kbd>/<kbd>Backspace</kbd>) takes the selected body out of the simulation
  entirely.
- **Drag an existing body** — grab it and pull away to aim a launch: a dashed line previews the
  velocity you're about to give it, and releasing sets that velocity (see below). Dragging empty
  space still pans the view, so this only triggers when the drag starts on a body.
- **Drag the canvas** — pan the view. **Scroll** over it — zoom in or out, centered on the
  pointer. **Reset view** — return to the default pan and zoom. **Frame all bodies** — pan and
  zoom to fit every body on screen at once (see below).
- **Touchscreens** — the canvas responds to touch the same way it does to mouse and wheel: tap
  empty space to drop a body or tap a body to select it, drag with one finger on empty space to
  pan (or on a body to aim and launch it), and pinch with two fingers to zoom in or out around
  their midpoint.
- **Export scenario** — download the running simulation (every body's mass, position, velocity,
  and color, plus the gravitational constant, softening, and current view) as a JSON file.
- **Import scenario&hellip;** — load a previously exported file back in, replacing the running
  simulation. A malformed or hand-edited file is rejected with a description of what's wrong,
  rather than partially applied.
- **Copy share link** — copy a URL that reproduces the running simulation to the clipboard.
  Opening it loads the encoded scenario the same way importing a file does (see below).
- **Download snapshot** — save the current view of the main stage as a PNG, named after the
  running scenario. Unlike export/import or a share link, this captures a single still moment
  rather than a resumable simulation — for sharing a look at a tight binary, a mid-collision
  merge, or a slingshot in progress somewhere a live page or JSON file can't go. Only the main
  stage is captured, not the minimap or conservation chart.
- **Save name&hellip; / Save in browser** — save the running simulation under a name, kept in
  this browser (via `localStorage`) rather than downloaded as a file, for a quicker round-trip
  than export/import when you're iterating locally.
- **Saved scenarios / Load / Delete** — pick a save from the dropdown to load it back in
  (replacing the running simulation, same as importing a file) or delete it.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `R` | Reset the current scenario |
| `U` | Undo the last add, remove, launch, or mass/color edit |
| `Y` | Redo the last undone action |
| `↑` / `↓` | Raise / lower speed |
| `T` | Toggle trails |
| `C` | Toggle the conservation chart |
| `P` | Toggle predicted paths |
| `V` | Toggle velocity vectors |
| `A` | Toggle acceleration vectors |
| `M` | Toggle the minimap |
| `B` | Toggle the center of mass marker |
| `L` | Toggle the scale bar |
| `Enter` / `Space` (canvas focused) | Drop a new body at a random point |
| `[` / `]` | Select the previous / next body |
| `Esc` | Deselect the current body |
| `+` / `-` | Zoom in / out, centered on the canvas |
| `0` | Reset the view |
| `F` | Frame all bodies |
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
| Sun, Planet & Moon | A hierarchical three-body system: a moon in a tight circular orbit around a planet, which is itself in a wider circular orbit around the sun — the moon's distance is kept safely inside the planet's Hill sphere so it stays bound instead of drifting off under the sun's tidal pull. |
| Trojan Asteroid | A sun and planet in circular orbit, plus a small asteroid at the planet's leading Lagrange point (L4), 60° ahead along the same orbit — it librates near that point indefinitely instead of drifting away, the same way real Trojan asteroids cluster at Jupiter's L4/L5 points. |
| Eccentric Orbit | A sun and one planet on a genuinely elliptical orbit (every other orbiting preset above uses a circular one) — starting at perihelion, the planet visibly speeds up diving toward the sun and slows down drifting out to aphelion, tracing out Kepler's second law instead of moving at a constant speed. |
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

### Adjusting gravity and softening

`F = G * m1 * m2 / r^2`'s `G` and the softening length are usually fixed at whatever a preset
sets them to, but the **Gravitational constant (G)** and **Softening length** sliders let you
change either one live, for exploring how the same scenario behaves under stronger or weaker
gravity, or with more or less softening smoothing out close encounters. A softening length near
zero makes near-collisions dramatic (and, at exactly zero, numerically unstable at very short
range) — the "Random Cluster" preset deliberately starts with a small softening (`0.05`) for
that reason, while presets with orbiting bodies use a larger one to keep close passes smooth.
Both sliders re-sync to the current scenario's values (rather than keeping whatever you'd
dragged them to) whenever the whole simulation state changes from under them: switching presets,
resetting, importing a file, loading a save, opening a share link, or undoing.

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

### Velocity vectors

Where predicted paths forecast a body's future, **Show velocity vectors** shows its present:
a solid arrow from each body pointing in its current direction of travel, with an arrowhead at
the tip. [`src/velocityVectors.js`](src/velocityVectors.js)'s `computeVelocityArrow` scales the
arrow's length by the square root of the body's speed rather than linearly, then clamps it
between a minimum and maximum — a near-stationary body in a tight orbit still shows a visible
marker, and a rogue flyby's closest-approach speed doesn't draw an arrow that dwarfs the rest of
the scene. Like `viewport.js` and `trajectory.js`, the scaling and clamping math has no DOM
dependency and is tested on its own; only the actual arrow drawing lives in `main.js`.

### Acceleration vectors

**Show acceleration vectors** adds the companion overlay: a dashed arrow from each body pointing
the way gravity is pulling it *right now* — the net of every other body's attraction, using the
same forces the integrator applies that frame. Where the velocity arrow shows which way a body
is moving, this shows which way it's being turned. In a circular orbit the two are
perpendicular; in a slingshot they swing far out of step, which is the quickest way to see why
the path bends the way it does. [`src/accelerationVectors.js`](src/accelerationVectors.js)'s
`computeAccelerationArrow` uses the same square-root length scaling and min/max clamp as the
velocity arrow, and stays independent of the N-body force code — the caller passes in the
acceleration components from `computeAccelerations`. The dashed shaft (versus the velocity
arrow's solid one) keeps the two legible where they overlap.

### Inspector panel

Selecting a body (by clicking it, or cycling with <kbd>[</kbd>/<kbd>]</kbd>) opens a panel
showing its current position, speed, and kinetic energy, refreshed every tick — useful for, say,
watching a planet's speed peak at perihelion or a rogue body's kinetic energy stay enormous even
as gravity bends its path. Selection tracks the body by identity across ticks; if the selected
body merges with another, the resulting fused body has no history to select, so the panel closes
automatically (with a screen-reader announcement explaining why — see Accessibility
announcements below). [`src/inspector.js`](src/inspector.js) has no DOM dependency either — it
just picks a body from a point or a neighbor in the list, and reads off its stats.

The panel's **Mass** field edits the selected body's mass directly, live — heavier or lighter
immediately changes how strongly it pulls on (and is pulled by) everything else.
`parseMassInput` rejects anything that isn't a positive, finite number, reverting the field to
the body's last valid mass rather than applying a zero, negative, or unparseable value. The
**Color** field is a native color picker for the same body, purely cosmetic — it doesn't affect
the physics, only how the body and its trail are drawn. Both fields are left untouched on ticks
while focused, so a mass being typed or a color mid-drag doesn't get overwritten by the next
refresh; the color field only commits (and pushes an undo snapshot) once the picker closes,
rather than once per intermediate hue while dragging across its gradient.

The panel's **Keep centered** checkbox re-centers the view on the selected body every tick,
handy for following a fast body (like the rogue flyby's interloper) without it drifting out of
frame. Panning manually — by dragging or with the arrow keys — turns it back off, so the two
don't fight over the viewport.

### Drag to launch

Grabbing a body and dragging (with the mouse, or one finger on touch) previews a launch: a
dashed line from the body to the pointer shows the velocity a release would give it, scaled
from the drag distance by [`src/launch.js`](src/launch.js)'s `launchVelocityFrom`, which is
DOM-free like the rest of the physics code. Dragging farther launches faster in that direction;
dragging back over the body cancels out to a stop. Releasing applies the velocity and selects
the body, so the inspector panel confirms the new speed immediately. A drag that starts on
empty space still pans the view as before — only a drag that starts on an existing body aims a
launch, so the two gestures never conflict.

### Pan and zoom

The canvas has its own viewport, independent of the physics: [`src/viewport.js`](src/viewport.js)
maps world coordinates (where the simulation actually lives) to screen pixels through a pan
offset and a zoom factor, with no DOM dependency of its own. Zooming keeps the world point under
the cursor fixed on screen, the same way map applications zoom toward the pointer rather than
the canvas center, so a scroll while examining a tight binary pair doesn't fling it off-screen.
Switching presets or hitting **Reset** also resets the view, so a scenario always starts framed
the same way.

Touch reuses the same transform: a one-finger drag panning is the touch equivalent of dragging
with the mouse, and a two-finger pinch zooms around the pinch's midpoint the same way the wheel
handler zooms around the cursor, both calling the same `zoomAt` and `panBy` functions.

**Frame all bodies** picks a pan and zoom that fits every body on screen at once, computed by
`viewport.js`'s `frameBodies` from the bodies' current bounding box (padded by 15% so nothing
sits flush against the edge) rather than a fixed scale, so it works the same whether the system
is a tight binary or a cluster that's flung itself apart. A single body, or a cluster so tight
its bounding box is nearly a point, is framed at a bounded minimum extent instead of zooming in
arbitrarily far. Framing turns off **Keep centered** first, the same way manually panning does,
so the two don't immediately fight over the viewport.

### Minimap

Zooming in on one part of a spread-out system loses track of where that part sits relative to
everything else. [`src/minimap.js`](src/minimap.js) fits every body into a small, fixed-size
overview in the corner — independent of the main viewport's own pan and zoom, computed the same
way `frameBodies` fits the main view (a padded bounding box, with a minimum extent so a single
body doesn't blow up to fill the whole minimap) — plus an outline of exactly what the main view
currently shows, a "you are here" box that shrinks as the main view zooms in. Both are DOM-free
pure functions, tested the same way `viewport.js`'s are, with the actual drawing (two `<canvas>`
elements' worth of circles and a stroked rectangle) left to `main.js`.

### Center of mass marker

A body that looks like it's orbiting another isn't necessarily orbiting *it* — both are really
orbiting their shared center of mass, which only coincides with one body's own position when
it's overwhelmingly heavier than everything else (true enough for "Sun & Planets" to look right
either way, but not for "Binary Star + Planet," where the two stars visibly orbit a point
between them). **Show center of mass** draws a crosshair at exactly that point, computed by
`physics.js`'s existing `centerOfMass` — the same mass-weighted average position already used
internally, just made visible. It's recomputed and redrawn every frame like the bodies
themselves, so it stays put through mergers and stays accurate as masses are edited live from
the inspector panel.

**Track center of mass** goes a step further than just marking that point — it re-pans the
viewport to keep it centered on screen every tick, the same way the inspector panel's **Keep
centered** follows a single selected body. Useful for a cluster with enough net momentum to
drift as a whole (an off-center "Random Cluster" roll, say), where marking the center of mass is
one thing but watching it slide toward the edge of the view is another. The two follow modes
are mutually exclusive — turning one on turns the other off, the same way manually panning,
dragging, or **Frame all bodies** already turns off **Keep centered** — since both drive the
same pan every tick and letting both run would mean whichever ran last in that tick silently
wins, leaving the other's checkbox checked but doing nothing.

### Scale bar

The numeric zoom readout (`1.0×`, `2.4×`, ...) says how much the view has been scaled, but not
what that means for any particular distance on screen — is a rogue flyby's closest approach
really twice as far out as the planet, or does it just look that way at this zoom? **Show scale
bar** draws a small map-style ruler in the main canvas's bottom-left corner: a line with end
ticks and a number, the same convention paper and digital maps use for physical distance.
[`src/scaleBar.js`](src/scaleBar.js)'s `computeScaleBar` picks the bar's length in world units
from the standard cartographic 1-2-5-10-20-50&hellip; sequence — always a "nice" round number,
never an arbitrary value like `73.4` — choosing whichever nice length's on-screen size (at the
current zoom) lands closest to a fixed target width, so the bar redraws at a new round length as
you zoom in or out rather than growing or shrinking a fixed one off-screen. Like `viewport.js`
and `minimap.js`, the picking logic has no DOM dependency and is tested on its own.

### Scenario export/import

A scenario built up interactively — dropping bodies, nudging the view, letting a cluster
settle — is otherwise lost on reload. [`src/scenario.js`](src/scenario.js) turns the running
state into a plain JSON snapshot (each body's mass, position, velocity, radius, and color, plus
`G`, softening, and the viewport) and back, with no DOM dependency of its own, so it can be
tested without a File or Blob API. Each body's `id` and trail are deliberately left out of the
snapshot: they're session bookkeeping that a freshly loaded scenario regenerates rather than
replays. Loading validates every field and throws a specific, human-readable error on the first
problem found — instead of silently corrupting the running simulation with a malformed or
hand-edited file — which the UI surfaces without applying any of the (possibly partial) change.

### Share links

[`src/shareLink.js`](src/shareLink.js) packs a scenario into a URL instead of a downloaded
file, for handing a running simulation to someone else with a link rather than an attachment.
It builds on the same `serializeScenario` / `deserializeScenario` pair as export/import and
local saves — share links only own turning that snapshot into (and back out of) a URL-safe
string, not the scenario format itself — so a share link gets the same validation and
descriptive rejection of malformed data as a hand-edited import file. The encoded scenario
lives in the URL's hash rather than a query parameter, since a hash is never sent to the
server, keeping the whole exchange client-side. Opening a share link consumes it once: the
scenario loads on startup and the hash is then cleared from the address bar, so refreshing the
page afterward continues from wherever the simulation has since evolved to, instead of
resetting back to the shared moment.

### Local saves

[`src/storage.js`](src/storage.js) saves named scenario snapshots straight to the browser's
`localStorage`, for a faster round-trip than export/import's file download when you're
iterating on a scenario in one sitting. It builds on the same `serializeScenario` /
`deserializeScenario` pair scenario export/import uses — storage.js only owns naming and
persistence, not the scenario format itself — and takes the storage object as a parameter
rather than reaching for `window.localStorage` directly, so it can be tested against a plain
in-memory fake instead of a real browser environment. Saves persist only in the browser and
device they were made in; export a scenario to a file instead to move it elsewhere.

### Undo and redo

Dropping a body in the wrong spot, removing the wrong one, launching it at the wrong speed, or
editing its mass or color is otherwise permanent the instant it happens. [`src/history.js`](src/history.js)
is a small, DOM-free bounded stack of opaque snapshots — pushed before each of those five
actions, using the same `serializeScenario` that export/import and local saves already rely on,
so undo needed no scenario-format logic of its own. Undoing pops the most recent snapshot and
restores it with `deserializeScenario`, the same path a loaded file or share link takes. The
undo stack holds the last 20 actions and is cleared whenever the whole scenario changes from
under it — switching presets, resetting, importing a file, loading a save, or opening a share
link — since undoing into a scenario the current one replaced would restore bodies from an
unrelated simulation. Selecting a body, panning, zooming, or adjusting G/softening isn't itself
undoable; only the five body-mutating actions push a snapshot.

Redo reverses an undo the same way undo reverses one of those five actions: `main.js` keeps a
second `history.js` stack for it, and every undo pushes the state it's about to replace onto
that redo stack before restoring the earlier snapshot — so redoing steps forward through
exactly the actions undo just stepped back through. Taking a fresh body-mutating action after
an undo clears the redo stack rather than leaving it in place, since the action has now
diverged from the timeline redo would otherwise return to; redoing into it would silently
discard the new action. Like undo, it's cleared whenever the whole scenario changes from
under it.

### Accessibility announcements

Two events change the body count without any direct user action to explain them: a collision
merging two bodies into one, and removing the selected body. A sighted user watching the canvas
can (usually) see a collision happen, but a screen-reader user has no other way to notice —
including why the inspector panel they had open just closed on its own. A visually hidden
`aria-live="polite"` region announces both, with wording formatted by
[`src/announcements.js`](src/announcements.js), kept DOM-free like the rest of the simulation
logic so the exact phrasing is tested independently of a live region.

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
