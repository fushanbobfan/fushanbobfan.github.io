# glide

Draw with the 17 wallpaper groups. Pick a plane symmetry group, draw a stroke
anywhere, and it is repeated by every rotation, mirror and glide reflection of
that group across the whole canvas.

**Live demo:** https://fushanbobfan.github.io/glide/

No build step and no dependencies. The groups and the tiling are plain ES
modules covered by a Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The seventeen groups

A wallpaper pattern repeats along two independent directions, so its
symmetries contain a lattice of translations. Up to those translations only
finitely many symmetries remain, and in 1891 Fedorov showed that there are
exactly seventeen ways for them to fit together.

| Lattice | Groups (orbifold symbol) |
| --- | --- |
| Oblique | p1 (o), p2 (2222) |
| Rectangular | pm (\*\*), pg (××), cm (\*×), pmm (\*2222), pmg (22\*), pgg (22×), cmm (2\*22) |
| Square | p4 (442), p4m (\*442), p4g (4\*2) |
| Hexagonal | p3 (333), p3m1 (\*333), p31m (3\*3), p6 (632), p6m (\*632) |

The first name is the crystallographers' (International Tables) symbol. The
second is Conway's orbifold symbol: a digit n is a centre of n-fold rotation,
digits after a `*` are rotation centres lying on mirrors, `*` alone is a mirror,
`×` is a glide reflection that is not a mirror, and `o` means translations only.

Each group is written in `src/groups.js` the way the International Tables list
it: a handful of maps (x, y) → M(x, y) + t in coordinates of the conventional
cell, with integer matrices M. The centred groups cm and cmm add the centring
vector (½, ½). The tests check that

- each group has its standard number of operations per cell,
- the operations close under composition and have inverses, modulo lattice
  translations,
- every operation is an isometry of its lattice,
- the groups with `*` in their orbifold symbol are exactly those with a true
  mirror, while pg and pgg have glides only,
- the largest rotation order matches the largest digit of the symbol,
- p3m1 has a mirror through every threefold centre and p31m does not.

## Symmetry elements

**Show the symmetry elements** (<kbd>E</kbd>) draws what each group is made
of over the pattern, computed from the operations in `src/elements.js`:

- a rotation x → Mx + t turns about the point c with (I − M)c = t, marked by
  the largest order of rotation about it: a lens for 2, a triangle for 3, a
  square for 4 and a hexagon for 6;
- a reflection x → Ax + w fixes the line through (w − Aw)/4 along its axis and
  slides along it by (w + Aw)/2. The line is drawn solid when that slide is a
  lattice vector, so some symmetry reflects in it without sliding (a mirror),
  and dashed otherwise (a glide line).

The tests check the standard counts of rotation centres per cell, the mirror
and glide lines of pm, pg and cm, the number of mirror directions in p4m, p4g,
p6m and pgg, and, for all 17 groups, that the orbits of rotation centres give
exactly the digits of the orbifold symbol.

## Drawing

A stroke is stored in lattice coordinates, moved by a whole lattice vector so
it starts in the unit cell, and drawn once for every operation of the group
and every lattice translation that can bring it into view (`src/tiling.js`).
Because strokes live in lattice coordinates, changing the side ratio or the
angle of a rectangular or oblique cell reshapes the drawing with the lattice.

| Control | Effect |
| --- | --- |
| Symmetry | choose one of the 17 groups, grouped by lattice |
| Pen | colour and width of the next stroke |
| Undo / Clear | <kbd>Ctrl</kbd>+<kbd>Z</kbd> removes the last stroke |
| Cell size | zoom the pattern |
| Side ratio, cell angle | reshape rectangular and oblique cells |
| Show the unit cell | dashed outline of one cell (<kbd>C</kbd>) |
| Show the symmetry elements | rotation centres, mirrors and glide lines (<kbd>E</kbd>) |
| Draw only the original strokes | hide the copies to see what was actually drawn |
| Save as PNG | download the current picture |

## Layout

```
index.html        page and controls
style.css         layout
src/groups.js     the 17 groups, lattice bases, coordinate changes
src/tiling.js     copies of a stroke that reach the view
src/elements.js   rotation centres, mirrors and glide lines
src/main.js       canvas drawing and input
test/             node --test suites
scripts/serve.js  dependency-free static server
```

## License

MIT
