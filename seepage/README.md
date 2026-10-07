# seepage

Percolation in the browser. Fill a grid at random with probability *p*,
watch neighbouring cells join into clusters, and find the point where one
cluster first reaches from one side of the grid to the other.

**Live demo:** https://fushanbobfan.github.io/seepage/

No build step and no dependencies. The lattice, the cluster labelling and
the threshold sweep are plain ES modules covered by a Node test suite;
only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Licence

MIT
