# syzygy

Why eclipses come in seasons. The Moon passes between the Earth and the Sun
every month, yet a solar eclipse happens only a few times a year. Its orbit is
tilted about 5° to the Earth's, so most new moons pass above or below the Sun
and most full moons miss the Earth's shadow. This page plots every new and full
moon of a year against the window it has to hit, shows the Moon's tilted orbit
from above, and lists the eclipses that result.

**Live demo:** https://fushanbobfan.github.io/syzygy/

No build step and no dependencies. The ephemeris, the eclipse search and the
drawing are plain ES modules covered by a Node test suite; only `src/main.js`
touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **The year at a glance.** The Moon's height above or below the Sun's path
  (its ecliptic latitude) through the year. Solid dots are new moons and
  orange rings full moons; the bar through each is the window it must fall in
  for an eclipse, and the moons that make it are drawn larger. Shaded spans are eclipse seasons, when the Sun is near one end of
  the line where the two orbits cross (the line of nodes). Click to move the
  date.
- **From above.** The Earth on its orbit and the Moon on its own, drawn much
  larger than life. The solid half of the Moon's orbit is above the Earth's
  orbital plane and the dashed half below. Play the year and the line of nodes
  keeps pointing the same way while the Earth goes round, so it points at the
  Sun twice a year.
- **The eclipses.** Date and time of greatest eclipse, the kind (total,
  annular, hybrid or partial for the Sun; total, partial or penumbral for the
  Moon), and how close the Moon passed compared with the limit for an eclipse.
- **Tilt.** Flatten the Moon's orbit and every new and full moon becomes an
  eclipse; tilt it further and eclipses grow rarer.

## How the eclipses are found

1. **Positions.** The Sun and the Moon come from truncated series in Meeus,
   *Astronomical Algorithms* (chapters 25 and 47): about thirty terms each for
   the Moon's longitude and distance and twenty for its latitude.
2. **New and full moons.** Starting from the mean lunation, Newton's method
   finds when the Moon's longitude is that of the Sun (new) or opposite it
   (full).
3. **Closest approach.** A golden-section search finds when the Moon passes
   nearest the Sun's centre (new moon) or the centre of the Earth's shadow
   (full moon); that is the moment of greatest eclipse.
4. **Limits.** The sizes of the Sun, the Moon and the Earth's shadow at that
   moment give the largest miss that still makes each kind of eclipse. The
   shadow is enlarged by 2% for the atmosphere. A central solar eclipse is
   total if the Moon looks larger than the Sun from the nearest point of the
   Earth, and hybrid if it would not from the Earth's edge.

For 2021–2030 this finds all 44 eclipses in NASA's eclipse tables, with the
same type and within five minutes of NASA's time of greatest eclipse, and no
others; the test suite checks every one. Times are shown in UTC using the
Espenak–Meeus estimate of ΔT, held flat outside 2005–2050.

## Numbers behind the seasons

| Quantity | Days | What it is |
| --- | --- | --- |
| Synodic month | 29.5306 | new moon to new moon |
| Draconic month | 27.2122 | the Moon from a node back to the same node |
| Eclipse year | 346.62 | the Sun from a node back to the same node |
| Saros | 6585.32 | 223 synodic months, within an hour of 242 draconic months |

Because the line of nodes turns backwards once every 18.6 years, the Sun meets
it every 346.6 days, so the eclipse seasons come about 19 days earlier each
calendar year.

## License

MIT
