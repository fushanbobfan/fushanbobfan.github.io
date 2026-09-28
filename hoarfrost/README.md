# hoarfrost

Grow snow crystals in the browser. A hexagonal grid of cells trades water
vapour with its neighbours; cells that collect enough freeze, and the frozen
edge reaches out into the vapour around it. Two numbers, the vapour density
far from the crystal and how much the edge captures from the air, decide
whether you get six needles, a fern, a branching star or a solid hexagonal
plate.

**Live demo:** https://fushanbobfan.github.io/hoarfrost/

No build step and no dependencies. The grid, the growth model, the screen
layout, the colours and the parameter handling are plain ES modules covered
by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

- The page opens on a **stellar dendrite**. Switch *Colour by* to *Growth
  rings* after it finishes: dark ice froze first, bright ice last, so you can
  read how the arms and branches raced each other.
- Load **Six needles** and then **Fern**. Both add almost no vapour at the
  edge; the difference is the background vapour β. Dense vapour feeds the tips
  so fast that they never branch.
- Starting from **Fern**, drag *Vapour added γ* up a notch at a time. Side
  branches thicken into the broad arms of the **stellar dendrite**, then fill
  in towards the **broad star** and finally the **hexagonal plate**.
- Try *Vapour field* while a dendrite grows. The vapour is used up in the
  hollows between the arms while the tips reach out into richer air, so tips
  keep winning: the Mullins–Sekerka branching instability, in a few lines of
  arithmetic.
- *Ice thickness* shows how much water each ice cell has gathered since it
  froze. The oldest ice, along the middle of each arm, is the thickest.
- **Copy link** saves the current settings in the address; **Save PNG** keeps
  the picture.

## How it works

The model is Clifford Reiter's local cellular model of snow crystal growth.
Every cell *z* holds a real number *s(z)*, the water it contains. A cell with
*s* ≥ 1 is ice. A cell is **receptive** if it is ice or touches ice.

Each step splits the field into two parts: *v* = *s* on receptive cells and 0
elsewhere, and *u* = *s* on the other cells and 0 on receptive ones. Then:

1. receptive cells gain a constant: *v* ← *v* + γ;
2. the non-receptive part diffuses: *u* ← *u* + (α / 2)(*ū* − *u*), where *ū*
   is the mean of *u* over the six neighbours;
3. the parts recombine: *s* = *u* + *v*.

Because *u* is zero on receptive cells, step 2 also moves vapour *into* the
cells at the edge of the crystal, where it stays. Cells on the outer ring of
the grid are held at β, standing in for the vapour far away. The crystal
starts as a single ice cell in a field of β, and growth stops when ice comes
within two cells of the outer ring.

Rewriting step 2 as *u* + (α / 12)(Σ neighbours − 6*u*) shows it is an
explicit step of the heat equation on the hexagonal lattice, with α setting
the diffusion rate.

**What the numbers do.** β is the background vapour: thin air starves the
crystal and favours slow, branching growth; dense air feeds it quickly. γ is
vapour the edge picks up regardless of diffusion: as it grows, the edge
advances more evenly and the crystal fills in from dendrite towards plate. The
presets were chosen by sweeping β and γ with α = 1.

**Symmetry.** The model has no randomness and every rule treats the six
directions alike, so the crystal keeps the twelve symmetries of the hexagon
(six rotations, six reflections). The tests check this cell by cell.

**Drawing.** Cells are flat-topped hexagons, so one arm points straight up.
Each pixel of the canvas is mapped to the cell under it once, then every frame
is a lookup from cell colours to pixels.

**Limits.** This is a two-dimensional, phenomenological model. β, γ and α
are dimensionless and do not map onto a particular temperature or
supersaturation, and real snowflakes owe much of their variety to changing
conditions during their fall, which a fixed β and γ do not capture.

## Controls

| Control | Effect |
| --- | --- |
| Start from | load a named crystal |
| Diffusion α, background vapour β, vapour added γ | model parameters; changes restart the crystal |
| Grid radius | cells from the centre to the edge of the grid (40–240) |
| Colour by | growth rings, ice thickness or the vapour field |
| Steps per frame | how fast the crystal grows on screen |
| <kbd>Space</kbd> / <kbd>N</kbd> / <kbd>R</kbd> | pause and resume / one step / restart |

The γ slider is logarithmic, from 0 at the far left through 10⁻⁵ up to 0.4.

## Layout

```
index.html        page shell
style.css         styles
src/hexgrid.js    hexagonal patch, neighbour tables, rotations and reflections
src/reiter.js     the growth model
src/layout.js     hexagon geometry and the pixel-to-cell map
src/palette.js    colour modes
src/params.js     parameter ranges, slider scales and link format
src/presets.js    named crystals
src/main.js       animation, controls and export
test/             node:test suites
```

## Reference

C. A. Reiter, “A local cellular model for snow crystal growth”, *Chaos,
Solitons & Fractals* 23 (2005) 1111–1119.

## License

MIT
