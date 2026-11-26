// Single scattering in a spherical atmosphere: the light that reaches the eye from every direction.

import { EARTH_RADIUS, TOP, RAYLEIGH_HEIGHT, HAZE_HEIGHT, coefficients, density, ozoneDensity, rayleighPhase, hazePhase } from './air.js';
import { WAVELENGTHS, SUN, spectrumToRGB, brightnessY, luminance } from './spectrum.js';

const R_TOP = EARTH_RADIUS + TOP;
const NL = WAVELENGTHS.length;
export const DEG = Math.PI / 180;

export function direction(elevation, azimuth) {
  const ce = Math.cos(elevation);
  return [ce * Math.cos(azimuth), ce * Math.sin(azimuth), Math.sin(elevation)];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Distance along the ray to the top of the atmosphere, or -1 if the ray meets the ground first.
export function exitDistance(p, d) {
  const b = dot(p, d);
  const pp = dot(p, p);
  const ground = b * b - (pp - EARTH_RADIUS * EARTH_RADIUS);
  // Leaving the ground counts as meeting it (with a millimetre of slack for rounding).
  if (ground >= 0 && b < 0 && -b - Math.sqrt(ground) > -1e-3) return -1;
  const top = b * b - (pp - R_TOP * R_TOP);
  if (top < 0) return 0;
  return Math.max(0, -b + Math.sqrt(top));
}

// Samples along [0, length], crowded near `near` (0 or length) where the air is densest.
// Writes positions and weights from index `at`; returns the next free index.
function crowd(t, w, at, from, to, n) {
  const span = to - from;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n;
    t[at + i] = from + span * s * s * s;
    w[at + i] = (3 * Math.abs(span) * s * s) / n;
  }
  return at + n;
}

const scratchT = new Float64Array(4096);
const scratchW = new Float64Array(4096);

// Sample points for the ray from p along d up to `length`: crowded at the start and, if the ray
// passes closest to the ground further on, around that point too. Returns how many were written.
export function samplePath(p, d, length, n, t = scratchT, w = scratchW) {
  const closest = -dot(p, d);
  if (closest > 0 && closest < length) {
    const a = Math.max(2, Math.round(n / 2));
    // [0, closest] crowded at the closest point, [closest, length] crowded at it as well.
    let k = crowd(t, w, 0, closest, 0, a);
    k = crowd(t, w, k, closest, length, n - a > 1 ? n - a : 2);
    // The near end of the ray is where the eye is; nothing more is needed there.
    return k;
  }
  return crowd(t, w, 0, 0, length, n);
}

// Air crossed from p along d to space, in metres of sea-level air for the molecules and the haze
// and metres of peak-density ozone: [molecules, haze, ozone].
// Infinity if the ground is in the way.
function radius(p, d, t) {
  const x = p[0] + t * d[0], y = p[1] + t * d[1], z = p[2] + t * d[2];
  return Math.sqrt(x * x + y * y + z * z);
}

// Distances along the ray where it crosses the sphere of radius r.
function crossings(p, d, r, out) {
  const b = dot(p, d);
  const disc = b * b - (dot(p, p) - r * r);
  if (disc <= 0) return;
  const s = Math.sqrt(disc);
  out.push(-b - s, -b + s);
}

const GL_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
const GL_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
const OZONE_SHELLS = [10000, 25000, 40000].map((h) => EARTH_RADIUS + h);

// Ozone crossed along [0, len]: the ray is cut where it enters, peaks in and leaves the layer, and
// where it passes closest to the ground, so the height is smooth and one-way on each piece, and
// each piece inside the layer gets a four-point Gauss-Legendre rule.
export function ozoneColumn(p, d, len) {
  const cuts = [0, len];
  for (const r of OZONE_SHELLS) crossings(p, d, r, cuts);
  cuts.push(-dot(p, d));
  const ts = cuts.filter((t) => t >= 0 && t <= len).sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1];
    if (b - a < 1e-6) continue;
    const mid = 0.5 * (a + b), half = 0.5 * (b - a);
    const hm = radius(p, d, mid) - EARTH_RADIUS;
    if (hm <= 10000 || hm >= 40000) continue;
    for (let k = 0; k < 4; k++) {
      const t = mid + half * GL_X[k];
      const h = radius(p, d, t) - EARTH_RADIUS;
      total += half * GL_W[k] * ozoneDensity(h);
    }
  }
  return total;
}

const colT = new Float64Array(4096);
const colW = new Float64Array(4096);

export function column(p, d, n = 16) {
  const len = exitDistance(p, d);
  if (len < 0) return [Infinity, Infinity, Infinity];
  const k = samplePath(p, d, len, n, colT, colW);
  let cr = 0, cm = 0;
  for (let i = 0; i < k; i++) {
    const t = colT[i];
    const x = p[0] + t * d[0], y = p[1] + t * d[1], z = p[2] + t * d[2];
    const h = Math.sqrt(x * x + y * y + z * z) - EARTH_RADIUS;
    cr += colW[i] * Math.exp(-Math.max(0, h) / RAYLEIGH_HEIGHT);
    cm += colW[i] * Math.exp(-Math.max(0, h) / HAZE_HEIGHT);
  }
  return [cr, cm, ozoneColumn(p, d, len)];
}

export function eyePosition(height) {
  return [0, 0, EARTH_RADIUS + height];
}

// The scene for one setting of the controls.
export function makeScene({ sun, haze, height, ozone = 1 }) {
  const coef = coefficients(haze, ozone);
  const eye = eyePosition(height);
  const sunDir = direction(sun * DEG, 0);
  return { sun, haze, height, ozone, coef, eye, sunDir };
}

const viewT = new Float64Array(4096);
const viewW = new Float64Array(4096);
const ORDER = new Int32Array(4096);
const q = [0, 0, 0];

// Spectrum of the sky light arriving along -d (looking along d), in units of sunlight above the air
// per steradian. Each sample on the view ray is lit by sunlight dimmed on its way down to that
// point, scatters some of it towards the eye, and that light is dimmed again on its way to the eye.
export function skySpectrum(scene, d, out = new Float64Array(NL), steps = 24, sunSteps = 10) {
  out.fill(0);
  const { eye, sunDir, coef } = scene;
  const len = exitDistance(eye, d);
  if (len <= 0) return out;
  const t = viewT, w = viewW;
  const k = samplePath(eye, d, len, steps, t, w);
  // Rays from the eye into the sky are sampled outwards already; sort only the rare others.
  let order = ORDER.subarray(0, k);
  for (let i = 0; i < k; i++) order[i] = i;
  if (-dot(eye, d) > 0) order = Array.from(order).sort((a, b) => t[a] - t[b]);
  const mu = dot(d, sunDir);
  const pr = rayleighPhase(mu), pm = hazePhase(mu);
  let viewR = 0, viewM = 0;
  for (const i of order) {
    q[0] = eye[0] + t[i] * d[0];
    q[1] = eye[1] + t[i] * d[1];
    q[2] = eye[2] + t[i] * d[2];
    const h = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]) - EARTH_RADIUS;
    const dr = density(h, RAYLEIGH_HEIGHT), dm = density(h, HAZE_HEIGHT);
    const halfR = 0.5 * w[i] * dr, halfM = 0.5 * w[i] * dm;
    viewR += halfR;
    viewM += halfM;
    const viewO = scene.ozone > 0 ? ozoneColumn(eye, d, t[i]) : 0;
    const [sr, sm, so] = column(q, sunDir, sunSteps);
    if (sr !== Infinity) {
      const cr = viewR + sr, cm = viewM + sm, co = viewO + so;
      for (let l = 0; l < NL; l++) {
        const tr = Math.exp(-(coef.rayleigh[l] * cr + coef.hazeExtinction[l] * cm + coef.ozoneAbsorption[l] * co));
        out[l] += SUN[l] * (coef.rayleigh[l] * dr * pr + coef.haze[l] * dm * pm) * tr * w[i];
      }
    }
    viewR += halfR;
    viewM += halfM;
  }
  return out;
}

// Share of the direct sunlight at each wavelength that reaches the eye (0 once the sun is below
// the eye's horizon), and how many times more air it crosses than light from straight overhead.
export function sunlight(scene, n = 400) {
  const { eye, sunDir, coef, height } = scene;
  const [cr, cm, co] = column(eye, sunDir, n);
  const [vr] = column(eye, [0, 0, 1], n);
  const transmission = cr === Infinity
    ? coef.rayleigh.map(() => 0)
    : coef.rayleigh.map((b, l) => Math.exp(-(b * cr + coef.hazeExtinction[l] * cm + coef.ozoneAbsorption[l] * co)));
  return { transmission, airMass: cr / vr, column: [cr, cm, co], height };
}

export function sunRGB(scene) {
  const { transmission } = sunlight(scene);
  return spectrumToRGB(transmission.map((tr, l) => tr * SUN[l]));
}

export function skyRGB(scene, elevation, azimuth) {
  return spectrumToRGB(skySpectrum(scene, direction(elevation, azimuth)));
}

// The whole sky seen from below, zenith in the middle, the horizon round the edge and the sun's
// direction at the bottom (an equidistant fisheye). Returns linear RGB for each pixel, which
// pixels are sky, each pixel's brightness Y, and the solid angle each pixel covers (relative).
export function renderDome(scene, size, steps = 20, sunSteps = 8) {
  const rgb = new Float32Array(size * size * 3);
  const sky = new Uint8Array(size * size);
  const lum = new Float32Array(size * size);
  const area = new Float32Array(size * size);
  const spec = new Float64Array(NL);
  const half = size / 2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < Math.ceil(size / 2); i++) {
      const x = (i + 0.5 - half) / half, y = (j + 0.5 - half) / half;
      const r = Math.hypot(x, y);
      if (r > 1) continue;
      const el = (Math.PI / 2) * (1 - r);
      const az = Math.atan2(x, y);
      skySpectrum(scene, direction(el, az), spec, steps, sunSteps);
      const c = spectrumToRGB(spec);
      const bright = brightnessY(spec);
      // Zenith angle theta = r pi / 2, so a pixel covers a solid angle proportional to sin(theta) / theta.
      const theta = (Math.PI / 2) * r;
      const a = theta > 1e-9 ? Math.sin(theta) / theta : 1;
      for (const ii of [i, size - 1 - i]) {
        const o = j * size + ii;
        sky[o] = 1;
        rgb.set(c, o * 3);
        lum[o] = bright;
        area[o] = a;
      }
    }
  }
  return { rgb, sky, lum, area, size };
}

// The view towards the sun: azimuths -span/2..span/2 across, elevations 0..rise up.
export function renderView(scene, width, height, span = 120 * DEG, rise = 40 * DEG, steps = 24, sunSteps = 10) {
  const rgb = new Float32Array(width * height * 3);
  const spec = new Float64Array(NL);
  for (let j = 0; j < height; j++) {
    const el = rise * (1 - (j + 0.5) / height);
    for (let i = 0; i < Math.ceil(width / 2); i++) {
      const az = span * ((i + 0.5) / width - 0.5);
      skySpectrum(scene, direction(el, az), spec, steps, sunSteps);
      const c = spectrumToRGB(spec);
      rgb.set(c, (j * width + i) * 3);
      rgb.set(c, (j * width + width - 1 - i) * 3);
    }
  }
  return { rgb, width, height, span, rise };
}

export function percentileLuminance(rgb, mask, q = 0.95) {
  const ys = [];
  for (let o = 0; o < rgb.length / 3; o++) {
    if (mask && !mask[o]) continue;
    ys.push(luminance([rgb[3 * o], rgb[3 * o + 1], rgb[3 * o + 2]]));
  }
  ys.sort((a, b) => a - b);
  return ys[Math.floor(q * (ys.length - 1))] || 0;
}

// Mean brightness of the sky over the hemisphere, each pixel weighted by its solid angle.
export function meanBrightness(dome) {
  let sum = 0, weight = 0;
  for (let o = 0; o < dome.sky.length; o++) {
    if (!dome.sky[o]) continue;
    sum += dome.lum[o] * dome.area[o];
    weight += dome.area[o];
  }
  return weight ? sum / weight : 0;
}

// An exposure that puts the bright end of the sky (its 95th percentile) at a comfortable brightness.
export const KEY = 0.6;
export function exposureFor(rgb, mask) {
  const y = percentileLuminance(rgb, mask);
  return y > 0 ? KEY / y : 1;
}
