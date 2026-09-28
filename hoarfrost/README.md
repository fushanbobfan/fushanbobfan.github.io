# hoarfrost

Grow snow crystals in the browser. A hexagonal grid of cells trades water
vapour with its neighbours; cells that collect enough freeze, and the frozen
edge reaches out into the vapour around it. Two numbers, the vapour density
far from the crystal and how much the edge captures from the air, decide
whether you get a plain hexagonal plate, a plate with ridged sectors or a
fern-like star.

**Live demo:** https://fushanbobfan.github.io/hoarfrost/

No build step and no dependencies.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## License

MIT
