# suitors

Stable matching in the browser. Two groups, everyone ranking everyone on the
other side. One side proposes, the other holds the best offer it has had so
far, and the pairing that falls out is stable: no two people would both rather
be with each other than with the partners they got. Step through the proposals
one at a time, then switch which side proposes and see who gains.

**Live demo:** https://fushanbobfan.github.io/suitors/

No build step and no dependencies. The algorithm, the board drawing and the
comparison are plain ES modules covered by a Node test suite; only
`src/main.js` touches the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## What is on the page

- **The board.** Each person's preference list sits beside them, best first,
  as the initials of the other side. A green line is an offer being held. The
  latest proposal is shown as a dashed red line when it is turned away and a
  dotted line for the offer a chooser lets go when a better one arrives. Chips
  a proposer has already tried are struck through.
- **Step, Back, Play, Finish.** Every proposal is narrated in a sentence, also
  read out to screen readers.
- **Who proposes.** The same lists run with either side proposing.
- **Who proposes, who gains.** Both pairings side by side, with the place on
  their own list that each person's partner holds, the average for each side,
  and the number of stable pairings the lists allow (found by a pruned search
  over all pairings).

## Scenes

| Scene | What it shows |
| --- | --- |
| Shuffled tastes | Random lists; deal again for a new set. |
| Everyone agrees | Both sides rank in the same order: one stable pairing only. |
| Opposed tastes | Cyclic lists with n stable pairings; the proposing side gets every first choice. |
| One favourite | The whole left side shares one ranking, so proposals pile onto the same people. |

## What the tests check

- The worked example proposal by proposal, and replaying any prefix of the log.
- On random lists: the result is stable, best for every proposer and worst for
  every chooser among all stable pairings, the same whichever free proposer
  goes first, and reached in at most n² − n + 1 proposals.
- The pruned search for stable pairings agrees with brute force over all n!.
- Blocking pairs, narration for both proposing sides, board markup and escaping.

## Background

David Gale and Lloyd Shapley, "College Admissions and the Stability of
Marriage", *American Mathematical Monthly* 69 (1962), which also proves that
every proposer gets their best stable partner. That every chooser gets their
worst is due to McVitie and Wilson (1971). Gusfield and Irving, *The Stable
Marriage Problem* (1989), cover the bound on proposals and the structure of
the set of stable pairings.

## License

MIT
