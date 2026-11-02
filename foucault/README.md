# foucault

A Foucault pendulum in the browser. Pick a place, draw the bob aside and let
it go: the floor turns under the swing, the track in the sand fans out, and a
ring of pins falls one by one as the swing reaches them.

**Live demo:** https://fushanbobfan.github.io/foucault/

No build step and no dependencies. The model is a plain ES module covered by a
Node test suite; only `src/main.js` and `src/view.js` touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The model

The bob swings a small distance over the floor (x east, y north). Gravity
pulls it back with ω0² = g / L, and the Earth's spin Ω enters through its
vertical component at latitude φ, Ωz = Ω sin φ, as a Coriolis force:

    x'' =  2 Ωz y' − ω0² x
    y'' = −2 Ωz x' − ω0² y

Writing z = x + i y and w = e^{iΩz t} z turns this into w'' + ω² w = 0 with
ω² = ω0² + Ωz². In a frame turning at −Ωz the swing is a fixed ellipse; seen
from the floor that ellipse turns clockwise in the north and anticlockwise in
the south, once every sidereal day / |sin φ|. The page uses this closed form,
so it stays exact at any playback speed, and the tests check it against a
direct Runge–Kutta integration.

Some numbers it gives:

| Place | Latitude | Plane turns | Full turn |
| --- | --- | --- | --- |
| Pole | 90° | 15.04° an hour | 23.9 h |
| Panthéon, Paris | 48.8° N | 11.33° an hour | 31.8 h |
| Los Angeles | 34.1° N | 8.44° an hour | 42.7 h |
| Equator | 0° | not at all | never |

The Panthéon wire is 67 m, which gives a swing of 16.4 s there and back and
about 6,970 swings for one full turn of the plane.

**Two ways to set it going.** Drawn aside and let go from rest, the bob comes
to rest again at every end of its swing, on the rim, so the track is a
rosette of sharp points. Pushed from the centre, it passes back through the
centre every half swing and the track is a fan of loops through the middle.
Both show at "100 times faster", where one turn takes 70 swings.

**The pins.** 36 pins stand on a circle just inside the reach of the swing,
set half a step either side of the starting line. A pin falls once the line
of the swing passes within the bob's reach of it, so pins fall in opposite
pairs, a pair for every 10° the plane turns, and the page reports how long until the next one.

**Two views.** From the floor, as a visitor stands, the swing turns. In a
frame turning with Ωz the floor turns under a swing that keeps its line.
At a pole that frame is fixed to the stars; elsewhere it turns more slowly,
and only the vertical part of the Earth's spin acts on a swing over the floor.

What the model leaves out: the swing is small, so the bob stays in a plane;
the centrifugal force is folded into local gravity; there is no air drag
(real pendulums are given a small push each swing to keep going).

## Why sin φ

Over one day the Earth carries the pendulum once around its parallel. The
cone that touches the globe all along that parallel has its tip on the polar
axis at R / sin φ from the centre, and it can be cut and laid flat without
stretching. On the flat sheet a swing that is never twisted keeps one
direction, while the local north always points along the cone to its tip.
The sheet is a sector of 360° × sin φ (its arc, slant × angle, is the length
of the parallel), so after a full trip north has turned that far past the
swing. At the pole the sheet is a whole disc and the turn is a full 360°; at
30° it is a half disc and the turn is 180°; at the equator the cone becomes a
cylinder that unrolls into a strip, and the swing never turns.

The section under the floor draws the globe with its cone and the sheet laid
flat, and follows the running pendulum around the parallel. In the south the
cone's tip lies below the south pole and the turn goes the other way.

## What the tests check

- the plane turns once a sidereal day at either pole and never at the
  equator; in Paris a full turn takes about 31.8 h at about 11.3° an hour,
- a 67 m wire swings in about 16.4 s,
- the closed form matches a Runge–Kutta integration of the equations to 10⁻⁶
  over 32 swings, starts where it was released, and keeps its energy,
- released from rest, every turning point lies on the rim, at rest, on the
  current plane, and the plane is east–west a quarter turn later,
- the plane turns clockwise in the north and anticlockwise in the south, and
  pushed from the centre the bob returns to the centre every half swing,
- a release in any direction starts the swing on that line,
- pins knocked over by the simulated swing fall at the predicted times,
  clockwise around the ring in the north, in opposite pairs,
- the cone grazes the globe along the parallel (its edge is square to the
  radius there), and laid flat the parallel keeps its length,
- the sheet is a full disc at the pole, a half disc at 30° and a strip at the
  equator, and the angle north turns past the swing on it over a day equals
  the pendulum's turn over a sidereal day at every latitude tried.

## Controls

| Control | Effect |
| --- | --- |
| Where, Latitude | choose a place; ← → on the floor move the latitude by 1° (Shift 10°) |
| Wire length | 2 to 100 m |
| Set going | drawn aside and let go, or pushed from the centre |
| Earth spins | as it does, or 10, 100 or 1000 times faster |
| Play at | real time up to ×5000 |
| Release (<kbd>Space</kbd>) | start again with a fresh floor and a standing ring of pins |
| Pause (<kbd>P</kbd>) | stop and resume |
| Click the floor | draw the bob aside towards that point and release it |
| Watch from | the floor, or a frame turning with the swing |
| Track in the sand, Ring of pins | show or hide them |

## Layout

```
index.html        page and controls
style.css
src/pendulum.js   the model: spin at a latitude, the closed-form swing, its plane
src/pins.js       the ring of pins, knocking them over, when each should fall
src/format.js     durations, hours and latitudes for the readouts
src/cone.js       the tangent cone along the parallel, and the sheet laid flat
src/cone-view.js  drawing the globe with its cone, and the sheet
src/view.js       drawing the floor, the sand track, the pins and the bob
src/main.js       animation and interaction
test/             node --test suite
scripts/serve.js  static server for local use
```

## License

MIT
