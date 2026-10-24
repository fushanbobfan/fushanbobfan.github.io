# drape

Cloth in the browser. A woven grid of point masses joined by threads of fixed
length hangs from pins: a curtain gathered on rings, a banner on four hooks, a
flag in the wind, a sheet on a line. Grab it and pull, slash it, move its pins,
and watch every thread change colour with how hard it is stretched until the
weakest ones snap.

**Live demo:** https://fushanbobfan.github.io/drape/

No build step and no dependencies. The cloth, the hand tools, the scenes and
the colour scale are plain ES modules covered by a Node test suite; only
`src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## Using it

| Tool | What it does |
| --- | --- |
| Grab <kbd>G</kbd> | Close a hand on the patch under the pointer and pull. Let go mid-flick to throw the cloth. Grabbing a pin moves it. |
| Cut <kbd>C</kbd> | Slash across the cloth; every thread the stroke crosses is cut. Right-drag or Shift-drag cuts with any tool. |
| Pin <kbd>P</kbd> | Click a point to pin it in place, or click a pin to free it. |

<kbd>Space</kbd> pauses, <kbd>R</kbd> rehangs the scene and <kbd>T</kbd> tears a
slit down the middle, so the main experiment works from the keyboard alone.

The sliders set the wind, gravity, how far a thread stretches before it tears
(or no tearing at all), and the stiffness: the number of solver passes per
step. Few passes give a stretchy knit that sags and bounces; many give a firm
weave.

## How it works

Each point stores its current and previous position. A step of
[position Verlet](https://en.wikipedia.org/wiki/Verlet_integration) moves it by
its last displacement, slightly damped, plus gravity and wind times
*dt*&sup2;; velocity never appears explicitly. Then the solver walks every
intact thread and moves its two ends towards each other, or apart, until the
thread is its rest length again, sharing the correction equally between free
ends and giving all of it to the free end when the other is pinned. One pass
cannot satisfy every thread at once, because fixing one disturbs its
neighbours, so it repeats the sweep a few dozen times per step. This is the
scheme Thomas Jakobsen described for *Hitman: Codename 47* in
"Advanced Character Physics" (2001), a forerunner of position-based dynamics.

After the passes, any thread still longer than the tearing ratio times its
rest length snaps. Checking once the passes are done means only stretch the
cloth cannot relax away counts, so a resting curtain stays whole through the
momentary stretch of a sweep in progress.

Wind is a horizontal push with a gust that travels across the cloth, so a flag
ripples as it streams out. A floor stops anything that falls, with
friction so torn pieces settle.

The threads are coloured on a square-root scale from slack to the tearing
stretch. A hanging cloth stretches a few percent near its pins and hardly at
its hem, and the square root spreads that range over the paler colours so the
gradient of tension stays visible before anything comes close to tearing.

## What the tests check

- An unpinned point falls exactly *g dt*&sup2; *n*(*n*+1)/2 after *n* Verlet
  steps, the closed form of the scheme under constant acceleration.
- One relaxation restores a stretched thread to its rest length about its
  midpoint, or moves only the free end when the other is pinned.
- A hanging chain settles within 1% of its rest lengths, stays vertical, and
  is stretched more at the top, which carries the most weight, than at the
  bottom.
- Threads snap only past the tearing ratio, never without one, and stay
  broken; a cut stroke breaks exactly the threads it crosses; a cloth cut from
  its pins falls away.
- A hand carries the patch it grabbed rigidly, a pin dragged and dropped stays
  pinned where it lands, and a released point keeps the hand's velocity.
- Every scene starts inside the world, hangs for four seconds without a tear
  at the default strength, and the gathered curtain falls into folds.

## Files

| File | Contents |
| --- | --- |
| `src/cloth.js` | grid construction, Verlet step, relaxation, tearing, floor, wind |
| `src/tools.js` | nearest point, stroke cutting, pins, grab and throw |
| `src/presets.js` | the world size and the four scenes |
| `src/view.js` | world-to-canvas fitting and the strain palette |
| `src/main.js` | canvas, pointer and keyboard input, drawing, readout |

## License

MIT
