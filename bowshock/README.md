# bowshock

The Doppler effect and the Mach cone in the browser. A source moves through
still air and sends out one ring per beat of its tone. A listener you can drag
around hears the pitch rise as the source comes towards it and fall as it goes
away. Push the source past the speed of sound and the rings pile up into a
cone: ahead of it there is silence, the edge of the cone sweeps over the
listener as a boom, and inside it the listener hears two copies of the sound
at once, one of them backwards.

**Live demo:** https://fushanbobfan.github.io/bowshock/

No build step and no dependencies. The paths, the source track, the Doppler
and retarded-time calculations, the scene, the chart geometry and the
share-link format are plain ES modules covered by a Node test suite; only
`src/main.js` and the Web Audio part of `src/audio.js` touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What you are looking at

**Rings.** Every ring left the source at one beat of its tone and has been
growing at the speed of sound c ever since, centred on where the source was
at that moment. Where rings bunch up the listener hears a higher pitch; where
they spread out, a lower one. With "Tint rings by pitch shift" each piece of
a ring is coloured by the shift it carries, blue for higher, orange for lower
and violet for sound the listener would hear backwards (see below).

**The listener** is the green ring. The dashed lines run from each point on
the source's track whose sound is reaching the listener right now, and the
chart plots those pitches over the last ten seconds as a multiple of the
emitted pitch, on a log scale.

**Mach cone.** On the straight pass above Mach 1 the dashed red lines mark
the cone of half-angle μ, with sin μ = 1/M. On the circle the source keeps
turning, so the envelope of its rings bends; the rings show that shape, and
no straight cone is drawn.

## How the listener's sound is found

A ring sent at time τ from the source position s(τ) reaches the listener L at
time t when

    |L − s(τ)| = c (t − τ).

The page keeps the source's track for the last few seconds and finds every
root τ of g(τ) = |L − s(τ)| − c (t − τ) by scanning the track for sign changes
and bisecting inside each step. Each root is an *image* of the source: a
moment of its past that the listener is hearing now.

- Below Mach 1, g only increases with τ, so there is exactly one image. For a
  straight pass this gives the familiar fall from 1/(1 − M) to 1/(1 + M).
- Above Mach 1 there can be none, which is the silence ahead of the cone, or
  two: sound from the approach and from the retreat arrive together. The
  boom is the moment the two images are born from one point, where
  dg/dτ = 0 and the pitch of both runs off to infinity.

The pitch of an image is the rate at which emission time passes per unit of
listening time,

    dτ/dt = 1 / (1 − v·u / c),

where v is the source velocity at τ and u the unit vector from s(τ) to L.
When the source was moving towards the listener faster than sound, this is
negative: later emissions arrive first, so that stretch of the signal is heard
backwards. A pure tone backwards is the same tone, so the sound voices such an
image at the size of its ratio.

On the straight pass the source wraps round from one edge to the other. The
track records the wrap as a break, so the listener can still hear the last
pass fading out but no sound is ever made up from the jump itself.

## Sound

"Sound on" plays up to two sine voices at 330 Hz times each image's ratio,
kept between 40 Hz and 4 kHz. Loudness falls with the square root of the
distance, as a wave spreading in two dimensions does, and is also turned down
as the pitch climbs so the squeal near Mach 1 stays bearable.

## Controls

| Control | Effect |
| --- | --- |
| Path | Straight pass, circle, follow the pointer, or standing still |
| Mach number | Source speed as a multiple of c; with "Follow the pointer" it is the top speed |
| Tone | Rings sent per second |
| Scenes | Passing car (M 0.4), the sound barrier (M 1), a supersonic jet (M 1.8), circling below and above Mach 1 |
| Drag | Grab the listener to move it; with "Follow the pointer", drag elsewhere to steer the source |
| Keys | Arrows move the listener when the stage has focus (Shift for bigger steps), Space pauses, R restarts, M toggles sound |

"Copy share link" stores the path, speed, tone, listener position and view
options in the URL; only settings that differ from the defaults are written.

## Code layout

| File | Contents |
| --- | --- |
| `src/path.js` | World size, speed of sound, the straight, circular and steered paths |
| `src/history.js` | Sliding window of track samples with breaks |
| `src/doppler.js` | Doppler ratio, Mach angle, retarded-time images |
| `src/sim.js` | Stepping the source, emitting and dropping rings |
| `src/render.js` | Stage and pitch chart drawing, colour and geometry helpers |
| `src/audio.js` | Image to voice mapping and the Web Audio tone |
| `src/settings.js` | Defaults, scenes and share links |
| `src/main.js` | Page wiring |

## Licence

MIT
