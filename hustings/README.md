# hustings

The same voters, the same candidates, six ways of counting. Drag candidates
across a two-dimensional political map and see who wins at every point under
plurality, a two-round runoff, instant runoff, the Borda count, approval voting
and a Condorcet method (minimax).

**Live demo:** https://fushanbobfan.github.io/hustings/

No build step and no dependencies. The counting rules and the map are plain ES
modules covered by a Node test suite; only `src/main.js` and `src/probe.js`
touch the page.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## How the map is made

- Each point of the map is the centre of an electorate: a round normal cloud of
  151 voters, the same cloud every time, with a spread set by the slider.
- Voters rank the candidates by distance, nearest first.
- Every cell holds the election under all six rules and is coloured by the
  winner (a Yee diagram). A coarse 48 × 48 map appears at once and is refined
  to 160 × 160 a few rows per frame.
- **Stripe where the rule passes over the Condorcet winner** marks cells where a
  candidate who beats every rival head to head exists and the chosen rule
  elects someone else. Each thumbnail gives that share for its rule.
- Clicking the map, or focusing it and using the arrow keys, shows the election
  at that point in full: first-choice bars, both runoff rounds, the instant
  runoff table, Borda and approval totals, and the head-to-head table.
- Candidates can be dragged or moved with the arrow keys (Shift for bigger
  steps). Up to six can stand. The address bar keeps the positions and spread,
  so a copied link reopens the same picture.

## The rules

| Rule | Count |
| --- | --- |
| Plurality | First choices only. |
| Two-round runoff | The top two by first choices meet again unless one has a majority. |
| Instant runoff | The candidate with the fewest first choices drops out and their ballots move on, until someone has a majority. |
| Borda count | k−1 points for a first choice down to 0 for a last. |
| Approval | Each voter approves every candidate nearer than their average distance. |
| Minimax | The candidate whose worst head-to-head defeat is smallest; this is the Condorcet winner whenever one exists. |

Exact ties go to the lower-lettered candidate, and a tie for last place in
instant runoff drops the higher-lettered one, so every map is reproducible.

## Scenes worth trying

- **Twins**: two candidates side by side split their supporters under plurality,
  and the far candidate's region bulges into the gap.
- **Centre squeeze**: the moderate B beats both rivals head to head yet has the
  fewest first choices in the middle, so both runoffs drop B there. Instant
  runoff still hands B two thin stripes, where the far rival drops out first.
- Under this approval habit, a candidate standing exactly halfway between two
  others is approved by every voter (its distance is never more than the
  average of the other two), so approval gives B the whole Centre squeeze map.

## Background

The pictures follow Ka-Ping Yee's 2006 voting simulation visualizations.

## License

MIT
