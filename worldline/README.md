# worldline

Spacetime diagrams for special relativity, in the browser. Time runs up the
page, space runs across, and light moves along the 45° lines. Place events,
then change who is looking: the dots slide, light stays at 45°, and the set of
events that count as "at the same moment" tilts with the observer.

**Live demo:** https://fushanbobfan.github.io/worldline/

No build step and no dependencies. The physics and the geometry of the
drawing live in plain ES modules covered by a Node test suite; only
`src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **Two frames.** The blue grid is the lab: vertical lines are clocks at rest
  one light-second apart, horizontal lines are the lab's moments. The orange
  grid is a rocket moving at a speed you set. Its clocks run along tilted
  lines, and its moments tilt toward the light line by the same angle.
- **Look from anywhere.** The "Look from" slider redraws the diagram as an
  observer moving at that speed relative to the lab measures it. The buttons
  jump to the lab or the rocket, easing through the change of frame.
- **Events.** Click an empty spot to add one, drag to move it, or focus the
  diagram and use the arrow keys. Delete removes the selected event. The
  event list gives each event's time and place as the current observer
  measures them.
- **Pairs.** Select two events and the panel below compares them: how far
  apart they are in time and space for the lab, the rocket and the current
  view, which happens first for each, and the interval, which is the same for
  all. Timelike pairs get the proper time of a clock present at both;
  spacelike pairs get the speed of the observer who sees them happen together,
  and a button that switches to that observer.
- **Light cone and lines of now.** For the selected event, the shaded region
  holds everything it can affect or be affected by; the dashed lines are the
  events the lab and the rocket each call simultaneous with it.
- **Hyperbolas.** Optional curves of equal interval from the origin. Change
  the view and every event slides along its own hyperbola.

## Units and conventions

Time is in seconds and distance in light-seconds, so the speed of light is 1
and speeds are fractions of it. Positive speeds point right. The observer
slider stops at 0.9c so the grids stay readable; the physics module accepts
anything below light speed.

## Layout

```
index.html        page and controls
style.css         light and dark themes
src/lorentz.js    boosts, intervals, proper time, simultaneous and colocated frames
src/diagram.js    view mapping, frame grids and axes, simultaneity lines, hyperbolas
src/readout.js    plain-language comparison of two events
src/main.js       drawing and interaction
test/             node:test suites
```

## License

MIT
