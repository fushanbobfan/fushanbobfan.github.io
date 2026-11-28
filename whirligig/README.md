# whirligig

Why a spinning top does not fall. A tilted top that is not spinning topples
straight over. Spin it, and gravity's pull swings the axle sideways, so it
goes round in a cone (precession). Let go of a spinning top and it does
drop a little at first; the drop is what starts it swinging, and it bobs back
up again and again while it goes round (nutation). This page works the motion
out from the equations of a spinning rigid body and shows the top, the path of
its axle seen from above, and the energy picture that explains why the tilt
cannot grow without limit.

**Live demo:** https://fushanbobfan.github.io/whirligig/

No build step and no dependencies. The physics and the wording are plain ES
modules covered by a Node test suite; only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **Controls** for the spin (300 to 5,000 rpm), the tilt when the top is let
  go (2° to 50°) and a sideways push at that moment, measured against the rate
  of steady precession at that tilt. Seven starting points cover the three
  shapes, the steady cone, a top spun too slowly, and a nearly upright top
  spun above and below the rate it needs to stand.
- **Playback** from real time down to 50 times slower. At 2,000 rpm the top
  nods about seven times a second, too fast to follow by eye at full speed.
- **The top** on a table, with two painted stripes that turn with the spin and
  the path drawn by the end of its handle.
- **The axle seen from above**, with tilt as distance from the centre, the
  band the axle nods across and the tilt at which the rim meets the table.
- **Readouts**: the shape the axle draws, the two ends of the nod, how long one
  nod and one turn round take, the fast-top estimate of the turn, the two
  steady-cone rates at this tilt, and the spin needed to stand upright.
- **The energy curve**: the energy the nodding needs at each tilt against the
  energy the top has. The top can only lean where the curve lies below it.

## The model

- A thin disc of 100 g and 3 cm radius sits 4 cm up a weightless stalk. Its
  moment of inertia about the axle is I3 = ½ m r² and about a horizontal line
  through the tip I1 = ¼ m r² + m l². The tip stays put and does not slide.
- The motion is written in Euler angles: tilt θ from the vertical, the
  direction φ the axle leans towards, and the turn ψ about the axle. The spin
  ω3 about the axle and the angular momentum about the vertical stay fixed,
  which leaves one equation for θ,

  I1 θ'' = I1 φ'² sin θ cos θ − I3 ω3 φ' sin θ + m g l sin θ,

  with φ' fixed by the second conserved quantity. It is stepped with
  fourth-order Runge–Kutta, a few hundred steps per nod.
- With u = cos θ, energy conservation gives u'² = f(u), a cubic. Its two roots
  between −1 and 1 are the ends of the nod; the band between them is where
  the effective potential lies below the energy. They are found by bisection.
- The shape follows from the sign of the precession rate φ' at the two ends:
  the same sign gives waves, zero at one end gives cusps (always the case when
  the top is let go without a push), opposite signs give loops.
- One nod's period and the turn in φ it carries are integrals of 1/√f(u),
  taken after the substitution u = m + h sin s that removes the square-root
  singularities at the ends. Their ratio is the mean precession rate.
- Steady precession at a fixed tilt solves I1 cos θ Ω² − I3 ω3 Ω + m g l = 0;
  the push slider is measured against the slower root. Below
  ω3 = 2 √(I1 m g l cos θ) / I3 neither root exists, and the push is then
  measured against m g l / (I3 ω3).
- The top can stand straight up only with ω3 > 2 √(I1 m g l) / I3, about
  1,136 rpm for this top.
- The rim of the disc touches the table at θ = atan(l / r), about 53°. If the
  nod would reach that far, the run stops there and says when.

## Tests

- Energy stays constant to 1 part in 10¹⁰ over 3 s.
- The Euler-angle motion agrees with a separate integration of the same body
  as vectors (angular momentum and axle direction) to 1e-7 rad in tilt and
  1e-6 rad in direction over 2 s.
- The two turning points match the extremes the simulation reaches, and the
  effective potential equals the energy at both.
- Released at either steady rate, the tilt stays within 1e-6 rad.
- The nod period and the turn per nod match the simulation over many nods to
  1 part in 10⁵.
- A fast top follows the textbook estimates: precession m g l / (I3 ω3), nod
  rate I3 ω3 / I1 and, let go from rest, a drop of 2 I1 m g l sin θ / (I3 ω3)².
- Each preset produces the motion its name promises, and the wording, the
  camera, the map and the energy curve are checked separately.

## What it leaves out

Friction at the tip and in the air, so the spin never dies away; a tip that
slides or rolls, which is what makes a real top rise towards upright; the
stalk's own mass; and the floor pushing back once the rim touches.

## Files

- `src/top.js` the top, its equations of motion, the turning points, the nod
  and the steady rates
- `src/draw.js` the three pictures
- `src/readout.js` labels and the sentence under the controls
- `src/main.js` the page

## Licence

MIT. See [LICENSE](LICENSE).
