# detour

Braess's paradox in the browser. Thousands of drivers go from S to T and each
takes whichever route is fastest for them. Open a free shortcut and every one
of them can arrive later than before. Toggle roads, change how many drivers
there are, and compare where selfish choices land with the best split anyone
could arrange.

**Live demo:** https://fushanbobfan.github.io/detour/

No build step and no dependencies. The road model, the equilibrium solver, the
drawing and the chart are plain ES modules covered by a Node test suite; only
`src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **The map.** Road widths follow the drivers on them. Each road shows its
  rule (`x/100 min` takes a minute per hundred cars; `45 min` is fixed) and its
  time right now. Cars, coloured by route, cross each road in that road's
  travel time, so slow roads fill up. Click a dashed road, or focus it and
  press Enter, to open or close it.
- **Roads you can open or close.** The same toggles as buttons, each saying
  what the change would do to every trip.
- **Where the drivers go.** Minutes per driver when everyone picks their own
  fastest route (the Wardrop equilibrium) and for the split that makes the
  total time smallest, their ratio (the price of anarchy), and a table of
  every route.
- **Day by day.** Replay how drivers find the equilibrium: start from the
  traffic as it had settled before the open roads opened (or an even split),
  and each morning move a share of the drivers on slower routes to the fastest
  one. Step through the days with the slider and watch the map follow; turn up
  how readily drivers switch and they overshoot.
- **How busy does it have to be?** Minutes per driver against demand with the
  optional roads all closed and all open, shading the range where opening
  them makes trips slower.

## Scenes

| Scene | What it shows |
| --- | --- |
| Braess's network | 4000 drivers take 65 minutes; open the free link and they take 80. Slower for any demand between 3000 and 9000. |
| Pigou's two roads | A fixed one-hour road and a road that crowds: selfish routing costs 4/3 of the best split at 6000 drivers. |
| Two links in a row | Two free links: either one costs each driver 6.7 minutes at 6000 drivers, both together 26.7. |

## How the outcomes are computed

Every road's time is `a + b·x` with `x` drivers on it. The solver lists every
route, guesses which routes are used, and solves the linear equations that say
the used routes take equal time (for the equilibrium) or have equal marginal
time `a + 2b·x` summed along the route (for the best split) and carry all the
drivers. The first guess with no negative flow and no faster unused route is
the answer, exact up to rounding. The tests check Braess's and Pigou's numbers,
the 3000 to 9000 range found by hand, the equilibrium conditions in every
scene, and the 4/3 bound of Roughgarden and Tardos.

## License

MIT
