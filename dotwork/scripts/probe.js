// Headless run of the stippler on a built-in picture. Prints how the dots
// settle round by round and how much the line shortens, and can write the
// result as SVG.
// Usage: node scripts/probe.js [picture] [dots] [--rounds N] [--size PX] [--line] [--svg out.svg]

import { writeFileSync } from 'node:fs';
import { drawSource, SOURCE_IDS } from '../src/sources.js';
import { adjustField, fieldMean } from '../src/density.js';
import { seedPoints, relax } from '../src/lloyd.js';
import { dotRadii, coverage } from '../src/dots.js';
import { nearestNeighbourTour, neighbourLists, twoOpt, tourLength } from '../src/tour.js';
import { dotsSvg, tourSvg } from '../src/svg.js';
import { createRng } from '../src/rng.js';

const options = { '--rounds': '60', '--size': '480', '--svg': null };
const positional = [];
let wantLine = false;
for (let a = process.argv.slice(2), i = 0; i < a.length; i++) {
  if (a[i] === '--line') wantLine = true;
  else if (a[i] in options) options[a[i]] = a[++i];
  else positional.push(a[i]);
}
const picture = positional[0] || 'sphere';
const count = Number(positional[1] || 4000);
const rounds = Number(options['--rounds']);
const size = Number(options['--size']);
const svgOut = options['--svg'];

if (!SOURCE_IDS.includes(picture)) {
  console.error(`unknown picture "${picture}"; try one of: ${SOURCE_IDS.join(', ')}`);
  process.exit(1);
}

const field = adjustField(drawSource(picture, size, Math.round(size * 0.75)), { floor: 0.02 });
const points = seedPoints(field, count, createRng(1));
const scratch = {};
let last;
const t0 = performance.now();
console.log(`${picture}: ${field.width}x${field.height}, ${count} dots, mean ink ${fieldMean(field).toFixed(3)}`);
for (let k = 1; k <= rounds; k++) {
  last = relax(field, points, count, scratch);
  if (k <= 3 || k % 10 === 0 || k === rounds) {
    console.log(`round ${String(k).padStart(3)}  mean move ${last.meanMove.toFixed(4)} px  largest ${last.maxMove.toFixed(3)} px`);
  }
}
const ms = (performance.now() - t0) / rounds;
const radii = dotRadii(last.stats, count, { mode: 'tone' });
console.log(`${ms.toFixed(1)} ms per round; tone dots cover ${(100 * coverage(radii, count, field.width, field.height)).toFixed(1)}% of the page`);

let tour = null;
if (wantLine) {
  const t1 = performance.now();
  tour = nearestNeighbourTour(points, count);
  const greedy = tourLength(points, tour);
  const res = twoOpt(points, tour, neighbourLists(points, count, 8));
  const final = tourLength(points, tour);
  console.log(
    `line: greedy ${(greedy / field.width).toFixed(1)} page widths, after 2-opt ${(final / field.width).toFixed(1)} ` +
      `(${(100 * (1 - final / greedy)).toFixed(1)}% shorter, ${res.moves} moves, ${(performance.now() - t1).toFixed(0)} ms)`,
  );
}

if (svgOut) {
  const scale = 1000 / Math.max(field.width, field.height);
  const svg = tour
    ? tourSvg(points, tour, field.width, field.height, { scale, stroke: 0.35 * scale })
    : dotsSvg(points, radii, count, field.width, field.height, { scale });
  writeFileSync(svgOut, svg);
  console.log(`wrote ${svgOut}`);
}
