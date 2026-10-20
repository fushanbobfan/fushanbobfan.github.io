# orbium

Lenia in the browser. Lenia is a cellular automaton with smooth states,
smooth neighbourhoods and smooth time, and under the right rule it grows
creatures: discs that glide, bodies that swim in loops, shapes that hold their
ground. Load one of seven creatures from Bert Chan's catalogue, drop more of
them into the world, paint food for them, or start from random noise and
retune the rule while it runs.

**Live demo:** https://fushanbobfan.github.io/orbium/

No build step and no dependencies. The FFT, the rule, the world, the pattern
codec, the creatures, the colour maps and the share-link format are plain ES
modules covered by a Node test suite; only `src/main.js` touches the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## How Lenia works

Every cell holds a value A between 0 and 1. Each step, every cell does two
things:

1. **Sense.** It takes a weighted average U of its neighbourhood. The weights
   form a kernel K: a smooth ring of radius R (or up to four nested rings of
   given heights), normalised to sum to 1. So U = K ∗ A.
2. **Grow.** It looks U up in the growth function
   G(U) = 2 exp(−(U − μ)² / 2σ²) − 1, which is +1 when U is exactly μ and
   falls to −1 away from it, then moves by A ← clip(A + G(U) / T, 0, 1).

R sets the size of creatures, T how finely time is sliced, μ the
neighbourhood density a cell likes, σ how fussy it is about it. A glider
is a shape whose own sensed field keeps regrowing its front and eating away
its back.

The convolution runs as a product of Fourier transforms on the torus, so
every step costs the same whatever the kernel radius.

## The page

- **Creature**: pick a species and a scale. "Load alone" clears the world and
  puts one in the middle; the scale multiplies both the pattern and R, so the
  creature behaves the same, only larger. "Random soup" scatters seeded noise
  patches under the current rule.
- **Tool**: click the world to place the selected creature, or paint and
  erase with a soft brush.
- **Rule**: R, T, μ, σ and the ring heights change live, so you can see how
  far a creature tolerates a change to its rule. "Use the species' rule" puts
  the original back.
- **View**: the cells A, the sensed field U (drawn up to 2μ so the growth
  band sits mid-scale), or the growth G(U), blue where cells shrink and warm
  where they grow.
- **Keep**: a share link restores the species, scale, grid, rule, view and
  soup seed. PNG saves the current frame.

Keys: Space plays or pauses, S steps once, C clears. With reduced motion
requested, the page opens paused.

## The creatures

| Species | Code | R | μ | σ | Rings | Motion |
| --- | --- | --- | --- | --- | --- | --- |
| Orbium unicaudatus | O2u | 13 | 0.15 | 0.015 | 1 | glides |
| Gyrorbium gyrans | OG2g | 13 | 0.156 | 0.0224 | 1 | circles |
| Scutium solidus | S1s | 13 | 0.29 | 0.045 | 1 | glides |
| Paraptera arcus labens | P4al | 13 | 0.347 | 0.057 | 1 | glides |
| Helicium solidus | H3s | 13 | 0.35 | 0.06 | 1 | stays |
| Kronium solidus | K4s | 18 | 0.24 | 0.029 | 1, 1/3 | glides |
| Echinium solidus | 3Es | 18 | 0.226 | 0.0272 | 3/4, 1, 1/2 | glides |

All use T = 10. The motion column is checked by `test/species.test.js`:
each creature runs alone, must keep its mass within 15% of where it started,
and must glide (net travel close to its path length), circle (long path, little
net travel) or stay (centre of mass nearly still).

`npm run probe` runs them headless and prints mass, travel and step time.
Pass a species, step count, grid size and scale to probe one:

```bash
node scripts/probe.js kronium 1000 256 2
```

## Code layout

| File | What it does |
| --- | --- |
| `src/fft.js` | Radix-2 complex FFT, 1D and 2D |
| `src/rules.js` | Kernel rings, growth function, ring-height parsing |
| `src/world.js` | The torus, the step, placement, mass and centroid |
| `src/rle.js` | Lenia's run-length pattern text |
| `src/species.js` | The creature catalogue |
| `src/patterns.js` | Species lookup, scaling and zoom |
| `src/seed.js` | Seeded soups and the brush |
| `src/render.js` | Colour maps and field painting |
| `src/settings.js` | Settings and share links |
| `src/main.js` | The page |

## Credits

Lenia and every creature here come from Bert Chan's
[Lenia](https://github.com/Chakazul/Lenia) project; the patterns and their
rules are copied from its animal catalogue under the MIT License (notice in
`LICENSE`). The code in this repository is MIT licensed.
