# quincunx

A Galton board in the browser. Drop balls through rows of pegs, let each
one bounce left or right at every peg, and watch the bins at the bottom
fill into a bell curve.

**Live demo:** https://fushanbobfan.github.io/quincunx/

Francis Galton built the first of these boards in the 1870s and called it
a quincunx, after the five-spot pattern the pegs repeat. A ball that meets
*n* rows of pegs makes *n* independent left-or-right choices, and the bin
it lands in is the number of times it went right. So the bins follow the
binomial distribution, and as the board grows taller that distribution
looks more and more like the normal curve: the central limit theorem,
played out in falling balls.

No build step and no dependencies. The board geometry, the ball paths,
the exact distributions, the fit test, the renderer and the share links
are plain ES modules covered by a Node test suite; only `src/main.js`
touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Drop one ball at a time.** Each bounce is a fair coin toss when the
chance of bouncing right is 0.50. The first dozen balls land almost
anywhere; the shape only shows up after a few hundred.

**Pour, then compare.** The blue ticks mark how many balls each bin
should hold on average, given how many have fallen; the orange curve is
the normal distribution with the same mean and spread. On a 12-row board
the two already sit close together. Drop to 3 rows and the curve is a
poor fit to four lumpy bins; raise to 40 rows and they are hard to tell
apart.

**Tilt the pegs.** Set the chance of bouncing right to 0.15 on a 12-row
board and the pile leans hard to the left, cut off by the wall, with a
long tail to the right: a skewed binomial the normal curve misses. Raise
the rows to 40 with the same tilt and the pile moves away from the wall
and grows much closer to symmetric.

**Watch the fit test.** *Distance from exact* is the total variation
distance: half the summed gap between the share of balls in each bin and
that bin's exact chance. It shrinks roughly like one over the square root
of the number of balls. The chi-square line asks whether the bins could
plausibly come from the exact distribution; on an honest board its
p-value is spread evenly between 0 and 1, so a value under 0.05 turns up
about one run in twenty by chance alone.

## Controls

| Control | What it does |
| --- | --- |
| 1 ball / 10 / 100 | Release that many balls, animated |
| 1000 | Add a thousand balls straight to the bins |
| Pour | Keep releasing balls until stopped |
| Empty bins | Clear the bins and start a fresh random sequence |
| Speed | How fast balls fall, in rows per second |
| Rows | 1 to 40 rows of pegs |
| Chance of bouncing right | The probability of a right bounce at every peg |
| Exact expected counts / Normal curve | Show or hide each overlay |
| Copy link | Copy a link that reopens this board |
| Save PNG | Download the canvas as an image |

Keyboard: <kbd>Space</kbd> pours or stops, <kbd>1</kbd>–<kbd>4</kbd> drop
1, 10, 100 or 1000 balls, <kbd>C</kbd> empties the bins.

## How it works

- **Paths.** A ball's path is one random number per row from a seeded
  generator (mulberry32): below the bias it goes right, otherwise left.
  The bin is the count of right steps, so a share link with the same seed
  replays the same sequence of balls.
- **Motion.** A ball's position is a function of time measured in rows:
  at each whole number it rests on top of a peg, and in between it hops to
  the next one. Balls are released from a queue at intervals so they do
  not pile up at the top, faster when many are waiting, and each one stops
  on the top of its bin's bar.
- **Exact distribution.** The chance of each bin is built row by row:
  every row moves a share *p* of each bin's probability one bin to the
  right. With one bias for every row this is the binomial distribution.
- **Normal curve.** The orange curve is the normal density with mean
  *np* and variance *np(1 − p)*, scaled to the number of balls.
- **Fit test.** Pearson's chi-square test against the exact chances.
  Bins expected to hold fewer than five balls are pooled with their
  neighbours, starting from the tails, so the chi-square approximation
  holds; the p-value comes from the regularised incomplete gamma function.

The tests check the paths and layout, the binomial against its closed
form, the normal and chi-square functions against table values, that the
chi-square test accepts honest boards and rejects tilted ones, that its
p-values on honest boards are roughly uniform, and that every queued ball
lands exactly once.

## References

- Francis Galton, *Natural Inheritance* (1889), which describes the
  apparatus.
- Karl Pearson, "On the criterion that a given system of deviations from
  the probable in the case of a correlated system of variables is such
  that it can be reasonably supposed to have arisen from random sampling",
  *Philosophical Magazine* 50 (1900), 157–175.

## License

MIT
