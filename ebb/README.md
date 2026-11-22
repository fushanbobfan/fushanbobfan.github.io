# ebb

Why the sea rises twice a day. The Moon pulls the side of the Earth facing it
a little harder than the centre, and the centre a little harder than the far
side. Take away the pull on the centre, which only keeps the Earth and the
Moon going round each other, and the leftover stretches the oceans along the
line to the Moon: one bulge under it and one on the far side.

**Live demo:** https://fushanbobfan.github.io/ebb/

No build step and no dependencies. The physics, the drawing and the readouts
are plain ES modules covered by a Node test suite; only `src/main.js` touches
the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **The Earth from above the North Pole**, with arrows at points on its
  surface and inside it. Switch them between the Moon's full pull, which
  looks the same everywhere (with the Sun added, the arrows show the Moon's
  and the Sun's pull together), and the pull minus the pull on the centre, which
  points out at both ends of the line to the Moon and inward round the middle.
- **The ocean** drawn as the equilibrium tide, rescaled for each picture so its
  shape shows. The page says how many times higher than life it is drawn
  (about 3.6 million for the Moon at its average distance).
- **The Moon**: drag it round, or move it between its nearest and farthest
  distance (or anywhere from 20 to 120 Earth radii) and watch the tide grow
  with the inverse cube of the distance.
- **The Sun**: add it and turn it. In line with the Moon (new or full moon)
  the two tides add to a spring tide; at right angles (quarter moons) they
  partly cancel to a neap tide.
- **Two months of tides** with the real Moon and Sun: the equilibrium tide at
  a point on the equator under Greenwich, two high waters a day, under a strip
  of new and full moons, perigees and apogees. Shaded bands are perigean
  spring tides, a new or full moon within a day and a half of perigee (the
  "king tides" of tide tables). Click a moment to put that day's Moon and Sun
  into the picture.

## The numbers

The equilibrium tide of a body of mass *M* at distance *d* on an Earth of
mass *Mₑ* and radius *R* stands at

    h(z) = (M / Mₑ) · R⁴ / d³ · (3 cos² z − 1) / 2

above the mean, where *z* is the angle from the point under the body. For the
Moon at its average distance that is 36 cm under it and opposite, 18 cm down
at the sides, 53 cm from low to high water. The Sun's comes to 46% of
that, so spring tides reach about 78 cm and neap tides about 29 cm. The tidal
acceleration under the Moon is close to 2GMR/d³ ≈ 1.1 × 10⁻⁶ m/s², and the
page computes it exactly as the difference of the two pulls.

These are the forcing on an ocean covering a rigid Earth. Real tides are
shaped by the continents, the depth of each ocean basin and its resonances,
so the range at a harbour can be anything from almost nothing to more than
ten metres.

The positions of the Moon and the Sun come from the truncated series in
Meeus, *Astronomical Algorithms* (chapters 25 and 47). Every new and full moon
of 2026 falls within 3 minutes of Fred Espenak's published phase table, and
every perigee within 20 minutes and 40 km of his perigee table; the tests check
them all. The chart treats the Moon and the Sun as if they sat on
the equator; their real declination is what makes the two daily tides unequal
away from the equator.

## Layout

- `src/tides.js`: pulls, tidal pulls and equilibrium tide heights
- `src/field.js`: the SVG picture
- `src/readout.js`: the numbers beside it
- `src/ephemeris.js`, `src/time.js`: Sun and Moon positions, calendar dates
- `src/month.js`: phases, perigees, apogees and perigean spring tides
- `src/monthchart.js`: the two-month chart
- `src/main.js`: controls and dragging
- `test/`: Node tests for the physics and the drawing

## License

MIT
