# moire

Moiré patterns in the browser. Two printed transparencies lie on a light box:
bars, rings or dot screens. Turn or stretch the top sheet a little and broad
bands appear that are on neither sheet, swinging and spreading far more than
the sheet itself moved.

**Live demo:** https://fushanbobfan.github.io/moire/

No build step and no dependencies. The grating model, the renderer and the
fringe predictions are plain ES modules covered by a Node test suite; only
`src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **Two sheets.** Each has a pattern (bars, rings or dots), a spacing, a turn
  and an ink width. Drag the view to slide a sheet; with the view focused,
  arrow keys slide it a pixel at a time and `[` `]` turn the top sheet by
  0.1°.
- **The readout.** Under the view, a sentence says what the two sheets should
  show: the fringe spacing and direction for bars, harmonic beats included,
  how far the fringes travel when the top sheet slides one pixel, the cell
  size of the beat lattice for dots, and the fringe count between two ring
  centres.
- **Predicted fringes.** A checkbox draws the centres of the bright fringes
  from the formulas, on top of the rendered sheets.
- **Squint.** A blur a little wider than one mark washes out the fine pattern
  and leaves only the slow beat.
- **Links.** The address bar always describes the current view: both sheets,
  the scene and the display options. "Copy link" puts it on the clipboard, and
  opening the link restores the same two sheets.
- **Scenes.** Turned gratings, a vernier, bars at almost double the spacing,
  two ring centres, rings in rings, rings over bars, and two kinds of dot
  screen.

## How it works

A grating is described by its spatial frequency: an arrow across its marks,
one over the spacing long. Where two sheets overlap, the product of their
transmissions contains a term at the difference of their frequencies, and that
slow term is the fringe pattern. Two equal gratings turned by θ give fringes
spaced p / (2 sin θ/2); parallel gratings with spacings a and b give
ab / |a − b|.

Bars are square waves, so each sheet also carries harmonics at 2, 3, 4 times
its own frequency, the m-th with amplitude 2·sin(π·m·d)/(π·m) for ink width d.
Every pair m·fA − n·fB up to the fourth order is a candidate beat, with
contrast half the product of the two amplitudes; the readout and the fringe
trace use the highest-contrast beat that is at least twice as wide as the
coarser bars. That is how bars 8 px and 15.6 px apart, whose own beat is a
16.4 px blur, still show fringes 312 px apart.

For rings the local frequency changes from place to place, and
both the difference and the sum of the two phases can be slow, so the fringe
phase takes whichever is slower at each point. With equal spacings these are
hyperbolas to the sides of the centres and ellipses between them.

Each device pixel's ink is the sheet's square wave averaged across the marks
over the pixel's width, which keeps the pattern the sheets make with the
screen's own pixel grid faint next to the moiré being shown. The tests check
the predictions against the renderer: render two sheets, blur them, and compare the remaining
brightness with the predicted fringe phase.

## Layout

```
index.html        page markup
style.css         layout and theme
src/gratings.js   sheet model: phase, pixel coverage
src/render.js     ink per pixel, light-box compositing, box blur
src/moire.js      fringe spacing, direction and phase for each pair of sheets
src/readout.js    plain-language account of the fringes
src/scenes.js     preset pairs of sheets
src/permalink.js  the view as a link fragment
src/main.js       canvas, controls and interaction
test/             Node test suite
```

## License

MIT
