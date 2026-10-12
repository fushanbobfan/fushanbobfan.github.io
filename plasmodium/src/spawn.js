// Starting layouts for the particles. Each fills `agents` up to `count`
// inside a width x height world using the seeded generator.

import { addAgent } from './agents.js';

const TAU = Math.PI * 2;

export const LAYOUTS = {
  scatter: 'Scattered everywhere, random headings',
  disc: 'A disc in the middle, random headings',
  ring: 'A ring facing inwards',
  burst: 'One point in the middle, facing outwards',
  rim: 'Along the edges, facing inwards',
};

export function spawn(agents, layout, count, width, height, rng) {
  agents.count = 0;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  for (let i = 0; i < count; i++) {
    let x;
    let y;
    let a;
    switch (layout) {
      case 'disc': {
        const t = rng.next() * TAU;
        const d = Math.sqrt(rng.next()) * r * 0.45;
        x = cx + Math.cos(t) * d;
        y = cy + Math.sin(t) * d;
        a = rng.next() * TAU;
        break;
      }
      case 'ring': {
        const t = rng.next() * TAU;
        const d = r * (0.8 + 0.1 * rng.next());
        x = cx + Math.cos(t) * d;
        y = cy + Math.sin(t) * d;
        a = t + Math.PI;
        break;
      }
      case 'burst': {
        const t = rng.next() * TAU;
        const d = rng.next() * 2;
        x = cx + Math.cos(t) * d;
        y = cy + Math.sin(t) * d;
        a = t;
        break;
      }
      case 'rim': {
        const side = rng.int(4);
        const u = rng.next();
        const inset = 2 + rng.next() * 3;
        if (side === 0) { x = u * width; y = inset; }
        else if (side === 1) { x = width - inset; y = u * height; }
        else if (side === 2) { x = u * width; y = height - inset; }
        else { x = inset; y = u * height; }
        a = Math.atan2(cy - y, cx - x);
        break;
      }
      default:
        x = rng.next() * width;
        y = rng.next() * height;
        a = rng.next() * TAU;
    }
    a = ((a % TAU) + TAU) % TAU;
    addAgent(agents, clamp(x, width), clamp(y, height), a);
  }
}

function clamp(v, size) {
  return Math.min(Math.max(v, 0), size - 1e-3);
}
