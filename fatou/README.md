# fatou

The Mandelbrot set and its Julia sets side by side. Pick a parameter *c* on
the left and the right-hand picture becomes the Julia set of
*z* &rarr; *z*&sup2; + *c*, with the orbit of 0 drawn on top and the cycle it
settles into ringed. Hover the right-hand picture to trace the orbit of any
starting point.

**Live demo:** https://fushanbobfan.github.io/fatou/

No build step and no dependencies. The iteration, cycle finding, view
geometry, colouring, places and share-link format are plain ES modules
covered by a Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What the two pictures show

Every quadratic polynomial can be written as f(z) = z&sup2; + c. For a fixed
*c*, the **Julia set** is the boundary between starting points whose orbits
stay bounded and those that run off to infinity. The **Mandelbrot set** is the
set of parameters *c* for which the orbit of the critical point 0 stays
bounded. The two are tied together:

- If *c* is in the Mandelbrot set, its Julia set is connected.
- If *c* is outside, the Julia set falls apart into a Cantor set of dust.

Inside the Mandelbrot set, most points belong to a *hyperbolic component*: a
region where the orbit of 0 is drawn into an attracting cycle of a fixed
length, the component's period. The main cardioid has period 1, the large
disk to its left period 2, and every bulb and every small copy of the set has
its own. In the parameter plane the components are painted by that period.

In the dynamical plane the default ("by period; Julia basin by phase")
colours the bounded Fatou components by their *phase*. An attracting cycle
z*<sub>0</sub> &rarr; &hellip; &rarr; z*<sub>p&minus;1</sub> has one component
around each cycle point, and the map carries each onto the next; every other
bounded component is eventually carried into one of them. A point has phase
*j* when its orbit is in the component of z*<sub>j</sub> at times 0, *p*,
2*p*, &hellip;, which is read off from where the orbit meets the cycle: if
z<sub>n</sub> is near z*<sub>k</sub>, the phase is (*k* &minus; *n*) mod *p*.
For the rabbit this paints the three ears around each pinch point in three
colours, and applying the map moves every colour one step on. Choose "coloured
by period" to give the whole basin one colour instead.

The readout reports what happens to the orbit of 0 at the chosen *c*:

| Field | Meaning |
| --- | --- |
| Orbit of 0 | how many steps it takes to escape, or to settle on its cycle |
| Cycle | the period of the attracting cycle |
| Multiplier | &lambda; = &prod; 2*z*<sub>i</sub> over the cycle; \|&lambda;\| runs from 0 at the component's centre to 1 on its edge, and its angle is the internal angle |
| Julia set | connected or dust |

### Bulbs and centres

Each hyperbolic component has a centre, its *nucleus*, where 0 is itself
periodic and &lambda; = 0. **Move c to its component's centre** (or
<kbd>N</kbd>) finds it with Newton's method on f<sub>c</sub><sup>p</sup>(0) = 0
in *c*, starting from the current *c* and using the period the readout found.

The main cardioid carries a bulb at every rational internal angle *p*/*q*: the
bulb is rooted at e<sup>2&pi;i*t*</sup>/2 &minus; e<sup>4&pi;i*t*</sup>/4 with
*t* = *p*/*q*, and its period is *q*. The **Bulb** menu lists every reduced
*p*/*q* with *q* &le; 10. Its centre is found by Newton's method aimed one
estimated radius (sin(&pi;*p*/*q*)/*q*&sup2;) out from the root along the
cardioid's normal, and checked by confirming the period is still *q* halfway
back to the root. In the Julia set of a *p*/*q* bulb, *q* arms meet at the
fixed point and each step of the map turns them *p*/*q* of a turn; the orbit
of 0 visits the arms in that order.

## How it is computed

- **Escape time.** Orbits are followed until |*z*| > 1000. The large bailout
  radius makes the smooth count *n* + 1 &minus; log&#8322; log |*z*|
  continuous, so the colour bands have no steps.
- **Distance estimate.** The derivative is carried along the orbit (with
  respect to *c* on the left, to *z*&#8320; on the right). The estimate
  |*z*| log |*z*| / 2|*z*&prime;| is within a factor of four of the true
  distance to the set (Koebe's quarter theorem). "Bands with boundary lines"
  darkens pixels closer than a couple of pixel widths, so filaments thinner
  than a pixel still show.
- **Periodicity checking.** Bounded orbits are compared against a point saved
  at power-of-two steps (Brent's method). Once the orbit returns to within
  10<sup>&minus;13</sup> of the saved point it has settled on a cycle, which
  stops the iteration early and gives the period.
- **Cycles and multipliers.** For the readout, the cycle point is sharpened by
  Newton's method on f<sup>p</sup>(*z*) &minus; *z* before the multiplier is
  taken. Parameters whose orbit lands exactly on a repelling cycle (such as
  *c* = *i*) are reported as having no attracting cycle.
- **Shortcuts.** Points in the main cardioid or the period-2 disk are
  recognised by closed-form tests and never iterated.
- **Progressive rendering.** Each picture is drawn first in 8 &times; 8
  blocks, then at full resolution, a block row at a time within a per-frame
  time budget, so the page stays responsive while you drag.
- **Precision.** Coordinates are doubles. Below a pixel width of about
  10<sup>&minus;13</sup> neighbouring pixels share coordinates; the status line
  warns when a view gets there.

## Controls

| Action | Parameter plane | Dynamical plane |
| --- | --- | --- |
| Click | choose *c* | |
| Hover | choose *c* when "follows the pointer" is on | trace the orbit of that point |
| Drag | pan | pan |
| Wheel or double-click | zoom (shift + double-click zooms out) | zoom |
| Arrow keys, + and &minus; | pan and zoom the focused plane | same |
| Enter | choose the centre of the view as *c* | |

Anywhere on the page: <kbd>F</kbd> toggles follow, <kbd>N</kbd> moves *c* to
the centre of its component, <kbd>B</kbd> toggles
boundary lines, <kbd>P</kbd> cycles palettes, <kbd>R</kbd> resets both views.

The **Place** menu jumps to named parameters: the basilica, Douady's rabbit,
the airplane, the cauliflower, San Marco, the dendrite *c* = *i*, a Siegel
disk at the golden-mean angle, and two valleys just outside the set. The
period stated for each one is checked by the test suite.

**Copy share link** puts the whole state in the URL hash (the chosen *c*, both
views, iterations, colours). **Save PNG** writes either picture at the
canvas's full resolution once it has finished refining.

## Code layout

| File | Contents |
| --- | --- |
| `src/dynamics.js` | escape time, smooth count, distance estimate, periodicity check, orbits |
| `src/cycle.js` | attracting cycle and multiplier of the critical orbit; component centres by Newton's method |
| `src/bulbs.js` | the p/q bulbs of the main cardioid: roots, normals, checked centres |
| `src/basin.js` | the phase of a starting point in the attracting basin |
| `src/view.js` | pixel &harr; plane mapping, zoom about a point, pan, precision limit, iteration budget |
| `src/palette.js` | cyclic gradients and period colours |
| `src/render.js` | sample to colour, row-range rendering into an RGBA buffer |
| `src/places.js` | named parameters with their periods |
| `src/settings.js` | page state and the share-link format |
| `src/main.js` | the page |

## License

MIT. See [LICENSE](LICENSE).
