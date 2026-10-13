# dotwork

Stippling in the browser. Scatter a few thousand dots where a picture is
dark, then repeatedly move each dot to the ink-weighted centre of the patch of
page closest to it. The dots push each other into an even, unclumped spacing
whose density follows the picture, so spacing alone draws the image. Once they
settle, one unbroken line can be threaded through every dot.

**Live demo:** https://fushanbobfan.github.io/dotwork/

No build step and no dependencies. The density field, the Voronoi labelling,
the relaxation, the line and the SVG writer are plain ES modules covered by a
Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).

## How it works

**Ink density.** A picture becomes one value per pixel in [0, 1]: Rec. 709
luma read as darkness, so black is full ink and white is paper. Brightness,
contrast, gamma and invert reshape the tone, and anything below the
"leave blank" level is set to exactly zero so pale paper stays empty.

**Seeding.** Dots start by rejection sampling: pick a random pixel and keep
it with probability proportional to its ink. This already puts dots in the
right places, but they clump and leave gaps like any random scatter.

**Weighted Lloyd relaxation.** This is Adrian Secord's weighted Voronoi
stippling (NPAR 2002). Each round labels every inked pixel with its nearest
dot, which gives the Voronoi cells, and moves each dot to the ink-weighted
centroid of its cell. In dark regions a cell's centroid sits close to its dot
and cells stay small; in pale regions cells grow. Repeating this drives the
dots towards a centroidal Voronoi tessellation, with blue-noise spacing and
local density that follows the ink.

The nearest-dot search buckets the dots into a grid of about one dot per
bucket and walks outward ring by ring, stopping once no unvisited bucket can
hold anything closer. Blank pixels are skipped entirely: they contribute
nothing to any centroid, and they are where searches run longest.

The run stops by itself when the mean move per round drops below 0.04% of
the typical dot spacing. The small chart under the page shows that mean
move on a log scale, with the stopping level as a faint line.

**Dot size.** *All the same* gives every dot one radius, chosen so the dots
ink the picture's mean density. *Grows with the ink in its cell* makes each
dot's area equal the ink its cell holds, so the inked share of the page
matches the picture's (apart from overlap) and dark regions read darker.

**One line.** The *One line* view threads a closed tour through the dots, in
the spirit of Kaplan and Bosch's TSP art (Bridges 2005). It starts from a
greedy nearest-neighbour walk and then applies 2-opt moves from each dot's
eight nearest neighbours, reversing a stretch of the tour whenever joining
two pairs of dots the other way round shortens the line. The 2-opt pass runs
a slice per frame so the page stays responsive, and the status line reports
the length in page widths.

## Controls

| Control | What it does |
| --- | --- |
| Picture | Five built-in pictures drawn from formulas, or your own image (button or drag and drop). Your image stays in the page. |
| Working size | Long side of the grid the dots live on. Larger keeps finer detail and runs slower. |
| Tone | Brightness, contrast, gamma, a blank-paper level and invert. Changes keep the current dots and relax them onto the new tone. |
| Dots | How many, how their size is chosen, and a size multiplier. Pause or reseed. |
| Show | Dots, the Voronoi cells, one line, or the picture itself, in four colour schemes. |
| Keep | Save SVG (dots as circles, or the line as one path), save PNG, or copy a link with the current settings. |

Keys: <kbd>Space</kbd> runs or pauses, <kbd>R</kbd> reseeds, <kbd>L</kbd>
switches to the line.

## Probe

`scripts/probe.js` runs the same code without a browser and prints how the
dots settle:

```bash
node scripts/probe.js spiral 6000 --rounds 40 --line --svg spiral.svg
```

It takes a picture name, a dot count, `--rounds`, `--size` (working size in
pixels), `--line` to build and shorten the tour, and `--svg` to save the
result.

## Code layout

| File | Role |
| --- | --- |
| `src/density.js` | Ink density fields, image reading, tone controls, resampling |
| `src/sources.js` | Built-in pictures drawn from formulas |
| `src/voronoi.js` | Bucket grid and nearest-dot labelling of pixels |
| `src/lloyd.js` | Seeding, cell sums and one relaxation round |
| `src/dots.js` | Dot radii and page coverage |
| `src/tour.js` | Greedy tour, neighbour lists and 2-opt |
| `src/svg.js` | SVG output for dots and the line |
| `src/render.js` | Pixel layers for the picture and cell views |
| `src/settings.js` | Shareable settings, ranges and the link format |
| `src/main.js` | The page: loop, drawing, controls, upload and export |

## References

- Adrian Secord. *Weighted Voronoi Stippling.* NPAR 2002.
- Stuart Lloyd. *Least squares quantization in PCM.* IEEE Transactions on Information Theory, 1982.
- Craig S. Kaplan and Robert Bosch. *TSP Art.* Bridges 2005.

## Licence

MIT. See [LICENSE](LICENSE).
