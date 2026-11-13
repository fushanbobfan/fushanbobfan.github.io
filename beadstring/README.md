# beadstring

A string of beads in the browser. Pluck it, watch the motion split into
normal modes, and see how the beads bend the overtones away from the whole
multiples a smooth string would give.

**Live demo:** https://fushanbobfan.github.io/beadstring/

No build step and no dependencies. The physics lives in plain ES modules
covered by a Node test suite; only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **The string.** Up to 48 beads between two walls. Drag any bead to pluck:
  either the whole string is pulled into a corner at that bead, or that bead
  alone moves. Release and it swings. Or strike: click a bead and it is
  knocked sideways from rest, faster the farther from the line you click.
- **Along the string, over time.** Each row is the string at one moment,
  orange above the line and blue below, newest at the bottom. The strip spans
  60 time units, enough to watch a pulse cross the string, flip over at a wall
  and come back.
- **Energy in each mode.** One bar per normal mode. Without damping the bars
  never change, however tangled the motion. Click a bar to play that mode
  alone, or shift-click to add it to what is already moving.
- **Frequency of each mode.** Dots for the beaded string, a dashed line for a
  smooth string of the same length and weight. The dots follow the line for
  long waves and level off as the waves shrink toward the bead spacing: below
  twice the coupling *c*, or below √(a² + 4c²) with an anchor *a*.
- **Anchors.** An optional spring on every bead turns the string into a row of
  pendulums joined by springs. Every frequency is lifted to at least the
  anchor frequency, and waves of different lengths travel at very different
  speeds.
- **Listen.** Each mode becomes a sine tone at a level set by its amplitude.
  The lowest mode sounds at G3 (196 Hz) and the others at their true
  frequency ratios; a second switch retunes them to whole multiples, the
  overtones of a smooth string. With few beads the difference is plain: with
  four, the first overtone is 87 cents, almost a semitone, flat of the octave. A paused or
  held string is silent, and a damped one fades.
- **Readout.** The lowest frequency and its period, the first overtones as
  multiples of it beside what a smooth string would give, the highest
  frequency, the total energy, and for two beads the beat period.

## Starting setups

| Setup | What to look for |
| --- | --- |
| The fundamental | One arch, every bead in step. |
| Plucked in the middle | Only odd-numbered modes carry energy; the even ones are lopsided and a centred pluck cannot reach them. |
| Plucked near the end | Many overtones; the corner runs back and forth. |
| Struck near the end | The same spot hit from rest: the bars form an even comb and the upper half of the modes holds half the energy, against about 6% for the pluck. |
| Neighbours opposed | The highest mode, just under twice the coupling. |
| A pulse and its echo | A bump splits in two; each half comes back upside down from a wall. |
| A pulse on a row of pendulums | The same bump with anchors: most of it rings in place and leaks away as ripples. |
| Two coupled pendulums | The swing passes from one pendulum to the other and back every 45 time units. |
| Fading out | Every mode loses energy at the same average rate; the energy halves about every 14 time units. |

## The model

Bead *j* obeys

y<sub>j</sub>″ = c² (y<sub>j−1</sub> − 2 y<sub>j</sub> + y<sub>j+1</sub>) − a² y<sub>j</sub> − γ y<sub>j</sub>′

with the walls fixed at zero; *c* is the coupling, *a* the anchor and *γ* the
damping. The normal modes are sine shapes, and mode *k* of *n* beads swings at

ω<sub>k</sub> = √(a² + 4c² sin²(kπ / 2(n+1))).

## Numerics

There is no time-stepping error to tune. The shape is projected onto the
normal modes, and each mode is advanced with the closed-form solution of a
damped oscillator (underdamped, critically damped or overdamped as needed).
The tests check this against a direct fourth-order Runge–Kutta integration of
the bead equations, check that energy is conserved to 10⁻¹⁰ over 5,000 steps
without damping, and check the facts quoted in the setups: odd modes only for
a centred pluck, the energy swap between two pendulums, the halving time
under damping and how much of a pulse stays put on the pendulums.

## Keyboard

Space pauses and resumes; **r** restarts the current setup. Every pluck and
every mode can also be started from the number fields without a pointer. With
reduced motion requested, the page starts paused and draws the strip's first
60 time units at once.

## License

MIT
