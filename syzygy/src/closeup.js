// A close look at greatest eclipse: how deep it goes, and the discs drawn to
// scale on the sky.

import { moonPosition, sunPosition, wrap180, norm360 } from './ephemeris.js';
import { geometry, limits } from './eclipses.js';

const RAD = Math.PI / 180;
const EARTH_RADIUS = 6378.14;
const MOON_RADIUS = 1737.4;

// Lunar: how far into each shadow the Moon reaches, in Moon diameters.
// Solar: the fraction of the Sun's diameter covered at the place on Earth where
// the eclipse is deepest (for a central eclipse, the ratio of apparent sizes).
export function magnitude(e) {
  const g = geometry(e.greatest);
  const lim = limits(g);
  if (e.kind === 'full') {
    return {
      umbral: (lim.umbra + g.moonRadius - e.gap) / (2 * g.moonRadius),
      penumbral: (lim.penumbra + g.moonRadius - e.gap) / (2 * g.moonRadius),
    };
  }
  const central = g.moonParallax - g.sunParallax;
  if (e.gap < central) {
    const depth = Math.sqrt(Math.max(0, 1 - (e.gap / g.moonParallax) ** 2));
    const near = Math.asin(MOON_RADIUS / (g.moonDist - EARTH_RADIUS * depth)) / RAD;
    return { solar: near / g.sunRadius };
  }
  // Seen from the edge of the Earth nearest the shadow, the Moon shifts by
  // its parallax toward the Sun and looks slightly larger.
  const near = Math.asin(MOON_RADIUS / Math.sqrt(g.moonDist ** 2 - EARTH_RADIUS ** 2)) / RAD;
  const apart = e.gap - central;
  return { solar: Math.max(0, (g.sunRadius + near - apart) / (2 * g.sunRadius)) };
}

// Position of the Moon relative to the Sun's centre (solar) or the shadow's
// centre (lunar), in degrees on the sky: x eastward along the ecliptic, y north.
// `scale` stretches the latitude as the tilt slider does.
export function offset(jde, kind, scale = 1) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  const axis = kind === 'new' ? s.lon : norm360(s.lon + 180);
  return { x: wrap180(m.lon - axis) * Math.cos(m.lat * scale * RAD), y: m.lat * scale };
}

// The Moon's track over the hours around greatest eclipse.
export function track(e, scale = 1, hours = 3, step = 0.25) {
  const pts = [];
  for (let h = -hours; h <= hours + 1e-9; h += step) pts.push(offset(e.greatest + h / 24, e.kind, scale));
  return pts;
}

const SIZE = 340;
const f1 = (v) => v.toFixed(1);

function polyline(points, map) {
  return points.map((p) => map(p).map(f1).join(',')).join(' ');
}

// The discs at greatest eclipse, north up and east to the left as on the sky.
export function renderCloseup(e, scale = 1) {
  const g = geometry(e.greatest);
  const lim = limits(g);
  const c = SIZE / 2;
  const path = track(e, scale);
  const here = offset(e.greatest, e.kind, scale);
  let shift = { x: 0, y: 0 };
  let moonR = g.moonRadius;
  let body;
  let half;
  if (e.kind === 'full') {
    half = lim.penumbra + 2.2 * g.moonRadius;
  } else {
    half = 4 * g.sunRadius;
    // Seen from the place where the eclipse is deepest, parallax moves the Moon
    // toward the Sun by up to the Earth's apparent radius.
    const len = Math.hypot(here.x, here.y) || 1;
    const move = Math.min(len, g.moonParallax - g.sunParallax);
    shift = { x: (-here.x / len) * move, y: (-here.y / len) * move };
    // Use the same observer as the magnitude: on the central line for a central
    // eclipse, at the edge of the Earth otherwise.
    moonR = e.gap < g.moonParallax - g.sunParallax
      ? magnitude(e).solar * g.sunRadius
      : Math.asin(MOON_RADIUS / Math.sqrt(g.moonDist ** 2 - EARTH_RADIUS ** 2)) / RAD;
  }
  const k = (SIZE / 2 - 10) / half;
  const map = (p) => [c - (p.x + shift.x) * k, c - (p.y + shift.y) * k];
  const [mx, my] = map(here);
  if (e.kind === 'full') {
    body = `<circle class="penumbra" cx="${c}" cy="${c}" r="${f1(lim.penumbra * k)}"/>`
      + `<circle class="umbra" cx="${c}" cy="${c}" r="${f1(lim.umbra * k)}"/>`
      + `<text class="cu-note" x="${c}" y="${f1(c - lim.umbra * k + 14)}" text-anchor="middle">umbra</text>`
      + `<text class="cu-note" x="${c}" y="${f1(c - lim.penumbra * k + 14)}" text-anchor="middle">penumbra</text>`;
  } else {
    body = `<circle class="cu-sun" cx="${c}" cy="${c}" r="${f1(g.sunRadius * k)}"/>`;
  }
  const what = e.kind === 'full' ? 'the Earth’s shadow' : 'the Sun';
  const label = `Close-up at greatest eclipse: the Moon’s disc against ${what}, with its path over six hours.`;
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" class="closeup ${e.kind}" role="img" aria-label="${label}">`
    + body
    + `<polyline class="cu-track" points="${polyline(path, map)}"/>`
    + `<circle class="cu-moon" cx="${f1(mx)}" cy="${f1(my)}" r="${f1(moonR * k)}"/>`
    + (e.kind === 'new' ? `<circle class="cu-sun-edge" cx="${c}" cy="${c}" r="${f1(g.sunRadius * k)}"/>` : '')
    + `<text class="cu-note" x="8" y="${SIZE - 8}">north up, east left</text>`
    + '</svg>';
}

const pct = (v) => `${Math.round(v * 100)}%`;

export function closeupText(e) {
  const m = magnitude(e);
  if (e.kind === 'full') {
    const u = m.umbral.toFixed(2);
    if (m.umbral >= 1) return `Umbral magnitude ${u}: the whole Moon is inside the dark shadow, whose edge lies ${pct(m.umbral - 1)} of a Moon’s width beyond it.`;
    if (m.umbral > 0) return `Umbral magnitude ${u}: at greatest eclipse ${pct(m.umbral)} of the Moon’s diameter is inside the dark shadow.`;
    return `Umbral magnitude ${u}: the Moon misses the dark shadow; at greatest eclipse ${pct(Math.min(1, m.penumbral))} of its diameter is inside the faint outer shadow, which only dims it slightly.`;
  }
  const s = m.solar.toFixed(3);
  if (e.eclipse === 'partial') return `Magnitude ${s}: where the eclipse is deepest, near the edge of the Earth, the Moon covers ${pct(m.solar)} of the Sun’s diameter.`;
  return m.solar >= 1
    ? `Magnitude ${s}: where the eclipse is deepest, the Moon looks ${pct(m.solar - 1)} wider than the Sun and hides it completely.`
    : `Magnitude ${s}: where the eclipse is deepest, the Moon looks ${pct(1 - m.solar)} narrower than the Sun and leaves a bright ring.`;
}
