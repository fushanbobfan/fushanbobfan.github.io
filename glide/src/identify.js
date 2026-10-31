import { basis } from './groups.js';
import { elements } from './elements.js';

// What can be read off a pattern: the largest rotation, whether there are
// mirrors and in how many directions, whether there are glide lines that are
// not mirrors, and whether every rotation centre lies on a mirror.
export function features(group, shape) {
  const B = basis(group.lattice, shape);
  const { centres, lines } = elements(group, B, { x0: -1.5, y0: -1.5, x1: 1.5, y1: 1.5 });
  const mirrors = lines.filter((l) => l.mirror);
  const dist = (c, l) => Math.abs((c.x - l.px) * -l.dy + (c.y - l.py) * l.dx);
  const onMirror = (c) => mirrors.some((l) => dist(c, l) < 1e-6);
  const directions = new Set(mirrors.map((l) => Math.atan2(l.dy, l.dx).toFixed(4))).size;
  const top = Math.max(1, ...centres.map((c) => c.order));
  return {
    rotation: top,
    mirrors: mirrors.length > 0,
    mirrorDirections: directions,
    glides: lines.some((l) => !l.mirror),
    centresOnMirrors: centres.every(onMirror),
    topCentresOnMirrors: centres.filter((c) => c.order === top).every(onMirror),
  };
}

// The usual identification chart, as a list of questions and answers ending
// in a group name.
export function identify(f) {
  const steps = [];
  const ask = (q, a) => {
    steps.push({ q, a: a ? 'yes' : 'no' });
    return a;
  };
  steps.push({ q: 'Smallest rotation, in turns', a: f.rotation === 1 ? 'none' : `1/${f.rotation}` });
  let id;
  switch (f.rotation) {
    case 1:
      if (ask('Any mirrors?', f.mirrors)) id = ask('Any glide line that is not a mirror?', f.glides) ? 'cm' : 'pm';
      else id = ask('Any glide lines?', f.glides) ? 'pg' : 'p1';
      break;
    case 2:
      if (ask('Any mirrors?', f.mirrors)) {
        if (!ask('Mirrors in two directions?', f.mirrorDirections >= 2)) id = 'pmg';
        else id = ask('Are all rotation centres on mirrors?', f.centresOnMirrors) ? 'pmm' : 'cmm';
      } else {
        id = ask('Any glide lines?', f.glides) ? 'pgg' : 'p2';
      }
      break;
    case 3:
      if (!ask('Any mirrors?', f.mirrors)) id = 'p3';
      else id = ask('Are all rotation centres on mirrors?', f.centresOnMirrors) ? 'p3m1' : 'p31m';
      break;
    case 4:
      if (!ask('Any mirrors?', f.mirrors)) id = 'p4';
      else id = ask('Are the quarter-turn centres on mirrors?', f.topCentresOnMirrors) ? 'p4m' : 'p4g';
      break;
    case 6:
      id = ask('Any mirrors?', f.mirrors) ? 'p6m' : 'p6';
      break;
    default:
      throw new Error(`no wallpaper group has a ${f.rotation}-fold rotation`);
  }
  return { id, steps };
}

// Small seeded generator so a puzzle can be replayed from its number.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A few smooth strokes in fractional coordinates, all starting in the unit cell.
// Generic positions keep accidental extra symmetry away.
export function randomMotif(seed, colors) {
  const r = rng(seed);
  const strokes = [];
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    let u = r();
    let v = r();
    let heading = r() * 2 * Math.PI;
    const turn = (r() - 0.5) * 0.25;
    const len = 18 + Math.floor(r() * 22);
    const pts = [[u, v]];
    for (let i = 0; i < len; i++) {
      heading += turn + (r() - 0.5) * 0.15;
      u += 0.022 * Math.cos(heading);
      v += 0.022 * Math.sin(heading);
      pts.push([u, v]);
    }
    strokes.push({ pts, color: colors[Math.floor(r() * colors.length)], width: 3 + Math.floor(r() * 5) });
  }
  return strokes;
}
