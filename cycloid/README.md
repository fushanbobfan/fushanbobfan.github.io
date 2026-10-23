# cycloid

The brachistochrone race in the browser. Beads start together at A and slide
without friction to B along a straight ramp, a circular arc, a parabola, the
cycloid, and any track you draw. The cycloid arrives first every time.

**Live demo:** https://fushanbobfan.github.io/cycloid/

No build step and no dependencies. The motion, the curves and the stage
geometry are plain ES modules covered by a Node test suite; only `src/main.js`
touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The problem

Johann Bernoulli posed it in 1696: of all the tracks from A down to a lower
point B, which one carries a bead from rest to B in the least time? The
straight line is the shortest, but the bead starts slowly on it. A track that
drops steeply first builds speed early and spends it covering ground. The best
trade-off is an arc of a cycloid, the curve traced by a point on the rim of a
rolling wheel, turned upside down so its cusp sits at A.

With the default B, 2.6 m across and 1.3 m down, the race comes out as:

| Track | Time |
| --- | --- |
| Cycloid | 0.918 s |
| Parabola | 0.940 s |
| Circular arc | 0.947 s |
| Straight ramp | 1.151 s |

When B is more than &pi;/2 times as far across as it is down, the cycloid
dips below B and climbs back up to it: going lower than the target is still
the quickest way there. The note under the results says how far it dips.

## The tracks

| Track | Shape |
| --- | --- |
| Cycloid | x = r(t &minus; sin t), y = r(1 &minus; cos t) through B |
| Circular arc | the circle through A and B that leaves A straight down (the arc beats the chord, as Galileo noticed) |
| Parabola | x = b<sub>x</sub>(y / b<sub>y</sub>)&sup2;, also vertical at A |
| Straight ramp | the chord AB |
| My track | A, then the stroke you draw, then B |

Drag B (or focus the track and use the arrow keys, with shift for small
steps) and every track is rebuilt through it. Drawing anywhere else lays a new
track of your own; a track that climbs above A somewhere cannot be finished,
and its bead slides back and forth forever.

## How it is computed

- **Exact times on polylines.** Every track is a polyline. On a straight piece
  the acceleration along the track is constant, and energy conservation gives
  the speed at each end, v = &radic;(2*gh*) with *h* the drop below A. A piece of
  length *L* with end speeds v&#8321; and v&#8322; therefore takes exactly
  2*L* / (v&#8321; + v&#8322;), with no time stepping and no accumulated error.
- **The cycloid through B.** The ratio x/y = (t &minus; sin t)/(1 &minus; cos t)
  increases from 0 to infinity as *t* runs over (0, 2&pi;), so bisection finds
  the end parameter &theta; and then r. On the cycloid the parameter advances at
  the steady rate &radic;(g/r), so the descent takes &theta;&radic;(r/g); the
  readout shows this value and the tests check the 400-piece polyline against
  it.
- **Turning back.** If a track rises above A, the bead stops where it regains
  A's height. Frictionless motion is reversible, so it retraces its path and
  the motion repeats with twice that time as its period.
- **Playback.** The race clock is the real physical time; the playback menu
  only slows the animation down.

## Controls

| Action | Effect |
| --- | --- |
| Drag B, or arrow keys with the track focused | move the finish |
| Drag anywhere else | draw your own track |
| <kbd>Space</kbd> or **Release** | start the race |
| <kbd>R</kbd> or **Reset** | put the beads back at A |
| <kbd>C</kbd> or **Clear my track** | remove your track |

## Code layout

| File | Contents |
| --- | --- |
| `src/motion.js` | arrival times along a polyline, position at any time, turning back |
| `src/curves.js` | the cycloid through B and its exact time, the arc, the parabola, the ramp |
| `src/scene.js` | the stage in metres, the canvas mapping, limits for B, strokes into tracks |
| `src/main.js` | the page |

## License

MIT. See [LICENSE](LICENSE).
