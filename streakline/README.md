# streakline

A wind tunnel in the browser. Air enters on the left and flows past a
cylinder, a square post, a flat plate or a wing section. At low Reynolds
numbers the flow closes up behind the obstacle around two still eddies; raise
the number and the wake starts to swing from side to side and sheds eddies of
alternating spin, the von Kármán vortex street. Draw your own walls across the
tunnel and the flow finds its way round them.

**Live demo:** https://fushanbobfan.github.io/streakline/

No build step and no dependencies. The lattice, the obstacles, the derived
fields, the dye, the colour maps and the share-link format are plain ES
modules covered by a Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What you are looking at

**Vorticity** (the default view) is how fast the fluid is spinning: red
anticlockwise, blue clockwise. Spin is made only at the obstacle's surface,
where the fluid sticks to it, and is then carried downstream. In the vortex
street the two shear layers peel off the top and bottom of the cylinder and
roll up in turn, so the eddies alternate red and blue.

**Speed** runs from dark (at rest) to light (1.6 times the inflow), and
**pressure** shows where the density is above (red) or below (blue) the
free stream, scaled by the dynamic pressure ρU²/2. The stagnation point on the
nose of the obstacle is the reddest spot; each eddy core is a low.

**Streaklines** are the dark and light dots released from a rake of points
near the inlet. A streakline is everything that ever passed through one point,
which is what smoke in a real tunnel shows. In a steady flow it matches the
streamline; in the vortex street it folds into the familiar rolled-up chain.

## Forces and shedding

The panel under the controls plots the drag and lift coefficients over the
last 40 flow times (one flow time D/U is how long the stream takes to cover
one obstacle length). Each coefficient is the force divided by ρU²D/2.

The force is found by momentum exchange. With halfway bounce-back, every
population that heads into the obstacle after a collision comes back
reversed, so it hands the obstacle twice its momentum; summing 2 e_i f_i over
the links between fluid and obstacle cells gives the force each step.
Painted walls are not counted.

When the lift swings, the page reads the shedding period from its upward
crossings of the mean, gives the Strouhal number St = f D / U, and averages
drag and lift over whole periods only. Readings carry "(settling)" for the
first 25 flow times, while the wake is still forming.

`npm run probe` runs the same tunnel without the page:

```bash
node scripts/probe.js --preset street --time 120
```

On the default 300 × 120 grid with a cylinder 20 cells across (so it blocks a
sixth of the tunnel's height), 120 flow times give:

| Re | Wake | Mean C<sub>d</sub> | Lift swing | St |
| --- | --- | --- | --- | --- |
| 30 | steady | 2.33 | 0 | – |
| 100 | shedding | 1.75 | ±0.44 | 0.193 |
| 150 | shedding | 1.72 | ±0.70 | 0.207 |

These are numbers for this tunnel, with its close walls and a cylinder only
20 cells across; they are not open-flow values.

## Scenes

| Scene | What happens |
| --- | --- |
| Vortex street | Cylinder at Re 150: periodic shedding of alternating eddies. |
| Twin eddies | Cylinder at Re 30: two eddies sit still behind it. For a cylinder in open flow shedding starts near Re 47 (Mathis, Provansal and Boyer, 1984). |
| Plate across the flow | A plate square to the stream separates at its sharp edges and leaves a wide wake. |
| Wing at 6° | NACA 2412 at Re 1000: the flow follows both surfaces and the wake stays thin. |
| Stalled wing | The same wing at 22°: flow leaves the upper surface and the wake fills with eddies. |
| Square post | Corners fix where the flow separates. |

## How it works

The fluid is a D2Q9 lattice Boltzmann model. Each cell holds nine numbers,
the amount of fluid moving to each neighbour and staying put. Every step the
populations first relax towards a local equilibrium (BGK collision) and then
hop one cell along their direction (streaming). Density and velocity are the
zeroth and first moments of the nine populations.

- **Viscosity.** With relaxation time τ the kinematic viscosity is
  ν = (τ − ½)/3 in lattice units, so the Reynolds number Re = U D / ν with
  inflow speed U and obstacle size D fixes τ. Below τ = 0.51 plain BGK goes
  unstable at these speeds, so a Reynolds number too high for the obstacle size
  is capped there and the page says so. A larger obstacle or a faster inflow
  reaches higher.
- **Walls.** A population that would stream into a solid cell comes straight
  back the way it came (halfway bounce-back), which puts a no-slip wall midway
  between the solid cell and the fluid cell.
- **Tunnel edges.** The inlet column and the top and bottom rows are held at
  the free-stream equilibrium; the outlet column copies its neighbour.
- **Start.** The run starts from the free stream with a small sideways nudge
  behind the obstacle, so the wake does not wait on rounding errors to break
  its symmetry.
- **Guard.** If any density leaves the range 0.5 to 1.5 the run restarts from
  the free stream with a note.
- **Dye** is carried by bilinearly interpolated velocities with a midpoint
  step and dropped when it leaves the tunnel or lands inside a wall.

The tests check the lattice symmetries and equilibrium moments, mass and
momentum conservation, bounce-back, the momentum-exchange force against the
total push on the fluid in a forced periodic box (within 1%), the shedding
analysis on known signals, the parabolic Poiseuille profile in a
forced channel (within 2% of the exact solution, which pins down both the
viscosity formula and the wall position), the NACA 0012 outline against its
textbook area, and the share-link round trip.

## Controls

- **Obstacle:** shape, NACA profile, angle (positive raises the leading
  edge), and size in lattice cells.
- **Flow:** Reynolds number on a log slider, inflow speed (lattice units;
  the lattice Mach number is √3 times it and should stay well below 1), and
  grid size.
- **View:** colour field, streaklines, and how many lattice steps run per
  animation frame.
- **Pointer:** drag to draw walls; choose Erase or hold Shift to remove them.
- **Keys:** Space pauses, R restarts, V cycles the view.
- **Copy share link** writes the settings that differ from the defaults into
  the URL. Hand-drawn walls are not included.

## Code layout

| File | Contents |
| --- | --- |
| `src/lattice.js` | D2Q9 constants, equilibrium, collision, streaming, tunnel edges |
| `src/obstacles.js` | Cylinder, square, plate and NACA four-digit shapes, rasterized to cells |
| `src/units.js` | Reynolds number to relaxation time, with the stability cap |
| `src/field.js` | Vorticity, speed and interpolated velocity |
| `src/tracers.js` | Streakline dye: release, advection, removal |
| `src/render.js` | Colour maps and the field image |
| `src/settings.js` | Settings, limits, scenes and share links |
| `src/shedding.js` | Drag and lift coefficients, their history, period and Strouhal number |
| `src/chart.js` | Ranges and point mapping for the force chart |
| `src/sim.js` | The tunnel: obstacle, painted walls, stepping, force sampling and the restart guard |
| `src/main.js` | Page wiring |
| `scripts/probe.js` | Headless runs that print drag, lift and the Strouhal number |

## Licence

MIT
