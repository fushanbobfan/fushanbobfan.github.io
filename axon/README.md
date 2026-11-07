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

## Thresholds

Three curves are measured on the spot, a point at a time, and their captions are
written from the measured values:

- **Steady current** sweeps the current slowly up and back down without resetting
  the membrane. Firing starts at 10 µA/cm² going up and stops at 6.5 going down
  (on steps of 0.25), so between them the same current can mean silence or firing.
- **How strong, how long** finds the threshold for each pulse width, with the
  rheobase (2.24 µA/cm²) and chronaxie (1.66 ms) read off the curve.
- **How soon again** finds what a second pulse needs after a first spike: nothing
  up to 200 µA/cm² works at 5 ms, and around 20 ms the need dips below normal.

A strong pulse lifts the voltage past 0 mV by itself, so these curves count a
spike by the sodium conductance it recruits. Failures stay under 1 mS/cm² and
spikes pass 15, so the cut at 10 is far from either side.

## Voltage clamp

Step the voltage and read the current. Each gate relaxes exponentially at a fixed
voltage, so the currents here are exact, with no integrator. Change the voltage
held before the step to see sodium channels already plugged, or block either
channel type to split the early inward current from the late outward one. The
current-voltage curve below updates with every change.

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
The clamp's exact gates are tested against a numerical integration.

## Simplifications

Temperature scales the gate rates by a factor of 3 per 10 °C and leaves the
conductances alone. Blocking potassium here also removes most of what holds the
model at rest, which is why the membrane fires by itself. A real neuron has
further channels that this squid model leaves out.

## Sources

- A. L. Hodgkin and A. F. Huxley, [A quantitative description of membrane current
  and its application to conduction and excitation in nerve](https://pubmed.ncbi.nlm.nih.gov/12991237/),
  J. Physiol. 117 (1952).
- J. Guckenheimer and R. A. Oliva, [Chaos in the Hodgkin-Huxley model](https://pi.math.cornell.edu/~gucken/PDF/hh_chaos.pdf),
  for the subcritical Hopf bifurcation near 9.78 µA/cm².
- [Dynamical response of the Hodgkin-Huxley model in the high-input regime](https://arxiv.org/abs/cond-mat/0512341),
  for the saddle-node of periodic orbits near 6.27 µA/cm².

## License

MIT.
