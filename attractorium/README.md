# attractorium

Strange attractors in the browser. Pick one of seven chaotic flows, turn it in
3D, and release a cloud of starting points packed into a ball as small as
10⁻⁹. The flow stretches the ball into a thread, folds the thread over the
attractor, and within a few dozen time units the cloud covers the whole thing.
A chart shows the cloud's spread growing at the rate set by the largest
Lyapunov exponent, which the page measures alongside.

**Live demo:** https://fushanbobfan.github.io/attractorium/

No build step and no dependencies. The systems, the integrator, the
measurements, the camera, the drawing code and the share-link format are plain
ES modules covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later). Measure systems from the
command line with the probe:

```bash
node scripts/probe.js
node scripts/probe.js --system rossler --set c=4 --time 1000
```

## The systems

| System | Equations | Defaults | Measured λ |
| --- | --- | --- | --- |
| Lorenz (1963) | ẋ = σ(y − x), ẏ = x(ρ − z) − y, ż = xy − βz | σ = 10, ρ = 28, β = 8/3 | 0.90 |
| Rössler (1976) | ẋ = −y − z, ẏ = x + ay, ż = b + z(x − c) | a = b = 0.2, c = 5.7 | 0.068 |
| Chen (1999) | ẋ = a(y − x), ẏ = (c − a)x − xz + cy, ż = xy − bz | a = 35, b = 3, c = 28 | 2.09 |
| Thomas (1999) | ẋ = sin y − bx, and cyclically | b = 0.208186 | 0.035 |
| Halvorsen | ẋ = −ax − 4y − 4z − y², and cyclically | a = 1.4 | 0.67 |
| Aizawa | ẋ = (z − b)x − dy, ẏ = dx + (z − b)y, ż = c + az − z³/3 − (x² + y²)(1 + ez) + fzx³ | a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1 | 0.090 |
| Dadras (2009) | ẋ = y − ax + byz, ẏ = cy − xz + z, ż = dxy − ez | a = 3, b = 2.7, c = 1.7, d = 2, e = 9 | 0.38 |

The last column is what `node scripts/probe.js` prints with 400 time units of
averaging. Published values for comparison: Lorenz 0.9056, Rössler 0.0714,
Chen about 2.0; the tests hold the first three to those.

Halvorsen is often quoted with a = 1.89. From the start used here that value
gives a periodic orbit (three distinct maxima and λ ≈ 0), so the default is
a = 1.4, where the flow is chaotic. Both facts are checked by the tests, as are
the periodic windows and the Rössler period-doubling steps quoted in each
system's note on the page.

## How it works

**Integration.** Every orbit is advanced by classical fourth-order
Runge-Kutta with a fixed step chosen per system. The test suite checks the
fourth-order error on a harmonic oscillator. The grey backdrop is one long
orbit, sampled after 300 time units of transient so that orbits in periodic
windows have settled.

**The cloud.** Orbits start uniformly inside a ball around a point on the
attractor; the first sits exactly at the centre. Their spread is the
root-mean-square distance from the cloud's centroid. While the cloud is small
it grows like e^(λt), then it stops at the size of the attractor. The cloud
growth rate readout is a least-squares fit of ln(spread) against time over the
stretch between three times the starting size and a twentieth of the
attractor. It is shown once the cloud has grown a hundredfold. On the Lorenz
system, from the default start, it settles at about 0.8, a little under
λ ≈ 0.9: the stretch it fits covers only a few loops, and the flow stretches
harder in some parts of the attractor than in others.

**Lyapunov exponent.** Benettin's method: a shadow orbit starts 10⁻⁸ away, and
every ten steps the separation is measured, its log growth added to a running
sum, and the shadow pulled back to 10⁻⁸ along the same direction. The page
keeps refining the estimate while it animates, and shows how many time units
it has averaged over.

**Return map.** Lorenz noticed in 1963 that if you write down each successive
maximum of z and plot it against the previous one, the points fall on a thin
curve with a cusp: the height of the next loop is almost a function of the
last. The map panel draws this for any coordinate, with each maximum refined
by a parabola through three samples. In a periodic window the map collapses to
a few points: one for a simple loop, two after the first period doubling, and
so on.

**Bifurcation diagram.** The wide chart sweeps one parameter across its
slider range in 220 columns. Each column runs 150 time units to settle and
then records up to 120 maxima over the next 150, starting from where the
previous column's orbit ended so a branch is followed as the parameter moves.
A column with one dot is a simple loop, two dots a doubled period, a smear is
chaos, and grey columns ran off to infinity. The work is spread over animation
frames (8 ms per frame), and moving the swept parameter's own slider keeps
the finished diagram. Click anywhere on it to jump to that value. On Rössler
the cascade and a period-3 window near c ≈ 16.8, doubling to period 6 just
above it, stand out; on Lorenz, the periodic windows near ρ = 100 and from
about 146 to 166.

**View.** An orthographic camera keeps each system's vertical axis upright.
Yaw turns the attractor around it and pitch tilts it. The frame is
right-handed, so nothing is drawn mirrored. The view fits the farthest point
of the backdrop orbit, so the attractor stays on screen however it is turned.
Equilibria with closed forms are marked with crosses; ones far outside the
attractor are left out.

## Controls

- Drag to turn, scroll or pinch to zoom. Arrow keys turn and `+` and `−`
  zoom.
- Space runs or pauses, R releases a new cloud with a fresh seed, O shows or
  hides the long orbit.
- Parameter sliders rebuild the orbit, the measurements and the cloud. If the
  orbit runs off to infinity, the page says so.
- Copy link writes the system, every changed parameter, the cloud settings,
  the seed and the view into the URL. Only values that differ from the
  defaults are written.
- Save PNG downloads the current view.

## Layout

```
index.html, style.css      page shell, light and dark schemes
src/systems.js             the seven flows, parameter ranges, equilibria
src/integrate.js           RK4, orbit sampling, Lyapunov exponent, maxima
src/cloud.js               the cloud of nearby orbits and its spread
src/camera.js              orbit camera and projection
src/bifurcation.js         parameter sweep for the bifurcation diagram
src/render.js              canvas drawing for the view and the charts
src/settings.js            share-link encoding
src/main.js                page wiring
scripts/probe.js           command-line measurements
scripts/serve.js           static dev server
```

## License

MIT
