# florets

Grow a sunflower head in the browser. Each new floret is placed a fixed angle
past the last one; turn that angle and watch the head's spirals appear, count
themselves in Fibonacci numbers, straighten into arms and break apart.

**Live demo:** https://fushanbobfan.github.io/florets/

No build step and no dependencies. The model is a plain ES module covered by a
Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The model

Vogel's model (1979) puts floret *n* at

    radius = c · √n,   angle = n · d

for a divergence angle *d*. The square root gives every floret the same area,
π c², so the head fills evenly as it grows. Everything else on the page
follows from the choice of *d*.

**Spirals.** The eye joins each floret to its nearest neighbours. If floret
*n* + *k* is one of them, the florets *j*, *j* + *k*, *j* + 2*k*, … form one
visible spiral, and there are *k* of them side by side. The page finds the two
nearest index steps that point in different directions (a multiple of the
first lies on the same line and is skipped) and reports them as the spirals at
the rim. At the golden angle they are 55 and 89 for a thousand florets, and the
pair climbs the Fibonacci sequence as the head grows: 8 and 13 near the centre,
89 and 144 by three thousand florets. The two families wind in opposite
directions.

**Continued fractions.** Floret *k* lands close to floret 0's ray when *k · d*
is close to a whole number of turns, which happens when *d* in turns is close
to a fraction *p*/*k*. The best such fractions are the convergents of its
continued fraction, and their denominators are the candidate spiral counts.
The golden fraction 2 − φ = 0.381966… is [0; 2, 1, 1, 1, …]: all ones after
the start, so every convergent is only a modest improvement on the last and
none ever takes over. Its denominators are the Fibonacci numbers.

**Arms and spokes.** At a rational angle *p*/*q* turn the florets sit on *q*
straight spokes with empty wedges between them (144° = 2/5 turn gives 5). An
angle a tenth of a degree off the golden one, such as 137.6° =
[0; 2, 1, 1, 1, 1, 1, 1, 6], has one very good convergent 13/34 hidden behind
the 6; around a thousand florets the head collapses onto 34 curved arms before
recovering further out. The page calls it arms when the nearest neighbour is
much closer than any floret off its line (a gap ratio above 1.8).

**Packing.** The tightest packing readout is the smallest nearest-neighbour
gap anywhere in the head (past the first ten florets), over the gap a perfect
hexagonal lattice with the same area per floret would have. The golden angle
holds about 87% at every size; nearby angles drop as their arms or spokes form.

The Lucas angle, 1/(2 + φ) turn ≈ 99.502°, is [0; 3, 1, 1, 1, …]. Its tail of
ones packs about as well as the golden angle, and its spirals follow the Lucas
numbers 4, 7, 11, 18, 29, 47, 76, 123, …

## Growing from the tip

Vogel's model is handed the angle. A real shoot never is: it makes new
primordia (the buds of leaves or florets) one at a time on the rim of its
growing tip, each where the existing ones inhibit it least, while the older
ones are carried outward. Douady and Couder (1996) showed that this rule alone
picks the angle. The **Grow from the tip** panel runs a version of their iterative model
in `src/growth.js`, with these choices:

- the apex rim is the unit circle; every primordium at distance *d* adds
  1/*d*³ to the crowding at a point of the rim,
- the next primordium goes to the least crowded point (a 720-point scan,
  refined by golden-section search),
- then every primordium moves outward by the drift ratio *G* (r → G·r).

A large drift leaves only the newest primordium near the rim, so the next one
goes straight opposite: the tip alternates at 180°, as grasses do. A young
shoot's tip is narrow and widens as it grows, so the default run eases *G*
down from 3 to 1.05 over 300 primordia. The divergence then falls from 180°
through about 145° and settles within a degree of 137.5°, and the spirals near
the rim climb 2 and 3, then 3 and 5, then 5 and 8. Run at a steady slow drift
of 1.15 from the start, the same rule locks onto a different branch at
101.8°, with 4 and 7 spirals: Lucas numbers, near the Lucas angle.

**Use its angle** carries the settled angle to the flower head. It is the
mean of the last twenty turns, still a fraction of a degree off golden, and a
head built with any fixed angle that far off shows arms by a thousand florets.

## What the tests check

- the golden angle is 360/φ² ≈ 137.50776° and floret *n* sits at radius c √n,
- the golden fraction expands as [0; 2, 1, 1, …] with Fibonacci denominators,
  rational angles have finite expansions, and convergents close in from
  alternating sides,
- the contact spirals of a golden head are consecutive Fibonacci numbers that
  climb with the radius (55 and 89 at floret 1000), wound in opposite
  directions,
- 2/5 and 3/8 of a turn give 5 and 8 spokes, 137.6° gives 34 arms at a
  thousand florets, and the Lucas angle gives consecutive Lucas numbers,
- over 1500 florets the golden angle packs better than 137.3°, 137.45°,
  137.5°, 137.55°, 137.6° and 99.5°, and mirroring the angle keeps the packing,
- at the tip, a lone primordium sends the next one to the opposite side, and
  two a quarter turn apart send it opposite their midpoint,
- a steady drift of 6 alternates at 180°; easing from 3 to 1.05 settles within
  1° of the golden angle with Fibonacci spirals 2, 3 → 3, 5 → 5, 8; a steady
  1.15 settles near 101.8° with spirals 4 and 7.

## Controls

| Control | Effect |
| --- | --- |
| Preset, Angle, Degrees | set the divergence angle; ← → on the head turn it by 0.01° (Shift 0.1°, Alt 0.001°) |
| Florets | 50 to 4000 florets |
| Grow (<kbd>Space</kbd>) | grow the head from the centre outward |
| Golden (<kbd>G</kbd>) | back to the golden angle |
| Click a floret | trace the two spirals through it, inward and outward |
| Colour | stripes along one spiral family, a sunflower, or order of birth |
| Draw both spiral families (<kbd>L</kbd>) | join every floret to its neighbours in the two rim families |
| Number the florets | label each floret with its index (up to 600 florets) |
| Save as PNG | download the picture |
| Start from, Drift at the start / end, Primordia | set up a run at the shoot tip |
| Grow the tip | run it, with a chart of every turn against 180°, 137.5° and 99.5° |
| Use its angle | build the flower head with the angle the tip settled on |
| Show | switch the picture between the flower head and the shoot tip |

## Layout

```
index.html        page and controls
style.css
src/phyllo.js     the model: positions, continued fractions, spirals, packing
src/growth.js     the shoot tip: crowding, least crowded spot, drift
src/tip-view.js   drawing the tip and the divergence chart
src/main.js       drawing and interaction
test/             node --test suite
scripts/serve.js  static server for local use
```

## License

MIT
