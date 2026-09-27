// Ray tracer. Follows every ray from every source through the bench, splitting
// it at glass surfaces into a Fresnel-weighted reflection and a refraction, and
// returns the resulting light paths as straight segments.
//
// Glass shapes are assumed not to overlap: a ray meeting a glass surface from
// outside enters glass from air, and one meeting it from inside leaves into air.

import { add, scale, dot, hitPiece, normalAt } from './geometry.js';
import { reflect, refract, fresnel, refractiveIndex, MATERIALS } from './optics.js';
import { piecesOf, raysOf, SOURCE_KINDS } from './elements.js';

export const TRACE_DEFAULTS = {
  maxDepth: 40,
  minIntensity: 0.01,
  maxSegments: 40000,
  escapeLength: 5000,
  mirrorReflectance: 0.95,
};

const NUDGE = 1e-6;

function nearestHit(o, d, pieces) {
  let best = Infinity;
  let piece = null;
  for (const p of pieces) {
    const t = hitPiece(o, d, p);
    if (t < best) {
      best = t;
      piece = p;
    }
  }
  return piece ? { t: best, piece } : null;
}

export function trace(elements, options = {}) {
  const opts = { ...TRACE_DEFAULTS, ...options };
  const pieces = elements.flatMap(piecesOf);
  const segments = [];
  const stack = [];
  for (const el of elements) {
    if (!SOURCE_KINDS.has(el.kind)) continue;
    for (const r of raysOf(el)) stack.push({ ...r, depth: 0, source: el.id });
  }
  const stats = { launched: stack.length, absorbed: 0, escaped: 0, dropped: 0, lost: 0, truncated: false };

  while (stack.length) {
    if (segments.length >= opts.maxSegments) {
      stats.truncated = true;
      break;
    }
    const ray = stack.pop();
    const hit = nearestHit(ray.o, ray.d, pieces);
    const t = hit ? hit.t : opts.escapeLength;
    const end = add(ray.o, scale(ray.d, t));
    segments.push({
      x1: ray.o.x, y1: ray.o.y, x2: end.x, y2: end.y,
      intensity: ray.intensity, wavelength: ray.wavelength, source: ray.source,
      fate: hit ? hit.piece.role : 'escape',
    });
    if (!hit) {
      stats.escaped++;
      continue;
    }
    const { piece } = hit;
    if (piece.role === 'absorber') {
      stats.absorbed++;
      continue;
    }
    if (ray.depth >= opts.maxDepth) {
      stats.dropped++;
      stats.lost += ray.intensity;
      continue;
    }

    const spawn = (d, intensity) => {
      if (intensity < opts.minIntensity) {
        stats.dropped++;
        stats.lost += intensity;
        return;
      }
      stack.push({
        o: add(end, scale(d, NUDGE)), d, intensity,
        wavelength: ray.wavelength, depth: ray.depth + 1, source: ray.source,
      });
    };

    const outward = normalAt(piece, end);
    const entering = dot(ray.d, outward) < 0;
    const n = entering ? outward : scale(outward, -1);

    if (piece.role === 'mirror') {
      spawn(reflect(ray.d, n), ray.intensity * opts.mirrorReflectance);
      continue;
    }

    const glass = refractiveIndex(MATERIALS[piece.element.material], ray.wavelength);
    const [n1, n2] = entering ? [1, glass] : [glass, 1];
    const refracted = refract(ray.d, n, n1, n2);
    const R = refracted ? fresnel(-dot(ray.d, n), n1, n2) : 1;
    spawn(reflect(ray.d, n), ray.intensity * R);
    if (refracted) spawn(refracted, ray.intensity * (1 - R));
  }
  return { segments, stats };
}
