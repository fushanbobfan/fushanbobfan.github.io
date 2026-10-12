# plasmodium

A slime mould in the browser. Thousands of tiny particles each sense the
chemical trail ahead of them, turn towards the strongest smell, step forward
and leave a little more trail behind. The trail spreads and fades. Out of
nothing more than that, the particles organise into the branching tube
networks that *Physarum polycephalum* grows between pieces of food.

**Live demo:** https://fushanbobfan.github.io/plasmodium/

No build step and no dependencies. The trail layer, the particles, the
network reading, the renderer and the share links are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).

## The model

This is Jeff Jones's particle model of *Physarum* (Artificial Life, 2010).
The dish is a grid of trail values. Every step:

1. **Food** sources add attractant to a small disc around themselves.
2. **Motor stage.** Each particle moves one step along its heading and adds
   trail to the cell it lands on. In a closed dish a particle that would
   leave stays put and faces a random new way.
3. **Sensory stage.** It reads the trail at three sensors a fixed distance
   ahead: straight on, and one sensor angle to each side. If the front is
   strongest it keeps going; if the front is weakest it turns left or right
   at random; otherwise it turns towards the stronger side by the turn angle.
4. **Trail.** Each cell moves part of the way towards the mean of its 3x3
   neighbourhood (spread) and then loses a fixed share (fade).

With fade at 10% and no food, the dish settles to about nine steps' worth of
trail per particle. A test checks that steady level.

## Presets

Each note describes what the headless probe shows at the preset's own size
and seed. The measurable part of each note is checked in
`test/presets.test.js`.

| Preset | Settings | What happens |
| --- | --- | --- |
| Jones's reference | sensors 22.5°, turns 45°, distance 9 | A fine mesh within fifty steps that keeps coarsening; tube cover more than halves by step 400 |
| Oat flakes in a dish | sensors 45°, turns 22.5°, distance 15, five food sources, closed dish | One network runs through all five food sources |
| Lasting lattice | sensors 22.5°, turns 90°, distance 9 | Struts and junctions that keep clearly more of the dish covered than the reference |
| Long sight | sensors 30°, turns 30°, distance 25 | A few large rounded cells |
| Short sight | sensors 45°, turns 45°, distance 3 | Long single threads that wander and curl |
| Glowing spots | sensors 90°, turns 20°, distance 9 | Many tight bright clumps, none large |
| Outburst | twenty thousand particles from the centre, facing out | A cross of tubes |
| Maze | 800 particles, sensors 45°, turns 22.5°, distance 20, food in the first and last rooms | By step 1500 the rooms on the shortest route hold several times the trail of the other rooms |

## Walls and mazes

Walls block both particles and trail. A particle that would step into a wall
stays put and faces a random new way, as it does at the rim of a closed dish;
no trail is laid on a wall, and diffusion next to a wall averages only the
open neighbours.

**Carve a maze** fills the dish with a seeded maze: rooms one corridor wide,
joined by a depth-first search into a perfect maze (exactly one route between
any two rooms). **Knock extra passages through** opens 15% of the remaining
inner walls as well, so some rooms can be reached more than one way. Food
goes in the top-left and bottom-right rooms.

The readout then adds **Route vs dead ends**: the mean trail in the rooms on
the shortest route between the two food sources divided by the mean in every
other room, each read over a 5x5 block at the room's centre. In this model
the particles do not retract from dead ends the way a real plasmodium does;
they thin out there because nothing feeds them, while the food at both ends
keeps the route between them supplied.

## Reading the network

The readout treats any cell with more than 1.5 times the dish's average
trail as tube. Touching tube cells (four neighbours, across the edge when it
wraps) form one piece. It reports:

- **Tube cover:** the share of the dish that is tube.
- **Separate pieces:** how many connected pieces there are.
- **Food linked:** how many food sources sit on the same piece.

## Controls

- **Start from** loads a preset, its food and a fresh run.
- **Particles** and **Trail** sliders change a running dish at once.
- **Dish** settings (starting layout, particle count, edges) apply on Reset.
  Food layouts apply at once.
- Click the dish to drop a food source; click one to take it away.
- **Clicking the dish** picks the tool: drop or remove food, paint
  attractant to lure the particles, build walls or erase them.
- **Carve a maze** and **Clear walls** replace or remove every wall.
- **New seed** restarts with a different random scattering.
- **Copy link** puts the settings, food sources, walls, colours and exposure
  in the URL; the same link replays the same run. A maze travels as its
  recipe, hand-built walls as a run-length code.
- Keys: <kbd>Space</kbd> play or pause, <kbd>S</kbd> step, <kbd>R</kbd>
  reset, <kbd>N</kbd> new seed.

With reduced motion requested by the system, the dish starts paused.

## Probe

`scripts/probe.js` runs a dish headless, prints the network readout every few
hundred steps and can save the trail as a greyscale PNG:

```bash
node scripts/probe.js sensorAngle=45 turnAngle=22.5 sensorDistance=15 \
  foodStrength=20 wrap=false food=pentagon steps=1500 png=dish.png
```

## Code layout

| File | Role |
| --- | --- |
| `src/rng.js` | Seeded mulberry32 generator |
| `src/trail.js` | Trail grid and walls: deposit, sample, diffuse and fade, brush stamp |
| `src/agents.js` | Particles: motor and sensory stages |
| `src/spawn.js` | Starting layouts |
| `src/food.js` | Food sources and food layouts |
| `src/sim.js` | Settings, a seeded run, reset, retune and stepping |
| `src/walls.js` | Wall painting, maze carving and shortest route, wall codes |
| `src/network.js` | Tube threshold, connected pieces, food linking, route contrast |
| `src/presets.js` | Named presets with notes |
| `src/render.js` | Tone curve and palettes |
| `src/share.js` | Share-link encoding |
| `src/main.js` | The page |

## Reference

- Jeff Jones, "Characteristics of pattern formation and evolution in
  approximations of *Physarum* transport networks", *Artificial Life*, 2010.

## Licence

MIT
