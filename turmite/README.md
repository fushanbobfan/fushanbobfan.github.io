# turmite

Langton's ant and its relatives in the browser. An ant sits on a grid of
coloured cells. At each step it reads the colour under it, turns left or
right as the rule says for that colour, repaints the cell with the next
colour and steps forward. That is the whole program, and it still produces
ten thousand steps of chaos followed by a perfectly regular highway. The
ants also live on hexagons, where they turn by sixths of a turn, and as
full turmites: two-dimensional Turing machines that carry an internal state.

**Live demo:** https://fushanbobfan.github.io/turmite/

No build step and no dependencies. The rules, the grid, the ants, the
pattern detector, the renderer and the share links are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).

## Rules

A rule is one letter per colour: `L` turn left, `R` turn right, `N` go
straight on, `U` turn around. With `RL`, an ant on colour 0 turns right and
paints the cell colour 1; on colour 1 it turns left and paints it back to
colour 0. That is Langton's ant. Longer rules cycle through more colours:
with `LLRR`, colour 3 goes back to colour 0.

| Start from | Rule | What happens |
| --- | --- | --- |
| Langton's ant | `RL` | About ten thousand steps of chaos, then at step 9977 a diagonal highway that repeats every 104 steps |
| Chaotic blob | `RLR` | A ragged blob; no highway in two million steps |
| Mirror symmetry | `LLRR` | Whenever the ant is back on its first cell facing up, the pattern is an exact mirror image |
| Filled square | `LRRRRRLLR` | A solid square that keeps growing |
| Growing triangle | `RRLLLRLLLRRR` | A filled triangle that grows and slides away from the start |
| Convoluted highway | `LLRRRLRLRLLR` | About thirty thousand steps of wandering, then a straight highway with period 1968 |
| Going in circles | `RR` | Four cells, forever |

### On hexagons

The hexagonal grid has six directions, so a rule is one token per colour:
`L1` and `R1` turn 60° left or right, `L2` and `R2` turn 120°, `N` goes
straight on and `U` turns around.

| Start from | Rule | What happens |
| --- | --- | --- |
| Langton's ant on hexagons | `L1R1` | No highway in three million steps; every time the ant is home it faces east and the pattern is an exact mirror image |
| Narrow track | `L2R2` | A straight track two cells wide from the first steps, period 8 |
| Lapping the rim | `L1L2NUL2L1R2` | From step 101,404 the ant laps the rim of its own hexagon, every edge the same 698-step pattern turned 60° |
| Hexagonal mirror | `L1L1R1R1` | The same homecoming mirror symmetry as `L1R1` |

### State machines

A turmite proper also has an internal state. For each state and each colour
under it, the rule gives a triple: the colour to paint, the turn, and the
next state. Turns are coded 1 straight on, 2 right, 4 U-turn, 8 left. Type
a machine into the rule box on the square grid, either with braces, one
group per state:

```
{{{1,8,1},{1,8,1}},{{1,2,1},{0,1,0}}}
```

or as the same digits run together, `181181121010`. With digits the lab
takes the fewest colours (at least two) that every triple fits. Langton's
ant is the one-state machine `120080`, and internally every letter rule runs
as a one-state table like that. A table under the swatches shows the
machine.

| Start from | Rule | What happens |
| --- | --- | --- |
| Fibonacci | `181181121010` | A tilted block of fine stripes, painting almost exactly one new cell every four steps |
| Coiled rope | `111180121010` | A round, tightly woven disc, as wide as it is tall at every size |
| Computer art | `180121020081` | A square frame around a noisy interior; about 58 cells across at 100,000 steps and 100 at a million |
| Worm trails | `121181121020` | Winding trails in a lopsided blob that paints about a third of its box |
| Striped spiral | `021080181020` | A growing diamond of stripes that repeats along its edges but never escapes into a highway |

The names of these five come from the
[rm-hull/turmites](https://github.com/rm-hull/turmites) collection; the
descriptions are what the simulation measures.

Every line in these tables is checked by `test/presets.test.js`.

## Spotting highways

With a single ant, the lab records what the ant reads and which way it faces
at each step. Every 4,096 steps it looks for the smallest period of the last
1,024, 4,096 and 8,192 of those symbols (with the prefix function from
Knuth–Morris–Pratt). If the tail repeats at least three times, the ant's
motion repeats too: each period moves it by the same offset. A zero offset is
a loop in place. It then walks back through the last 32,768 steps to find
where the repetition began, which is how it reports step 9977 for Langton's
ant.

A repeating stretch with a non-zero offset is not yet a highway. On
hexagons, `L1L2NUL2L1R2` walks along each straight edge of its own pattern
with a 698-step repeat, then turns the corner and does it again. So the lab
checks again every 4,096 steps, drops stretches that have ended, and keeps
the first start step of one that carries on. It calls a stretch a highway
only once the ant has escaped: it stands further outside the pattern's
bounding box (as it was when the stretch was found) than that box is wide.
Langton's ant escapes by step 20,480; the rim walker never does.

Several ants are drawn and stepped in order on the shared grid, but the
repeat check only follows a lone ant.

## Using the lab

- **Grid**: square cells with four directions or hexagons with six.
  Switching starts over with one ant and the grid's own Langton rule.
- **Start from** a named rule, or type your own (2 to 16 colours, or a
  machine with up to 16 states on the square grid). The swatches show each
  colour with its turn.
- **Ants**: one at the origin, two back to back, a line or a ring of 2 to 16.
  At step 0 you can click a cell to add an ant and click again to turn it;
  once it has faced every way, the next click removes it.
- **Run**: play, step and reset; speed from 4 to 4,000,000 steps a second;
  **Go to step** runs straight to any step up to 20 million.
- **View**: the board follows the pattern until you drag or scroll; **Fit**
  brings following back. Grid lines appear when cells are 8 pixels or more.
- **Save PNG** exports the whole pattern at up to 16 pixels a cell;
  **Copy link** puts the grid, rule, ants, step and speed in the address. The
  simulation is deterministic, so the link replays to the same grid.

Keys: <kbd>Space</kbd> play or pause, <kbd>S</kbd> or <kbd>→</kbd> step,
<kbd>R</kbd> reset, <kbd>F</kbd> fit, <kbd>[</kbd> and <kbd>]</kbd> speed.

The grid starts at 128 × 128 cells and doubles whenever an ant comes near the
edge, up to 4096 × 4096; there the run stops and says so. Hexagons are kept
in axial coordinates (q, r) in the same array: cell (q, r) is drawn centred
at (q + r/2, r·√3/2), and each pixel finds its hexagon by cube rounding.

## Layout

```
index.html, style.css   page and styles
src/rules.js            rule letters or tokens to turns, per grid
src/machine.js          state-machine notation and transition tables
src/grid.js             centred grid that doubles as needed
src/colony.js           ants stepping on the grid, painted-cell count
src/period.js           smallest period and highway detection
src/presets.js          named rules and their notes
src/ants.js             ant layouts and click editing
src/render.js           OKLCH palette, view fitting, pixel painting
src/share.js            URL hash encoding
src/describe.js         readout sentences
src/main.js             DOM wiring
scripts/probe.js        run a rule headless: node scripts/probe.js L1R1 1000000 hex
```

## References

- C. G. Langton, "Studying artificial life with cellular automata",
  *Physica D* 22 (1986) 120–149.
- D. Gale, J. Propp, S. Sutherland and S. Troubetzkoy, "Further travels with
  my ant", *Mathematical Intelligencer* 17(3) (1995) 48–56.
- [rm-hull/turmites](https://github.com/rm-hull/turmites): the named
  two-state machines used as presets.

## License

MIT
