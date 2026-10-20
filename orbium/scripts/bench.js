// Times the world step at each grid size.
// Usage: node scripts/bench.js [sizes=128,256,512]

import { World } from '../src/world.js';
import { soup } from '../src/seed.js';

const sizes = (process.argv[2] || '128,256,512').split(',').map(Number);
const rule = { R: 26, T: 10, mu: 0.15, sigma: 0.015, rings: [1] };

console.log('size   ms/step   steps/s');
for (const n of sizes) {
  const w = new World(n, rule);
  soup(w, { seed: 3, count: 8 });
  for (let i = 0; i < 3; i++) w.step();
  const runs = Math.max(5, Math.round(2e6 / (n * n)));
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) w.step();
  const ms = (performance.now() - t0) / runs;
  console.log(`${String(n).padStart(4)} ${ms.toFixed(2).padStart(9)} ${(1000 / ms).toFixed(0).padStart(9)}`);
}
