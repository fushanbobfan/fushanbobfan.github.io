import { seededRandom } from './rng.js';

export const COLORS = ['#3f74b5', '#d4505f', '#2c8a43', '#c9a227', '#3fb3d6', '#9a3c86'];
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const MAX_CANDIDATES = 6;

export const SCENES = [
  { id: 'triangle', name: 'Three corners', spread: 0.2,
    candidates: [[0.5, 0.22], [0.24, 0.72], [0.76, 0.72]] },
  { id: 'twins', name: 'Twins', spread: 0.2,
    candidates: [[0.3, 0.46], [0.3, 0.54], [0.72, 0.5]] },
  { id: 'squeeze', name: 'Centre squeeze', spread: 0.26,
    candidates: [[0.32, 0.5], [0.5, 0.5], [0.68, 0.5]] },
  { id: 'ring', name: 'A ring around a centre', spread: 0.22,
    candidates: [[0.5, 0.5], [0.5, 0.18], [0.8, 0.6], [0.3, 0.8], [0.2, 0.35]] },
  { id: 'line', name: 'Four in a line', spread: 0.2,
    candidates: [[0.2, 0.5], [0.4, 0.5], [0.6, 0.5], [0.8, 0.5]] },
];

export function sceneCandidates(scene) {
  return scene.candidates.map(([x, y]) => ({ x, y }));
}

// Keep a handle on the board, a little way in from the edge.
export function clampPoint(v) {
  return Math.min(0.97, Math.max(0.03, v));
}

// A new candidate goes where it is farthest from everyone already standing.
export function placeNewCandidate(candidates, seed = 1) {
  const rng = seededRandom(seed + candidates.length * 7919);
  let best = null, bestGap = -1;
  for (let i = 0; i < 200; i++) {
    const p = { x: 0.1 + 0.8 * rng(), y: 0.1 + 0.8 * rng() };
    const gap = Math.min(...candidates.map((c) => Math.hypot(c.x - p.x, c.y - p.y)), Infinity);
    if (gap > bestGap) { best = p; bestGap = gap; }
  }
  return best;
}

// Candidates in a URL fragment: #c=0.50,0.22;0.24,0.72&s=0.20
export function encodeState(candidates, spread) {
  const c = candidates.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(';');
  return `c=${c}&s=${spread.toFixed(2)}`;
}

export function decodeState(text) {
  const params = new URLSearchParams(text.replace(/^#/, ''));
  const raw = params.get('c');
  if (!raw) return null;
  const candidates = raw.split(';').slice(0, MAX_CANDIDATES).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
  if (!candidates.length || candidates.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const spread = Number(params.get('s'));
  return {
    candidates: candidates.map((p) => ({ x: clampPoint(p.x), y: clampPoint(p.y) })),
    spread: Number.isFinite(spread) && spread >= 0.05 && spread <= 0.4 ? spread : 0.2,
  };
}
