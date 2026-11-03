# retrograde

Why the planets back up. Night by night a planet creeps east against the
stars; every so often it stops, moves west for weeks or months, stops again
and carries on. This page shows the same stretch of time twice: from above the
Sun, where the Earth on its faster inside track overtakes the planet, and in
the sky, where the line of sight from the Earth swings back and the planet
draws a loop.

**Live demo:** https://fushanbobfan.github.io/retrograde/

No build step and no dependencies. The model is a plain ES module covered by a
Node test suite; only `src/main.js` and `src/view.js` touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The model

Positions come from the Keplerian elements and rates that JPL publishes for
approximate planet positions (E. M. Standish, Table 1: the mean ecliptic and
equinox of J2000, fitted for 1800–2050). For a date the page takes each
element at that time, solves Kepler's equation for the eccentric anomaly,
places the planet on its tilted ellipse around the Sun, and subtracts the
Earth–Moon barycentre's position to get the planet's ecliptic longitude,
latitude and distance as seen from the Earth. JPL quotes errors of tens of
arcseconds for the inner planets and up to about ten arcminutes for Saturn
over that span, far below what the page draws. Light time and aberration are
left out.

A planet is **stationary** when its daily motion in longitude passes through
zero. The page finds stations by stepping a day at a time and bisecting each
sign change, and calls the stretch between a westward station and the next
eastward one a **loop**. The middle of a loop is the planet's opposition
(outer planets) or inferior conjunction (Mercury and Venus).

Loops it finds for 2024–2027 (dates in UTC):

| Planet | Backs up | Days | Arc | Middle |
| --- | --- | --- | --- | --- |
| Mars | 7 Dec 2024 – 24 Feb 2025 | 79 | 19.2° | opposition 16 Jan 2025 |
| Mars | 10 Jan 2027 – 1 Apr 2027 | 81 | 19.5° | |
| Venus | 2 Mar 2025 – 13 Apr 2025 | 42 | 16.2° | inferior conjunction 23 Mar 2025 |
| Jupiter | 11 Nov 2025 – 11 Mar 2026 | 119 | 10.1° | opposition 10 Jan 2026 |
| Saturn | 13 Jul 2025 – 28 Nov 2025 | 138 | 6.8° | opposition 21 Sep 2025 |
| Neptune | 7 Jul 2026 – 12 Dec 2026 | 159 | 2.8° | opposition 25 Sep 2026 |

The farther out the planet, the longer it spends backing up and the shorter
the arc: the Earth overtakes a distant planet slowly, and the swing of the
line of sight is smaller the farther away the planet is.

Loops come round once a **synodic period**, the time the Earth takes to gain a
full lap on the planet: 116 days for Mercury, 584 for Venus, 780 for Mars and
a little over a year for the giants.

## The views

**From above the Sun.** The Sun in the middle, the Earth and the chosen planet
on their orbits, and a ring of sky around the outside marked in ecliptic
longitude (0° is the March equinox). The dashed line runs from the Earth
through the planet out to the ring, and the ring keeps the marks that line has
left over the past months: pink where the line was swinging west. For Jupiter
and beyond the distances are compressed (square-root scale) so the Earth's
orbit stays visible; the line of sight is drawn through the compressed
positions and meets the ring at the true longitude.

**With the Earth held still.** The same top view in a frame that moves with
the Earth: the Sun circles it once a year, and the planet's track over the
trail, which is its position minus the Earth's, winds around in loops, one
per synodic period, each drawn pink while the planet runs backwards. This is
the picture Ptolemy matched with a deferent and an epicycle. For Mars the
loop comes where the planet passes nearest; the 2025 approach was 0.642 au
on 12 January, four days before opposition: Mars was moving away from the
Sun on its eccentric orbit, from 1.623 au on 12 January to 1.626 au on the
16th, so the gap closed a little sooner than the line-up.

**In the sky.** The planet's path in ecliptic longitude across (east to the
left, as when facing south from the northern hemisphere) and ecliptic latitude
up, stretched so the loop opens out; the stretch is printed in the corner.
The path is solid where the planet has been and faint where it is going,
with a dot on the first of each month. By default the strip holds the loop
nearest the date and the planet travels through it; a menu switches it to
the months around the date.

Whether the loop is a loop, a zigzag or an S depends on how the planet's
latitude changes while it backs up, which in turn depends on where the Earth
overtakes it relative to the nodes of its tilted orbit.

## What the tests check

- Julian days round-trip through dates, and Kepler's equation is solved to
  10⁻¹² for eccentricities up to 0.95,
- every planet stays between its perihelion and aphelion distances, and the
  Earth is 0.983 au from the Sun in early January and 1.017 au in early July,
- the synodic periods come out at 116, 584, 780 and 399 days for Mercury,
  Venus, Mars and Jupiter,
- Mars turns west on 7 December 2024 and east on 24 February 2025 (within a
  day and a half), with opposition on 16 January 2025 at 180° from the Sun,
- Jupiter's opposition falls on 10 January 2026 and Saturn's on 21 September
  2025, within a day,
- the daily motion is westward only between the stations,
- from 2020 to 2032 each planet loops once per synodic period, the outer
  planets at opposition and the inner ones at inferior conjunction, in front
  of the Sun,
- from Mars outwards each loop lasts longer and covers a shorter arc,
- stations alternate between turning west and turning east,
- seen from the Earth each planet sits at its position minus the Earth's;
  Mars, Jupiter, Saturn and Venus come nearest within eight days of the
  middle of their loops, and Mars came to 0.642 au on 12 January 2025,
- in the Earth's frame the direction to Mars turns backwards exactly as many
  times as it makes loops over three synodic periods,
- dates read and print in UTC, and month ticks fall on the first of each
  month.

## Controls

| Control | Effect |
| --- | --- |
| Watch (<kbd>1</kbd>–<kbd>7</kbd>) | Mercury to Neptune |
| Day | any date from 1800 to 2050 |
| Play (<kbd>Space</kbd>), Play at | run time forward at 2 days to 3 months a second |
| <kbd>←</kbd> <kbd>→</kbd> | a day back or forward (<kbd>Shift</kbd>: 10 days) |
| Last loop, Next loop (<kbd>N</kbd>, <kbd>Shift</kbd>+<kbd>N</kbd>) | jump to the middle of the neighbouring loop |
| Loops near this date | click a loop to jump to its middle |
| Top view (<kbd>E</kbd>) | hold the Sun still, or the Earth |
| Sky strip shows | the loop nearest the date, or the months around it |
| The other planets inside its orbit | show or hide them in the top view |
| Trail | how far back the marks on the sky ring and the planet's track reach |

## Layout

```
index.html        page and controls
style.css
src/orbits.js     elements, Kepler's equation, positions, stations and loops
src/format.js     dates, day counts and motions for the readouts
src/view.js       drawing the top view and the sky strip
src/main.js       animation and interaction
test/             node --test suite
scripts/serve.js  static server for local use
```

## License

MIT
