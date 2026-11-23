# shutterwarp

Why a phone photo bends a spinning propeller. Most phone sensors have a
rolling shutter: each line of pixels is exposed a moment after the one before
it. While the sweep runs, the blades keep turning, so every line catches them
somewhere else. Stacked together, the rows show blades that are
bent, lopsided or broken into pieces.

**Live demo:** https://fushanbobfan.github.io/shutterwarp/

No build step and no dependencies. The propeller, the sensor and the readouts
are plain ES modules covered by a Node test suite; only `src/main.js` touches
the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **The propeller as it really is**, slowed down so that one sweep of the
  sensor lasts four seconds. A line shows the row being read; the rows above
  it are already in the photo.
- **The photo**, built up row by row beside it. Each row is exactly the
  scene along that line at the moment the line was read.
- **Controls** for the propeller speed (0 to 9,000 rpm), the number of blades,
  the direction of turning and the time the sensor takes to read from top to
  bottom (1 to 60 ms), with three starting points: a ceiling fan, an aircraft
  propeller and a drone rotor.
- **A readout** of how far the propeller turns during one sweep, which is
  what decides the picture: a few degrees leaves the blades straight, a large
  part of a turn curves them, and more than a full turn can catch a blade
  several times on its way down the frame. Where the blades stand when the
  sweep starts decides whether a piece comes out detached.

With reduced motion requested, the page starts paused and "Take a photo now"
produces the finished photo at once.

## The model

The propeller has its hub at the origin and blade tips at radius 1. Blade 0
points at angle

    θ(t) = θ₀ ± 2π · (rpm / 60) · t

and a point at radius *r* and angle *α* is on a blade when it lies within
half a blade width of the blade's centre line. The sensor has *N* rows; row *i*
(counting from the top) is read at

    tᵢ = t₀ + i / (N − 1) · T

where *T* is the readout time. Each pixel is the fraction of a 2 × 2 grid of
sample points inside it that fall on a blade at its row's time. The photo is
therefore a stack of exact snapshots of thin strips, each from its own
moment. Two simplifications: the sweep always runs from top to bottom (in a
real camera the direction depends on how the sensor is mounted and how the
phone is held), and each row's exposure is instantaneous, so there is no
motion blur; the turn during one readout, (rpm / 60) · T · 360°, sets how much the
strips disagree.

## Layout

```
index.html        page
style.css         styles, light and dark
src/shutter.js    propeller, row timing, exposure
src/readout.js    labels and the one-sentence verdict
src/scene.js      canvas drawing of the propeller and the photo
src/main.js       controls and animation
test/             node:test suites
scripts/serve.js  static server for local use
```

## License

MIT
