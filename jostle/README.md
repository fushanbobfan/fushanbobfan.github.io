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

**Brownian motion.** Tick "Heavy tracer" to put one large, heavy disk in the
middle of the box. It is pushed about by the small disks the way a pollen
grain is pushed about by water molecules. The chart plots its mean squared
displacement against the lag τ on log-log axes, averaged over every starting
point in the last 2000 time units of its path. Two regimes show up as two
slopes:

- at short lags the tracer still moves in a straight line at thermal speed,
  so MSD = (2kT / M) τ², the dashed line;
- once it has forgotten its velocity it random-walks, MSD = 4Dτ, and the
  solid line is a least-squares fit of 4Dτ + b over the lags past that point.

The fit starts at the first lag where the measured MSD has fallen below 30%
of the free-flight line. Heavier tracers remember their velocity longer, so
the bend moves right as the mass goes up. Lags are capped at 300 time units,
beyond which the walls start to hold the tracer in. D comes from one tracer,
so it is noisy: four runs of the default tracer (mass 25, radius 5) gave
values between 0.34 and 1.14.

**Effusion.** Tick "Partition" to put a wall down the middle with a hole in
it and start the whole gas on the left. "Heavy share" makes some of the disks
heavier by the mass ratio; "Load the effusion demo" sets up a dilute
half-and-half mixture with a 4 : 1 mass ratio and colours disks by species.
For a dilute gas the number of disks crossing a gap of width w per unit time
is

    rate = n w √(kT / 2πm),

the one-dimensional Maxwell flux, with n the number per unit area on the near
side. At the same temperature light disks are faster, so they leak through
first and the light-to-heavy ratio of rates per unit density is √(M / m):
Graham's law. The chart shows the share of each species that has reached the
right, and the readouts give each measured rate as a multiple of its
theoretical value, pooling both directions and integrating the density on
each side over time so the comparison stays fair as the left side empties.
The gap counts only the width a disk's centre can pass, w = hole − 2r.

The formula assumes disks cross the hole without meeting each other on the
way, which needs a mean free path λ = 1 / (√2 n d) well above the hole. The
readout shows both. With a denser gas the hole stops being a pinhole, the gas
flows through and leaks faster than the formula. Three seeds at two densities,
run for 1500 time units with an 8-unit hole and a 4 : 1 mixture:

| Disks | Radius | Seed | Light / theory | Heavy / theory | Light : heavy |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 0.5 | 31 | 1.05 | 1.15 | 1.83 |
| 300 | 0.5 | 32 | 1.14 | 1.21 | 1.88 |
| 300 | 0.5 | 33 | 1.23 | 0.94 | 2.61 |
| 400 | 1.2 | 31 | 1.10 | 1.64 | 1.35 |
| 400 | 1.2 | 32 | 1.31 | 1.52 | 1.72 |
| 400 | 1.2 | 33 | 1.28 | 1.40 | 1.82 |

Graham's law predicts 2. A few hundred crossings per run leave a spread of
roughly ±10% on each rate, and the dilute runs sit a little above the formula
as well; the denser runs leak faster still.

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

With the partition on, the gas starts packed into the left half whatever the
start.

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
| `src/gas.js` | Disk arrays, placement without overlap (around a tracer if there is one), starting velocities, energy and temperature |
| `src/physics.js` | Wall and partition bounces, elastic pair collisions and the stepping loop |
| `src/stats.js` | Maxwell curves, histograms, H, KS distance, pressure and Henderson's equation |
| `src/effusion.js` | Crossing counts per species, density exposure, Maxwell flux, Graham's law and the mean free path |
| `src/diffusion.js` | Tracer path record, mean squared displacement, onset of diffusion and the fit for D |
| `src/render.js` | Colours, chart geometry and canvas drawing |
| `src/settings.js` | Defaults, clamping and the share-link format |
| `src/main.js` | Page wiring: animation loop, controls and readouts |

## References

- J. C. Maxwell, "Illustrations of the dynamical theory of gases", *Philosophical Magazine* 19 (1860) 19–32.
- L. Boltzmann, "Weitere Studien über das Wärmegleichgewicht unter Gasmolekülen", *Wiener Berichte* 66 (1872) 275–370.
- D. Henderson, "A simple equation of state for hard discs", *Molecular Physics* 30 (1975) 971–972.
- A. Einstein, "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen", *Annalen der Physik* 17 (1905) 549–560.
- T. Graham, "On the motion of gases", *Philosophical Transactions of the Royal Society of London* 136 (1846) 573–631.
- B. J. Alder and T. E. Wainwright, "Studies in molecular dynamics. I. General method", *Journal of Chemical Physics* 31 (1959) 459–466.

## License

MIT
