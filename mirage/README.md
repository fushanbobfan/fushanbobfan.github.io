# mirage

Why a hot road looks wet. The asphalt heats a thin layer of air above it, and
light travels slightly faster through hot air than through cool air. A ray
heading for the road at a shallow angle curves back up through that layer and
reaches the eye from below, so the road far ahead shows a piece of the sky,
and anything standing in it hangs upside down underneath itself.

**Live demo:** https://fushanbobfan.github.io/mirage/

No build step and no dependencies. The air, the ray tracer and the picture are
plain ES modules covered by a Node test suite; only `src/main.js` touches the
page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **Controls** for the road surface and air temperatures, the thickness of the
  heated layer, the height of the eye and the distance to a striped board
  standing on the road, with four starting points: a summer road, a desert
  flat, crouching on the road and an overcast morning.
- **The view down the road** through a long lens, about half a degree tall.
  Every row of the picture is one traced ray, so the shine, the upside-down
  copies of the board and of the trees on the horizon, and the foot of the
  board that no ray reaches all come straight out of the optics.
- **The road from the side**, heights stretched many times, with a fan of rays
  from the eye coloured by what each one reaches.
- **Readouts**: the refractive index at the road and at eye level, the steepest
  angle below eye level at which a ray still turns back up, and how far ahead
  the shine starts.

## The model

- Refractive index of dry air for visible light, proportional to density:
  n - 1 = 2.93e-4 (P / 1013.25 hPa) (273.15 K / T).
- Temperature falls from the road value to the air value as
  exp(-height / layer); pressure is constant over the few metres involved.
- Rays follow dz/dx = tan(theta), dtheta/dx = n'(z) / n(z), integrated with
  fourth-order Runge-Kutta, which keeps n cos(theta) constant along each ray
  (checked by the tests). A ray aimed theta below eye level turns back before
  the road when n(road) < n(eye) cos(theta).
- The ground is flat and the air still; real mirages also shimmer, because the
  hot air above asphalt rises in plumes.

## Files

- `src/air.js` temperature and refractive index with height
- `src/rays.js` the ray tracer, the critical angle and where the shine starts
- `src/view.js` the long-lens picture, one ray per row
- `src/side.js` the side view
- `src/readout.js` labels and the description under the picture
- `src/main.js` the page

## Licence

MIT
