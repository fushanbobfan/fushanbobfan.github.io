# peal

Change ringing in the browser. In an English bell tower each ringer handles
one bell, and the bells strike one after another in a row. From one row to the
next, bells only swap places with a neighbour, and a band tries to ring a long
sequence of rows without repeating any. peal prints a method's rows the way a
ringer's diagram does, draws the path of the bell you follow, and rings it.

**Live demo:** https://fushanbobfan.github.io/peal/

No build step and no dependencies. The ringing rules, timing and layout live in
plain ES modules covered by a Node test suite; only `src/main.js` touches the
page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What it shows

- **The method sheet.** The plain course, one lead per column. The row at the
  foot of each column is the lead head, repeated at the top of the next.
- **A bell's line.** Pick any bell to follow; its path is drawn in blue and the
  treble's in red. Numbers can be hidden to leave only the lines and the lead
  heads, which is how ringers often learn a method.
- **Ringing.** Press Ring to hear the course at a chosen pace, quoted as the
  hours a full peal of 5040 rows would take. Rows alternate handstroke and
  backstroke, with a one-blow gap before every handstroke. The sheet marks the
  bell striking.
- **Your own method.** Type a number of bells and a lead of place notation.
  peal rings it until rounds comes back, or stops at 5040 rows, and reports
  whether any row came twice.

## Methods

| Method | Bells | Rows in a lead | Plain course |
| --- | --- | --- | --- |
| Plain Hunt Doubles | 5 | 10 | 10 |
| Plain Hunt Minor | 6 | 12 | 12 |
| Plain Bob Doubles | 5 | 10 | 40 |
| Grandsire Doubles | 5 | 10 | 30 |
| Stedman Doubles | 5 | 12 | 60 |
| Plain Bob Minor | 6 | 12 | 60 |
| Cambridge Surprise Minor | 6 | 24 | 120 |
| Plain Bob Major | 8 | 16 | 112 |
| Grandsire Triples | 7 | 14 | 70 |
| Cambridge Surprise Major | 8 | 32 | 224 |

The tests ring each one and check these lengths, the first lead head
(135264 for Plain Bob Minor, 156342 for Cambridge Surprise Minor, and so on),
that no row repeats, that no bell ever moves more than one place, and that each
hunt bell repeats its path every lead.

## Place notation

Each change lists the places that stay put; every other bell swaps with its
neighbour. `x` (or `-`) swaps every pair. Places at the front or back may be
left out when they are forced: `1` on six bells is read as `16`, and `4` as
`14`. A change that leaves an odd number of bells between two places, such as
`13`, is refused.

`x16x16x16,12` is the short form most method collections use: each side of the
comma is a palindrome, rung forwards and back without repeating its middle
change. `&x1x1x1+2` is the same idea with `&` marking the palindrome and `+`
a part read as written. A plain list such as `3.1.5.3.1.3.1.3.5.1.3.1` is read
as written.

## Sound

Each bell is a sum of seven sine partials at the ratios of a tuned church bell:
hum and prime two and one octaves below the strike note, a tierce a minor
third above the prime, the quint, the strike note itself and two partials above
it, with the lower ones ringing longest. The bells are tuned to a major scale
with the tenor as its keynote: six bells run from doh up to lah, eight make a
full octave.

## Files

- `src/changes.js`: rows, place notation, the plain course and repeated rows.
- `src/methods.js`: the method library.
- `src/striking.js`: when each blow falls, peal speed, tuning and partials.
- `src/sheet.js`: the layout of the method sheet.
- `src/main.js`: drawing, sound and input.

## License

MIT
