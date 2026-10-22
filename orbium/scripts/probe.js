// Runs creatures without the page and reports how they hold up.
// Usage: node scripts/probe.js [species|all] [steps=500] [size=128] [scale=1]

import { World, torusDelta } from '../src/world.js';
import { SPECIES } from '../src/species.js';
import { speciesById, speciesRule, speciesPattern } from '../src/patterns.js';

const [which = 'all', stepsArg = '500', sizeArg = '128', scaleArg = '1'] = process.argv.slice(2);
const steps = Number(stepsArg);
const n = Number(sizeArg);
const scale = Number(scaleArg);

const list = which === 'all' ? SPECIES : [speciesById(which)];
if (list.some((s) => !s)) {
  console.error(`unknown species "${which}"; try one of: ${SPECIES.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

console.log('species        R    mass end/start  min-max    travel/R  net/R   ms/step');
for (const s of list) {
  const rule = speciesRule(s, scale);
  const w = new World(n, rule);
  const p = speciesPattern(s, scale);
  w.place(p, (n - p.width) >> 1, (n - p.height) >> 1);
  const m0 = w.mass();
  let c = w.centroid();
  let path = 0, nx = 0, ny = 0, lo = Infinity, hi = 0;
  const t0 = performance.now();
  for (let i = 1; i <= steps; i++) {
    w.step();
    if (i % 10 === 0) {
      const m = w.mass() / m0;
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
      const c2 = w.centroid();
      if (!c2) break;
      const d = torusDelta(c, c2, n);
      path += Math.hypot(d.dx, d.dy);
      nx += d.dx;
      ny += d.dy;
      c = c2;
    }
  }
  const ms = (performance.now() - t0) / steps;
  console.log(
    [
      s.id.padEnd(14),
      String(rule.R).padStart(3),
      (w.mass() / m0).toFixed(2).padStart(12),
      `${lo.toFixed(2)}-${hi.toFixed(2)}`.padStart(11),
      (path / rule.R).toFixed(2).padStart(10),
      (Math.hypot(nx, ny) / rule.R).toFixed(2).padStart(7),
      ms.toFixed(2).padStart(9),
    ].join(' '),
  );
}
