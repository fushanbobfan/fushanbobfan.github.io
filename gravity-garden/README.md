# Gravity Garden

An interactive playground for Newtonian gravity, built with plain HTML5 canvas and
vanilla JavaScript — no build step, no dependencies.

Watch planets orbit a sun, two stars circle a shared center of mass, three equal
masses trace a stable figure-eight, or a random cluster of bodies pull each other
into loose clumps and slingshots.

## Running it

Any static file server works, since the page is loaded as ES modules over HTTP
(opening `index.html` directly via `file://` will not load the modules). For example:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL in a browser.

## Controls

- **Scenario** — switch between the built-in presets.
- **Pause / Reset** — stop the simulation or reload the current scenario's initial conditions.
- **Speed** — scale the simulation timestep.
- **Show trails** — toggle position trails for each body.
- **Click the canvas** — drop a new body at that point, with zero initial velocity.

## Presets

| Scenario | Description |
| --- | --- |
| Sun & Planets | A central mass with three planets in circular orbits at increasing radii. |
| Binary Star + Planet | Two unequal-mass stars orbiting their common center of mass, with a planet further out. |
| Figure-Eight Three-Body | The Chenciner–Montgomery choreography: three equal masses chasing each other around a stable figure-eight curve. |
| Random Cluster | A randomized cluster of bodies with varied mass, useful for watching chaotic multi-body dynamics emerge. |

## Physics

Every pair of bodies attracts the other according to Newton's law of universal
gravitation, `F = G * m1 * m2 / r^2`. The system is integrated with
[velocity Verlet](https://en.wikipedia.org/wiki/Verlet_integration) (a symplectic,
time-reversible method), which conserves energy and momentum far better than a
naive Euler step over long simulation runs. A small softening length is added to
the squared distance in the force calculation so that accelerations stay finite
if two bodies pass very close to each other, a standard technique in N-body
simulation.

When two bodies overlap, they merge into one inelastic body that conserves
total mass and momentum, rather than orbiting forever at zero distance.

The core simulation logic lives in [`src/physics.js`](src/physics.js) and has no
dependency on the DOM or canvas, so it can be tested and reused on its own.

## Development

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and check physical
invariants of the simulation: Newton's third law, conservation of momentum and
(approximate) energy over a long run, and that the center of mass of a
symmetric system stays fixed.

## License

MIT, see [LICENSE](LICENSE).
