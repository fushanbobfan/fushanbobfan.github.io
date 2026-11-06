# nimber

Two players take turns, and whoever cannot move loses. Play Nim, the Kayles
family of pin games and Wythoff's queen against a computer that never slips, and
see the number hidden in every position: why balanced piles win, why each run of
pins plays like a Nim pile, and how the golden ratio ends up deciding a game
of stones.

**Live demo:** https://fushanbobfan.github.io/nimber/

No build step and no dependencies. The rules are plain ES modules covered by a
Node test suite; only `src/main.js` and the view modules touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## Piles

- Pick a stone: it and every stone above it leave the pile. Arrow keys move
  between stones, and Enter or Space takes them.
- **Colour stones by block** splits each pile into blocks of 8, 4, 2 and 1 and
  underlines the block sizes held an odd number of times.
- **Show the binary table** lists the same thing as columns of bits with the
  nim-sum below.
- **Hint** shows a winning move, or says that the position has none.
- After a game, the move list marks where a player holding a won game let it go.
- The next game can start from 3, 4, 5, a random position, a position won for
  the first player or one lost for the first player. The last stone can win or
  lose (misère). The computer can always play a winning move, or only some of
  the time.
- **Copy link** shares the starting position, the rule and who moved first.

## Rows

- Four games on a row of pins: Kayles (octal code 0.77), Dawson's Kayles (0.07),
  Dawson's Chess (0.137) and Officers (0.6). Pins and the gaps between them are
  buttons; each game's rule is written above the board.
- **Show each run as a Nim pile** replaces the row's runs with their nimbers and
  gives the nim-sum.
- The wall below the board shows the nimber of every run length. Set the cells
  per line to a game's period and the repeating part falls into straight
  columns, with the exceptions marked. Clicking a cell sets up a row of that length.

## Queen

- A queen on a quarter board moves left, down or diagonally toward the corner, and
  whoever reaches the corner wins. This is the same game as two piles where you
  take from one, or the same number from both. Click a shaded square, or use the
  arrow keys and Enter.
- **On the board** can mark the cold squares or print each square's nimber.
- **Finding the cold squares by hand** steps through the rule itself: each cold
  square shades its row, column and diagonal, and the first square left over is the
  next. A table beside it shows the column divided by k closing in on the golden ratio.
- **Every nimber at once** maps a board of 256 by 256 squares, and switches to Nim's
  two-pile table so the effect of the diagonal move can be compared.

## How it is checked

- `src/nim.js` decides positions by Bouton's rule. The tests compare that
  verdict, and the full list of winning moves, against exhaustive search in
  normal and misère play.
- `src/match.js` plays a whole game as plain data. The tests play it out: the
  computer wins all 400 dealt positions it holds as won against a random
  opponent, in both rules, and loses every position lost for it to perfect play.
- `src/octal.js` computes nimbers from the digits of the octal code. The tests
  match the values and exceptions listed in OEIS A002186 (Kayles) and A002187
  (Dawson's Chess, whose shift is Dawson's Kayles), and the first Officers values in
  Flammenkamp's table. For every position of a 12-pin row, the nimbers agree with
  exhaustive search, and every legal move can be made by a click.
- `provePeriod` applies Guy and Smith's test to the table: 71 and 12 for Kayles,
  52 and 34 for Dawson's Chess, 53 and 34 for Dawson's Kayles, nothing through 1500
  for Officers.
- `src/wythoff.js` is compared with OEIS A004481, the table of Wythoff nimbers. On
  the 256 by 256 board, the golden-ratio formula marks exactly the squares worth 0.
  The sieve finds the same squares as the formula, and the two coordinates use
  each whole number from 1 to 1999 exactly once.

## References

- C. L. Bouton, "Nim, a game with a complete mathematical theory", *Annals of
  Mathematics*, 1901.
- R. K. Guy and C. A. B. Smith, "The G-values of various games", *Proc. Cambridge
  Philos. Soc.* 52, 1956.
- W. A. Wythoff, "A modification of the game of nim", *Nieuw Archief voor Wiskunde*, 1907.
- A. Flammenkamp, tables of octal games:
  https://wwwhomes.uni-bielefeld.de/achim/octal.html

## License

MIT
