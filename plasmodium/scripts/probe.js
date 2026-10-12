// Runs a simulation headless and prints how the network develops.
// Usage: node scripts/probe.js [key=value ...] [steps=N] [every=N] [png=out.png]
// Keys are the settings in src/sim.js plus food=<layout> and factor=<threshold>.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createSim, stepSim } from '../src/sim.js';
import { placeFoodLayout } from '../src/food.js';
import { analyse } from '../src/network.js';
import { maxTrail } from '../src/trail.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split('=');
    return [k, v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v)];
  }),
);
const steps = args.steps ?? 1000;
const every = args.every ?? 200;
const factor = args.factor ?? 1.5;

const sim = createSim(args);
if (args.food) sim.foods.push(...placeFoodLayout(args.food, sim.settings.width, sim.settings.height));

console.log('step  coverage  pieces  largest  food');
for (let s = every; s <= steps; s += every) {
  stepSim(sim, every);
  const r = analyse(sim.trail, sim.foods, sim.settings.wrap, factor);
  console.log(
    `${String(sim.steps).padStart(4)}  ${r.coverage.toFixed(3).padStart(8)}  ${String(r.pieces).padStart(6)}` +
      `  ${r.largest.toFixed(3).padStart(7)}  ${r.foodLinked}/${r.foodTotal}`,
  );
}

if (args.png) {
  writeFileSync(args.png, grayPng(sim.trail));
  console.log(`wrote ${args.png}`);
}

function grayPng(trail) {
  const { width: w, height: h, data } = trail;
  const peak = maxTrail(trail) || 1;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      raw[y * (w + 1) + 1 + x] = Math.round(255 * Math.sqrt(data[y * w + x] / peak));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const td = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
