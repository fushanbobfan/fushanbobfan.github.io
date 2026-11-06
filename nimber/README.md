# nimber

Two players take turns removing stones from one pile at a time, and whoever
takes the last stone wins. Play it against a computer that never slips, then
colour the stones by block and see the rule it follows: hand over a position
where every block size appears an even number of times.

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

## How it is checked

- `src/nim.js` decides positions by Bouton's rule. The tests compare that
  verdict, and the full list of winning moves, against exhaustive search in
  normal and misère play.
- `src/match.js` plays a whole game as plain data. The tests play it out: the
  computer wins all 400 dealt positions it holds as won against a random
  opponent, in both rules, and loses every position lost for it to perfect play.

## References

- C. L. Bouton, "Nim, a game with a complete mathematical theory", *Annals of
  Mathematics*, 1901.

## License

MIT
