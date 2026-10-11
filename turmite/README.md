# turmite

Langton's ant and its relatives in the browser. An ant sits on a grid of
coloured cells. At each step it reads the colour under it, turns left or
right as the rule says for that colour, repaints the cell with the next
colour and steps forward. That is the whole program, and it still produces
ten thousand steps of chaos followed by a perfectly regular highway.

**Live demo:** https://fushanbobfan.github.io/turmite/

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).
