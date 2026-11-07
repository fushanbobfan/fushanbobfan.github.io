# axon

Fire a nerve impulse in the browser. Push a patch of squid axon membrane with a
little current, and watch the sodium and potassium channels swing it through a
spike. The page runs the four equations Hodgkin and Huxley published in 1952.

**Live demo:** https://fushanbobfan.github.io/axon/

No build step and no dependencies. The model is plain ES modules covered by a
Node test suite; only `src/main.js` and the view modules touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## Membrane

- **Experiment** loads a starting point: a brief push, a push just too weak, a
  second push too soon, a steady current, the spike that follows letting go of a
  negative current, sodium blocked, potassium half blocked, a warmer axon.
- **Strength, Lasts** and the optional second push shape the current. Every
  change reruns the trace at once.
- **Temperature** speeds the gates up, and the two channel sliders block a share
  of each channel type.
- **Play**, the **Time** slider or a drag on any chart moves through the trace,
  and the channel picture follows it. Below the voltage chart you can show gates,
  conductances or currents.
- **Keep this trace** leaves a dashed copy behind for comparison, and **Copy
  link** shares the settings.

## What is checked

Each number a note on the page quotes is tested against the model in
`test/presets.test.js`. That file and `test/simulate.test.js` hold:

- rest at -65 mV, and steady gates of m = 0.053, h = 0.596, n = 0.318 there
- a spike overshooting to about +39 mV and undershooting to about -76 mV
- 6.8 µA/cm² for 1 ms failing and 7 firing
- a steady current of 6 giving two spikes and 6.5 firing on, in line with the
  published onset of repetitive firing near 6.27 µA/cm²
- a spike after a hyperpolarizing current ends, with h up and n down at release
- spikes about four times narrower at 18.5 °C, and none from the same push at 30 °C

The integrator is fourth-order Runge-Kutta, with its order tested on a real trace.

## Simplifications

Temperature scales the gate rates by a factor of 3 per 10 °C and leaves the
conductances alone. Blocking potassium here also removes most of what holds the
model at rest, which is why the membrane fires by itself. A real neuron has
further channels that this squid model leaves out.

## Sources

- A. L. Hodgkin and A. F. Huxley, [A quantitative description of membrane current
  and its application to conduction and excitation in nerve](https://pubmed.ncbi.nlm.nih.gov/12991237/),
  J. Physiol. 117 (1952).

## License

MIT.
