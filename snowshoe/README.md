# snowshoe

Predators and prey in the browser. The Lotka–Volterra equations drawn as a
phase plane of closed orbits, with the boom-and-bust time series each orbit
traces underneath.

**Live demo:** https://fushanbobfan.github.io/snowshoe/

No build step and no dependencies. The model lives in plain ES modules covered
by a Node test suite; only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **The phase plane.** Prey across, predators up. Arrows show which way each
  pair of populations moves; click anywhere to release a population there (up
  to six at once). Dashed lines are the nullclines, and they cross at the
  balance point x = m / (e a), y = r / a.
- **Over time.** The most recent orbit as two curves, prey peaking a little
  before predators, with dashed lines at the balance levels.
- **Rates.** Prey birth rate *r*, attack rate *a*, the share *e* of eaten prey
  that becomes predators, and predator death rate *m*. Moving a slider
  restarts every orbit from where it began.
- **Fishing.** Effort *f* removes the same share of prey and predators per
  unit time, which amounts to a prey birth rate of r − f and a predator death
  rate of m + f. The balance point moves to more prey and fewer predators; a
  hollow ring marks where it sits without fishing. At f ≥ r the predators die
  out.
- **Readout.** The period of small swings around the balance point
  (2π / √(r m)), the measured period of the current orbit, its averages over
  one cycle (which equal the balance point on every orbit), and the conserved
  quantity V = e a x − m ln x + a y − r ln y with its numerical drift. With
  fishing on, the predators' share of the catch over a cycle, beside its
  unfished value.

## Starting setups

| Setup | What to look for |
| --- | --- |
| Nested orbits | Five closed loops around one point; the outer ones take longer. |
| Near the balance point | A near-ellipse with the linearised period. |
| Boom and bust | Both populations spend most of the cycle near zero. |
| A ten-year cycle | Rates giving swings of about nine and a half time units, close to the hare and lynx cycle in Canadian fur records when time is read in years. |
| Long-lived predators | A slow predator death rate pins the prey near zero. |
| Fishing and the war | Lower the fishing effort to zero and the predators' share of the catch rises, the effect Volterra used to explain Adriatic fish-market records from the First World War. |

## Numerics

Orbits are stepped with classical fourth-order Runge–Kutta at dt = 0.01.
Over a large orbit the relative drift in *V* stays below 10⁻⁵ (tested), so the
loops close on screen. Periods come from the last two prey peaks, located to
sub-sample accuracy with a parabola through each peak and its neighbours.

## Keyboard

Space pauses and resumes; **c** clears the orbits. Every orbit can also be
released from the number fields without a pointer. With reduced motion
requested, the page draws a few finished loops and starts paused.

## License

MIT
