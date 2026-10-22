// Pointer hit-testing: which element sits under a point on the bench.

import { vec, sub, dot, length, add, scale, hitPiece, wrapAngle } from './geometry.js';
import { piecesOf, SOURCE_KINDS } from './elements.js';

const SOURCE_RADIUS = 14;
const LINE_TOLERANCE = 8;

function distanceToSegment(p, a, b) {
  const e = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), e) / dot(e, e)));
  return length(sub(p, add(a, scale(e, t))));
}

function distanceToArc(p, piece) {
  const rel = sub(p, piece.c);
  const ang = wrapAngle(Math.atan2(rel.y, rel.x) - piece.a0);
  if (ang <= piece.span) return Math.abs(length(rel) - piece.r);
  const end = (a) => add(piece.c, scale(vec(Math.cos(a), Math.sin(a)), piece.r));
  return Math.min(
    length(sub(p, end(piece.a0))),
    length(sub(p, end(piece.a0 + piece.span))),
  );
}

export function distanceToPiece(p, piece) {
  return piece.type === 'segment'
    ? distanceToSegment(p, piece.a, piece.b)
    : distanceToArc(p, piece);
}

// Inside a closed outline if a ray from p crosses it an odd number of times.
export function insideOutline(p, pieces) {
  let o = p;
  const d = vec(0.6, 0.8);
  let crossings = 0;
  for (let k = 0; k < 32; k++) {
    let best = Infinity;
    for (const piece of pieces) best = Math.min(best, hitPiece(o, d, piece));
    if (best === Infinity) break;
    o = add(o, scale(d, best + 1e-6));
    crossings++;
  }
  return crossings % 2 === 1;
}

export function hitsElement(el, p) {
  if (SOURCE_KINDS.has(el.kind)) return length(sub(p, vec(el.x, el.y))) <= SOURCE_RADIUS;
  const pieces = piecesOf(el);
  if (pieces.some((piece) => distanceToPiece(p, piece) <= LINE_TOLERANCE)) return true;
  return pieces[0].role === 'glass' && insideOutline(p, pieces);
}

// Topmost element under p: later elements are drawn on top, and sources win
// over the optics they sit beside.
export function elementAt(elements, p) {
  const order = [...elements].reverse();
  const source = order.find((el) => SOURCE_KINDS.has(el.kind) && hitsElement(el, p));
  return source || order.find((el) => hitsElement(el, p)) || null;
}

// Distance from an element's centre to its rotation handle, along its angle.
export function handleReach(el) {
  switch (el.kind) {
    case 'prism':
      return el.side * Math.sin((el.apex * Math.PI) / 360) + 22;
    case 'block':
      return el.width / 2 + 22;
    case 'ball':
      return el.radius + 22;
    case 'beam':
    case 'laser':
    case 'point':
      return 40;
    default:
      return 34;
  }
}

export function handleOf(el) {
  const r = handleReach(el);
  return vec(el.x + Math.cos(el.angle) * r, el.y + Math.sin(el.angle) * r);
}

export function onHandle(el, p, tolerance = 9) {
  return length(sub(p, handleOf(el))) <= tolerance;
}
