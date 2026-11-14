# lodestone

A pendulum over magnets, in the browser. Let the bob go anywhere and it swings,
slows and comes to rest over one of the magnets. Colour every starting point by
the magnet that wins and the map breaks into braided ribbons.

**Live demo:** https://fushanbobfan.github.io/lodestone/

No build step and no dependencies. The physics and the map live in plain ES
modules covered by a Node test suite; only `src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **The map.** Each pixel is a starting point. A bob is released there at
  rest and followed until a magnet catches it; the pixel takes that magnet's
  colour, darker the longer the bob wandered first. The map fills in coarse
  rows first, so a rough picture appears at once and sharpens.
- **One bob, and its twin.** Click the map to release a bob and watch its
  path. A twin starts 0.01 to the right; in the braided zone the two often
  end on different magnets.
- **Magnets.** Drag any magnet to a new spot, or type its position in the
  Magnets fields; the map redraws. Two magnets stay at least 0.15 apart.
- **Zoom.** Scroll, or use the buttons. The map is recomputed at the new
  scale, so finer ribbons appear between the ones you saw before.
- **The pendulum.** Friction, the pull back to the centre, and the height of
  the bob above the magnets.
- **Readout.** Where the last bob landed and when, and the share of the view
  each magnet takes.

## Starting setups

| Setup | What to look for |
| --- | --- |
| Three magnets | Solid colour near each magnet, braided ribbons farther out. |
| Little friction | Many more passes before a catch; the braided zone covers most of the map. |
| Heavy friction | Three broad lobes with thin fringes. |
| Two magnets | Two are already enough for bands. |
| Four magnets | The map keeps the square's quarter-turn symmetry. |
| One strong magnet | It catches more than half the starting points, yet the others reach in toward it. |
| Strong pull to the centre | Far-out starts cross the middle at speed; much more of the map is braided. |

The tests check the notes' claims: lower friction gives more neighbouring
pixels that end on different magnets, the strong magnet's share is above
half, and so on.

## The model

The bob moves in a plane at position **r** with velocity **v**:

    a = −k r − b v + Σᵢ sᵢ (mᵢ − r) / (|mᵢ − r|² + h²)^(3/2)

*k* is the pull back to the centre, *b* the friction, *h* the gap between the
bob's plane and the magnets, and *sᵢ* the strength of magnet *i* at
**m**ᵢ. Time steps use fourth-order Runge–Kutta with step 0.02, cut into
smaller pieces when the bob passes close to a magnet, where the pull changes
fastest; the tests check that friction then never adds energy, even with the
magnets at their closest.

**When is a bob caught?** Around each magnet is a disc reaching at most 0.45
of the way to its nearest neighbour, so discs never overlap. Friction only ever
drains energy, so once the bob is inside a disc with less energy than the
lowest point of its rim, it can never leave. The rim is sampled at 720 points,
and the level used is the lowest sample minus the most the potential can fall
between two neighbouring samples, so it lies below every point of the rim. The
map stops following a bob at that moment, long before it would come to rest. A
bob that comes to rest outside every disc, or is still moving after 200 time
units, is shown in grey as not caught.

## Files

- `src/model.js`: forces, the Runge–Kutta step, the traps and a bob's fate.
- `src/basins.js`: the basin map, filled coarse to fine, and its colouring.
- `src/presets.js`: the starting setups.
- `src/main.js`: drawing and input.

## License

MIT
