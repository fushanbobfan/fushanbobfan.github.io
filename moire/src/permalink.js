import { KINDS } from './gratings.js';

// The whole view fits in the address bar, so a pattern can be shared as a
// link: #s=turned&a=l,8,0,0.5,0,0&b=l,8,5,0.5,0,0&v=bp
//   s  scene the view started from
//   a  bottom sheet, b  top sheet: kind letter, spacing (px), turn (degrees),
//      ink, then the offset from the middle of the view (px)
//   v  b = blur, p = predicted fringes, t = coloured sheets

const LETTER = { lines: 'l', rings: 'r', dots: 'd' };
const KIND_OF = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [v, k]));

export const LIMITS = {
  period: [3, 30],
  duty: [0.1, 0.9],
  offset: [-4000, 4000],
  // The page keeps angles within half a turn; anything else in a link is
  // folded the same way when it is decoded.
  angle: [-180, 180],
};

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Trim trailing zeros so links stay short: 8.00 -> 8, 0.50 -> 0.5.
function num(v, digits) {
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

// A sheet as stored in a link: angle in degrees, position relative to the
// middle of the view.
export function encodeSheet({ kind, period, angleDeg, duty, dx, dy }) {
  return [LETTER[kind], num(period, 2), num(angleDeg, 2), num(duty, 2), num(dx, 1), num(dy, 1)].join(',');
}

// Angles already within half a turn pass through untouched, so they round-trip
// exactly; others fold by whole turns, which leaves the pattern unchanged.
function foldTurn(deg) {
  if (deg >= -180 && deg <= 180) return deg;
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function decodeSheet(text) {
  const parts = String(text).split(',');
  if (parts.length !== 6) return null;
  const kind = KIND_OF[parts[0]];
  if (!KINDS.includes(kind)) return null;
  const values = parts.slice(1).map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [period, angleDeg, duty, dx, dy] = values;
  return {
    kind,
    period: clamp(period, LIMITS.period),
    angleDeg: foldTurn(angleDeg),
    duty: clamp(duty, LIMITS.duty),
    dx: clamp(dx, LIMITS.offset),
    dy: clamp(dy, LIMITS.offset),
  };
}

export function encodeState({ scene, sheets, blur, predict, tint }) {
  const view = (blur ? 'b' : '') + (predict ? 'p' : '') + (tint ? 't' : '');
  const params = new URLSearchParams();
  params.set('s', scene);
  params.set('a', encodeSheet(sheets[0]));
  params.set('b', encodeSheet(sheets[1]));
  if (view) params.set('v', view);
  // Commas read better than %2C and are safe in a fragment.
  return params.toString().replace(/%2C/gi, ',');
}

// Anything missing or malformed comes back null, so a bad link falls back to
// the default view instead of breaking the page.
export function decodeState(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  const a = params.has('a') ? decodeSheet(params.get('a')) : null;
  const b = params.has('b') ? decodeSheet(params.get('b')) : null;
  const view = params.get('v') || '';
  return {
    scene: params.get('s'),
    sheets: a && b ? [a, b] : null,
    blur: view.includes('b'),
    predict: view.includes('p'),
    tint: view.includes('t'),
  };
}
