# topple

An Abelian sandpile you can play with in the browser. Every cell of a square
grid holds a few grains of sand; a cell that reaches four grains topples and
hands one grain to each neighbour, which may make them topple in turn. Grains
that fall off the edge are gone.

**Live demo:** https://fushanbobfan.github.io/topple/

No build step and no dependencies.

## Quick start

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## License

MIT
