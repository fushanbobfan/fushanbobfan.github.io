# harmonograph

A harmonograph in the browser. Damped pendulums steer a pen across the page,
and their slowly fading swings trace the looping, spiralling figures that
Victorian drawing machines were famous for.

**Live demo:** https://fushanbobfan.github.io/harmonograph/

No build step and no dependencies. The model, presets, share-link codec,
playback timing and SVG builder are plain ES modules covered by a Node test
suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## How it works

Each pendulum swings along one axis, or in a circle for a rotary pendulum,
with displacement

    A · sin(2π f t + φ) · e^(−d t)

and the pen sits at the sum of all displacements. Two swings whose
frequencies form a small whole-number ratio (2:3, 4:5, …) trace a closed
Lissajous figure. Nudge one frequency a few thousandths off that ratio and the
figure slowly rotates; add damping and it winds inward as it turns. That
combination is what gives harmonograph drawings their woven look.

The ratio panel reads the strongest horizontal and vertical swings (a rotary
pendulum counts on both), finds the closest fraction with denominator at most
12 by continued fractions, and reports how far the actual ratio is detuned
from it. Choosing a target ratio rewrites the strongest horizontal swing's
frequency to exactly that multiple of the vertical one, shifted by the detune
slider.

A drawing runs until its reach falls to 3% of the start, capped at three
minutes for undamped designs. The curve is sampled about 60 times per cycle of
the fastest pendulum.

## Controls

| Control | Effect |
| --- | --- |
| Preset | Load a named design |
| Surprise me | A random design built from detuned small-integer ratios; the seed is shown |
| Paper and ink | Ink, Sepia, Night, Ember or Spectrum; spectrum palettes shift hue along the drawing |
| Line width | Pen width in CSS pixels |
| Drawing speed | 1× to 64× real time |
| Frequency ratio | Live `x : y ≈ p:q (±detune)` readout; pick a target ratio and detune to retune the horizontal swing |
| Pendulums | Up to six, each with swing direction, amplitude, frequency, phase and damping |
| Pause / Replay / Finish | Control the pen; Finish draws the rest at once |
| Save PNG / Save SVG | Export the drawing; the SVG holds the full curve at 1000×1000 |
| Copy link | The URL hash stores the design, e.g. `#x:0.6,3.003,1.571,0.02;y:0.6,2,0,0.02` |

Keyboard: <kbd>Space</kbd> pause, <kbd>R</kbd> replay, <kbd>F</kbd> finish,
<kbd>N</kbd> surprise me. With `prefers-reduced-motion`, drawings appear
finished instead of animating.

## Presets

- **Spiral square**: near-unison swings a quarter turn apart with a faint third harmonic.
- **Lissajous 3:2**: the classic knot, drifting because the ratio is 3.003:2.
- **Butterfly**: a 1:2 figure-eight with a faster swing on the horizontal.
- **Rotary bloom**: a rotary table under a circling pen, like a spirograph.
- **Woven ribbon**: a 4:5 ratio that weaves a dense band.
- **Undamped knot**: exact 5:4 with no friction, so the pen retraces one curve.

## Layout

```
index.html, style.css   page and styles
src/harmonograph.js     pendulum model, envelope, settle time, sampling, fitting
src/presets.js          named presets and the seeded random generator
src/playback.js         drawing length, sample rate, time-to-point mapping
src/render.js           palettes, colour runs, canvas drawing, SVG output
src/ratio.js            x:y ratio readout, best fractions and retuning
src/share.js            URL hash encoding and decoding
src/main.js             DOM wiring
test/                   node:test suites for every module except main.js
```

## License

MIT
