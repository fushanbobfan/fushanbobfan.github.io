// Optical elements on the bench. Each element is a plain object with a
// position, a rotation and a few shape parameters; `piecesOf` turns it into
// boundary pieces in world coordinates for the tracer.

import {
  vec, add, rotate, segment, arc, polygon, fromAngle, scale,
} from './geometry.js';
import { spectrumSamples, whiteShare } from './spectrum.js';

let nextId = 1;
export const newId = () => `e${nextId++}`;

export const DEFAULTS = {
  prism: { apex: 60, side: 160, material: 'bk7' },
  block: { width: 160, height: 100, material: 'bk7' },
  convexLens: { radius: 220, aperture: 70, material: 'bk7' },
  concaveLens: { radius: 220, aperture: 70, material: 'bk7' },
  ball: { radius: 70, material: 'bk7' },
  mirror: { length: 160 },
  curvedMirror: { radius: 400, aperture: 90 },
  blocker: { length: 160 },
  laser: { light: 'mono', wavelength: 532, samples: 12 },
  beam: { width: 80, count: 9, light: 'mono', wavelength: 532, samples: 12 },
  point: { count: 24, spread: 360, light: 'mono', wavelength: 532, samples: 12 },
};

export const SOURCE_KINDS = new Set(['laser', 'beam', 'point']);

export function makeElement(kind, x, y, angle = 0, params = {}) {
  if (!DEFAULTS[kind]) throw new Error(`unknown element kind: ${kind}`);
  return { id: newId(), kind, x, y, angle, ...DEFAULTS[kind], ...params };
}

const place = (el) => (p) => add(rotate(p, el.angle), vec(el.x, el.y));

function placeArc(el, c, r, a0, span, sign) {
  return arc(place(el)(c), r, a0 + el.angle, span, sign);
}

function placeSegment(el, a, b, normal) {
  return segment(place(el)(a), place(el)(b), rotate(normal, el.angle));
}

// Isosceles prism pointing along local -y, with the given apex angle (degrees)
// and leg length, centred on its centroid.
export function prismPoints(el) {
  const half = (el.apex * Math.PI) / 360;
  const h = el.side * Math.cos(half);
  const b = el.side * Math.sin(half);
  const pts = [vec(0, -h), vec(b, 0), vec(-b, 0)];
  const cy = -h / 3;
  return pts.map((p) => place(el)(vec(p.x, p.y - cy)));
}

function lensPieces(el, convex) {
  const R = Math.max(el.radius, el.aperture + 1);
  const h = el.aperture;
  const phi = Math.asin(h / R);
  const sag = R - Math.sqrt(R * R - h * h);
  const core = 3;
  if (convex) {
    const e = core;
    const half = e / 2;
    return [
      placeArc(el, vec(half + sag - R, 0), R, -phi, 2 * phi, 1),
      placeArc(el, vec(-half - sag + R, 0), R, Math.PI - phi, 2 * phi, 1),
      placeSegment(el, vec(-half, h), vec(half, h), vec(0, 1)),
      placeSegment(el, vec(-half, -h), vec(half, -h), vec(0, -1)),
    ];
  }
  const c = core;
  const edge = c / 2 + sag;
  return [
    placeArc(el, vec(c / 2 + R, 0), R, Math.PI - phi, 2 * phi, -1),
    placeArc(el, vec(-c / 2 - R, 0), R, -phi, 2 * phi, -1),
    placeSegment(el, vec(-edge, h), vec(edge, h), vec(0, 1)),
    placeSegment(el, vec(-edge, -h), vec(edge, -h), vec(0, -1)),
  ];
}

// Boundary pieces of an element, each tagged with the element it belongs to.
// Sources have no pieces.
export function piecesOf(el) {
  let pieces;
  let role = 'glass';
  switch (el.kind) {
    case 'prism':
      pieces = polygon(prismPoints(el));
      break;
    case 'block': {
      const w = el.width / 2;
      const h = el.height / 2;
      pieces = polygon([vec(-w, -h), vec(w, -h), vec(w, h), vec(-w, h)].map(place(el)));
      break;
    }
    case 'convexLens':
      pieces = lensPieces(el, true);
      break;
    case 'concaveLens':
      pieces = lensPieces(el, false);
      break;
    case 'ball':
      pieces = [arc(vec(el.x, el.y), el.radius, 0, Math.PI * 2, 1)];
      break;
    case 'mirror':
    case 'blocker': {
      role = el.kind === 'mirror' ? 'mirror' : 'absorber';
      const l = el.length / 2;
      pieces = [placeSegment(el, vec(0, -l), vec(0, l), vec(-1, 0))];
      break;
    }
    case 'curvedMirror': {
      role = 'mirror';
      const R = Math.max(el.radius, el.aperture + 1);
      const phi = Math.asin(el.aperture / R);
      pieces = [placeArc(el, vec(-R, 0), R, -phi, 2 * phi, 1)];
      break;
    }
    default:
      return [];
  }
  return pieces.map((p) => ({ ...p, role, element: el }));
}

// Rays emitted by a source: origin, unit direction, wavelength, intensity and
// the share of the source's brightness each ray is drawn with. A white source
// sends one ray per sampled wavelength along every path.
export function raysOf(el) {
  const paths = pathsOf(el);
  if (el.light !== 'white') {
    return paths.map((p) => ({ ...p, wavelength: el.wavelength, intensity: 1, share: 1 }));
  }
  const wavelengths = spectrumSamples(el.samples);
  const share = whiteShare(wavelengths);
  return paths.flatMap((p) => wavelengths.map((wavelength) => ({
    ...p, wavelength, intensity: 1, share,
  })));
}

// Starting points and directions of a source's rays.
function pathsOf(el) {
  const dir = fromAngle(el.angle);
  switch (el.kind) {
    case 'laser':
      return [{ o: vec(el.x, el.y), d: dir }];
    case 'beam': {
      const across = rotate(dir, Math.PI / 2);
      const n = Math.max(1, Math.round(el.count));
      const rays = [];
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        rays.push({ o: add(vec(el.x, el.y), scale(across, f * el.width)), d: dir });
      }
      return rays;
    }
    case 'point': {
      const n = Math.max(1, Math.round(el.count));
      const spread = (Math.min(360, el.spread) * Math.PI) / 180;
      const full = spread >= Math.PI * 2 - 1e-9;
      const rays = [];
      for (let i = 0; i < n; i++) {
        const f = full ? i / n : n === 1 ? 0.5 : i / (n - 1);
        const a = el.angle - spread / 2 + f * spread;
        rays.push({ o: vec(el.x, el.y), d: fromAngle(a) });
      }
      return rays;
    }
    default:
      return [];
  }
}

function samplePiece(p, step = 4) {
  if (p.type === 'segment') return [p.a, p.b];
  const n = Math.max(2, Math.ceil((p.r * p.span) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = p.a0 + (p.span * i) / n;
    pts.push(vec(p.c.x + p.r * Math.cos(a), p.c.y + p.r * Math.sin(a)));
  }
  return pts;
}

// Boundary of an element as one polyline, joining its pieces end to end. For
// closed shapes the last point meets the first.
export function outlineOf(el) {
  const chains = piecesOf(el).map((p) => samplePiece(p));
  if (!chains.length) return [];
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
  const path = chains.shift();
  while (chains.length) {
    const tail = path[path.length - 1];
    let i = chains.findIndex((c) => near(c[0], tail) || near(c[c.length - 1], tail));
    if (i < 0) i = 0;
    const next = chains.splice(i, 1)[0];
    if (!near(next[0], tail) && near(next[next.length - 1], tail)) next.reverse();
    path.push(...next.slice(near(next[0], tail) ? 1 : 0));
  }
  return path;
}
