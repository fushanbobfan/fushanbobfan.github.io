# fivefold

Penrose tilings in the browser. Start from a sun or a star, cut every tile
into smaller copies of the two Penrose shapes, and repeat until the plane is
covered by a pattern that never repeats.

**Live demo:** https://fushanbobfan.github.io/fivefold/

Both classic tile sets are here: Penrose's kites and darts, and his thick
and thin rhombi. The counts panel shows the ratio of the two tiles closing
in on the golden ratio, φ = 1.618…, one generation at a time.

No build step and no dependencies. The substitution rules, the view, the
colouring, the renderer, the counts and the share links are plain ES
modules covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Watch a sun grow.** Pick *Kites and darts*, seed *Sun*, *Whole patch*,
and step from generation 0 with *Finer +*. Five kites become a ring of
kites and darts, and every later step cuts each tile again. Suns and
stars, the two ways five tiles can meet round a point, keep reappearing
at every scale.

**Count the tiles.** The sun of five kites becomes 10 kites and 5 darts
after one step, then 25 kites and 15 darts, and by generation 10 the
patch ratio agrees with φ to seven decimal places. The counts are
Fibonacci numbers, because a half kite turns into two half kites and a
half dart, and a half dart into one of each.

**Colour by direction.** Every tile points in one of ten directions 36
degrees apart. Colouring by direction shows the fivefold symmetry of the
sun and star seeds, and how each direction is spread evenly over the
plane.

**See the larger tiles.** Turn up *Outline tiles* to draw the tiles from
one, two or three generations back over the current ones. Each outline is
a tile of the coarser tiling, cut exactly into the small tiles inside it,
which is the self-similarity that makes the pattern unable to repeat.
Small tiles that an outline runs through are made of two halves cut from
neighbouring larger tiles.

**Print it.** *Save PNG* and *Save SVG* render the current view at the
print size you choose; the SVG has one path per colour, ready for a
plotter or a laser cutter.

## Controls

| Control | What it does |
| --- | --- |
| Tiles | Kites and darts (Penrose's P2 set) or thick and thin rhombi (P3). |
| Seed | *Sun* or *Star*: the patch the substitution starts from. |
| Generation | How many times every tile has been cut, from 0 to 11. Tiles shrink by φ each time. |
| View | *Fill the frame* zooms in until the patch covers the canvas; *Whole patch* shows its outline. |
| Zoom | Magnifies about the centre, up to 8×. Only tiles near the view are grown, so zooming in keeps deep generations quick. |
| Colouring | By tile, by the direction each tile points, or outlines only. |
| Outline tiles | Draws the tiles from 1–3 generations back over the current ones. |
| Palette, line weight | Four palettes; outlines thin out with the tiles and disappear when tiles are a few pixels across. |

Keyboard, with the tiling focused: <kbd>+</kbd> and <kbd>−</kbd> step the
generation, <kbd>T</kbd> switches tile set, <kbd>S</kbd> switches seed,
<kbd>C</kbd> cycles the colouring and <kbd>O</kbd> steps the outlines.

*Copy link* puts every setting in the address, so the same tiling opens
for anyone who follows it.

## How it works

Each Penrose tile is two mirror-image Robinson triangles: a golden
triangle (angles 36°, 72°, 72°) or a golden gnomon (36°, 36°, 108°). A
kite is two golden triangles joined along its axis, a dart two gnomons;
a thin rhombus is two golden triangles joined along their base, a thick
rhombus two gnomons.

Substitution cuts every triangle into smaller golden triangles and gnomons
scaled down by φ, at points that divide its sides in the golden ratio. The
rules in `src/tiling.js` are checked by the test suite for every seed:

- every triangle keeps exactly the golden proportions at every generation;
- the total area never changes and no two triangles overlap;
- at every corner inside the patch the angles add up to a full turn, so
  there are no gaps or cracks;
- every half finds its mirror partner across its seam, except at the rim
  of the patch;
- the triangle counts follow the substitution matrix, and their ratio
  tends to φ.

Whole tiles are put back together by matching each half to the half that
shares its seam (the axis for kites and darts, the base for rhombi).
Halves whose partner would lie outside the seed's outline are drawn as
halves; in *Fill the frame* they are always outside the canvas.

## Accessibility

Every control is a native form element with a label. The canvas is
focusable, has keyboard shortcuts, and carries a text description of the
current tiling; the status line under it is announced when it changes.
Light and dark page themes follow the system setting.

## Licence

MIT
