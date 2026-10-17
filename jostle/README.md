# jostle

A hard-disk gas in the browser. A few hundred disks fly in straight lines and
bounce off each other and the walls with perfectly elastic collisions. Start
them all at the same speed and watch the speed histogram spread into the
Maxwell–Boltzmann curve, Boltzmann's H fall to its floor, and the pressure on
the walls settle where the hard-disk equation of state says it should.

**Live demo:** https://fushanbobfan.github.io/jostle/

No build step and no dependencies. The gas, the collision dynamics, the
measurements, the chart geometry and the share-link format are plain ES
modules covered by a Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What you are looking at

**The box.** Disks are coloured from blue (slow) through grey to orange
(fast), scaled by the most probable speed. "Trace one disk" draws the zigzag
path of a single disk, a random walk made of straight flights. "By starting
half" colours disks by the side of the box they began in, so you can watch
the two halves mix.

**Speeds.** The bars are the measured speed distribution, averaged over the
last few frames and drawn as a density. The curve is the two-dimensional
Maxwell–Boltzmann distribution for the same mass and temperature,

    f(v) = (m v / kT) exp(-m v² / 2kT).

The KS distance is the largest gap between the measured and the Maxwell
cumulative distributions. For 400 disks, values below about 0.08 are what a
true Maxwell sample gives 99% of the time.

**Boltzmann's H.** H = Σ p ln(p / Δv) over the speed bins. Boltzmann showed
that collisions can only lower it until the distribution is Maxwellian. The
dashed line is H for the exact Maxwell distribution binned the same way. The
chart keeps the whole run by thinning old points rather than scrolling them
away, so the early fall stays visible.

**Pressure.** The walls count the momentum every bounce delivers. Dividing by
the perimeter and the elapsed time gives the pressure, shown as
Z = PA / NkT. An ideal gas of points has Z = 1; disks take up room, so Z
rises as the box fills. The comparison value is Henderson's equation of state
for hard disks,

    Z = (1 + η² / 8) / (1 - η)²,

where η is the fraction of the box covered by disks.

**Energy drift.** Every collision conserves kinetic energy exactly, so the
total only moves by floating-point rounding.

## Starts

| Start | What happens |
| --- | --- |
| All at one speed | The histogram begins as a single spike and spreads into the Maxwell curve within a few collision times. |
| Already Maxwellian | Equilibrium from the first frame: the curve fits and H sits on its floor, with fluctuations. |
| Hot left, cold right | The left half starts four times hotter. Colour by starting half to watch them diffuse into each other. |

## How the dynamics work

Each step moves every disk in a straight line for a time `dt` small enough
that the fastest disk travels a quarter of a radius. Disks past a wall are
reflected. Overlapping pairs are found through a cell grid; a pair that is
still approaching is wound back to the moment the two disks touched, given
the elastic impulse along the line of centres, and carried forward again. The
impulse is the textbook one for unequal masses, so momentum and energy are
conserved by every collision.

This is a time-stepped approximation to the exact event-driven method: a disk
that collides twice in one step has its second collision resolved slightly
late. With the step size used here the measured pressure matches Henderson's
equation within a few per cent from η ≈ 0.13 to η ≈ 0.63:

| Disks | Radius | η | Z measured | Z Henderson |
| ---: | ---: | ---: | ---: | ---: |
| 400 | 1.0 | 0.126 | 1.34 | 1.31 |
| 400 | 1.5 | 0.283 | 2.04 | 1.96 |
| 600 | 1.5 | 0.424 | 3.21 | 3.08 |
| 500 | 2.0 | 0.628 | 7.69 | 7.60 |

(Seed 21, 1500 steps to relax, then pressure averaged over 3000 steps.)

## Controls

| Key | Action |
| --- | --- |
| Space | Pause or play |
| S | Step one frame |
| R | Restart with the same seed |
| N | Restart with a new seed |

Every setting is written to the URL hash, so "Copy share link" reproduces the
same gas, seed included. "Save PNG" saves the box as it is now.

## Code layout

| File | Role |
| --- | --- |
| `src/rng.js` | Seeded uniform and normal random numbers |
| `src/gas.js` | Disk arrays, placement without overlap, starting velocities, energy and temperature |
| `src/physics.js` | Wall bounces, elastic pair collisions and the stepping loop |
| `src/stats.js` | Maxwell curves, histograms, H, KS distance, pressure and Henderson's equation |
| `src/render.js` | Colours, chart geometry and canvas drawing |
| `src/settings.js` | Defaults, clamping and the share-link format |
| `src/main.js` | Page wiring: animation loop, controls and readouts |

## References

- J. C. Maxwell, "Illustrations of the dynamical theory of gases", *Philosophical Magazine* 19 (1860) 19–32.
- L. Boltzmann, "Weitere Studien über das Wärmegleichgewicht unter Gasmolekülen", *Wiener Berichte* 66 (1872) 275–370.
- D. Henderson, "A simple equation of state for hard discs", *Molecular Physics* 30 (1975) 971–972.
- B. J. Alder and T. E. Wainwright, "Studies in molecular dynamics. I. General method", *Journal of Chemical Physics* 31 (1959) 459–466.

## License

MIT
