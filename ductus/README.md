# ductus

Bézier curves in the browser. Drag the control points, slide *t*, and watch de
Casteljau's construction find the point on the curve: in-between points on
every leg of the polygon, then in-between points of those, until one is left.

**Live demo:** https://fushanbobfan.github.io/ductus/

No build step and no dependencies. The geometry lives in plain ES modules
covered by a Node test suite; only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **The construction at *t*.** Each coloured level is one round of linear
  interpolation. The last segment is tangent to the curve, and its length
  times the degree is the speed of the moving point. **Play** sweeps *t*.
- **The curvature comb.** Teeth stand on the curve at right angles to it,
  outside each turn, with lengths proportional to the curvature. They swap
  sides at an inflection and grow long near a cusp.
- **The two halves at *t*.** The outer edges of the construction are the
  control polygons of the curve before and after *t*; this is how a curve is
  cut without changing its shape.
- **Steps of *t* and of length.** Dots at t = 0, 0.1, …, 1 and bars that cut
  the curve into ten pieces of equal length show where the point moves slowly
  and where fast. **Play at constant speed** sweeps length instead of *t*: a
  table of cumulative lengths gives a first guess for each *t* and a few
  Newton steps on the speed refine it. The readout gives the share of the
  length covered up to *t*.
- **Weights.** Each control point has a weight (0.25 to 4, on a log scale).
  The construction then runs on (x·w, y·w, w) and divides by the last
  coordinate, giving a rational Bézier curve. A quadratic is a parabola, an
  ellipse or a hyperbola arc as its middle weight is 1, below 1 or above, and
  **Make a circular arc** evens its legs and sets the weight that makes it an
  exact circle. Heavier points are drawn larger.
- **Raise the degree** adds a control point and leaves the curve exactly as it
  was. **Add a point** changes it. Double-click a point, or focus it and press
  Delete, to remove it. Points move with the arrow keys (Shift for larger steps).

Starting curves: a cubic arch, a parabola, an S bend, a loop, a near-cusp, an
exact quarter circle, a weighted cubic and a degree-six curve.

## Layout

| File | Role |
| --- | --- |
| `src/bezier.js` | de Casteljau levels, evaluation, splitting, derivatives, curvature, degree elevation, arc length and the parameter at a given share of the length, for polynomial and rational curves |
| `src/scenes.js` | Starting curves, point and weight editing, snapping to a circular arc |
| `src/main.js` | Canvas drawing, dragging, keyboard and controls |

Arc length uses five-point Gauss–Legendre quadrature on equal pieces of the
parameter.

## License

MIT
