// The Earth seen from above its equator: arrows for the Moon's (and Sun's)
// pull or tidal pull, and the ocean drawn as the equilibrium tide. Returns
// SVG markup so it can be tested without a page.

import { pull, tidalTotal, heightAt, profile, EARTH_RADIUS, MOON_MEAN_DISTANCE } from './tides.js';

export const VIEW = { x: -3.1, y: -3.1, w: 6.2, h: 6.2 };
const MOON_DRAWN_AT = 2.45;
const BULGE_DRAWN = 0.2;
const ARROW_LONGEST = 0.5;

export function samplePoints() {
  const pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * 2 * Math.PI;
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  for (let i = 0; i < 12; i += 1) {
    const a = ((i + 0.5) / 12) * 2 * Math.PI;
    pts.push({ x: 0.55 * Math.cos(a), y: 0.55 * Math.sin(a) });
  }
  return pts;
}

// Arrows for one picture. Lengths are proportional to the acceleration within
// the picture; `longest` is the acceleration (m/s^2) of the longest arrow.
export function arrows(bodies, mode) {
  const pts = samplePoints();
  const vectors = pts.map((p) => {
    if (mode === 'pull') {
      const sum = bodies.reduce((acc, b) => {
        const v = pull(p, b);
        return { x: acc.x + v.x, y: acc.y + v.y };
      }, { x: 0, y: 0 });
      return { p, v: sum };
    }
    return { p, v: tidalTotal(p, bodies) };
  });
  const longest = Math.max(...vectors.map(({ v }) => Math.hypot(v.x, v.y)));
  const scale = longest > 0 ? ARROW_LONGEST / longest : 0;
  return {
    longest,
    list: vectors.map(({ p, v }) => ({
      x1: p.x, y1: p.y, x2: p.x + v.x * scale, y2: p.y + v.y * scale, size: Math.hypot(v.x, v.y) * scale,
    })),
  };
}

// The ocean surface as radius against angle: mean radius 1, the tide drawn
// so the largest departure is BULGE_DRAWN Earth radii. `exaggeration` says
// how many times larger than life that is.
export function ocean(bodies, samples = 180) {
  const pr = profile(bodies);
  const biggest = Math.max(Math.abs(pr.high), Math.abs(pr.low));
  const k = biggest > 0 ? BULGE_DRAWN / biggest : 0;
  const pts = [];
  for (let i = 0; i < samples; i += 1) {
    const phi = (i / samples) * 2 * Math.PI;
    const r = 1 + k * heightAt(phi, bodies);
    pts.push({ x: r * Math.cos(phi), y: r * Math.sin(phi) });
  }
  return { pts, exaggeration: biggest > 0 ? (BULGE_DRAWN * EARTH_RADIUS) / biggest : 0 };
}

const f = (v) => (Math.round(v * 1000) / 1000).toString();
// SVG y grows downward; the physics uses y up.
const pt = (p) => `${f(p.x)},${f(-p.y)}`;

export function moonMarker(angle) {
  return { x: MOON_DRAWN_AT * Math.cos(angle), y: MOON_DRAWN_AT * Math.sin(angle) };
}

// Labels sit beside a body, at right angles to the line from the Earth, so the
// Moon's and the Sun's never collide when the two line up.
const labelAt = (x, y, a, r) => ({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });

export function renderField({ moonBody, sunBody, mode = 'tidal', showOcean = true }) {
  const bodies = sunBody ? [moonBody, sunBody] : [moonBody];
  const ar = arrows(bodies, mode);
  const oc = ocean(bodies);
  const m = moonMarker(moonBody.angle);
  const moonR = 0.27 * Math.cbrt(MOON_MEAN_DISTANCE / moonBody.distance);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" role="img" aria-labelledby="field-title">`);
  out.push(`<title id="field-title">${mode === 'pull' ? 'The Moon\'s pull' : 'The tidal pull'} across the Earth${sunBody ? ', Sun included' : ''}</title>`);
  out.push('<defs><marker id="head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>');
  if (sunBody) {
    const sx = 2.8 * Math.cos(sunBody.angle);
    const sy = 2.8 * Math.sin(sunBody.angle);
    const lx = 1.75 * Math.cos(sunBody.angle);
    const ly = 1.75 * Math.sin(sunBody.angle);
    out.push(`<g class="sun-ray"><line x1="${f(lx)}" y1="${f(-ly)}" x2="${f(sx)}" y2="${f(-sy)}"/></g>`);
    out.push(`<circle class="sun" cx="${f(sx)}" cy="${f(-sy)}" r="0.18"/>`);
    const sl = labelAt(sx, sy, sunBody.angle - Math.PI / 2, 0.42);
    out.push(`<text class="label" x="${f(sl.x)}" y="${f(-sl.y)}" dy="0.07" text-anchor="middle">Sun</text>`);
  }
  if (showOcean) {
    out.push(`<polygon class="ocean" points="${oc.pts.map(pt).join(' ')}"/>`);
    out.push('<circle class="mean-sea" cx="0" cy="0" r="1"/>');
  }
  out.push('<circle class="earth" cx="0" cy="0" r="0.86"/>');
  out.push('<g class="arrows">');
  for (const a of ar.list) {
    if (a.size < 0.02) {
      out.push(`<circle class="dot" cx="${f(a.x1)}" cy="${f(-a.y1)}" r="0.025"/>`);
    } else {
      out.push(`<line x1="${f(a.x1)}" y1="${f(-a.y1)}" x2="${f(a.x2)}" y2="${f(-a.y2)}" marker-end="url(#head)"/>`);
    }
  }
  out.push('</g>');
  out.push(`<circle class="moon" id="moon-handle" cx="${f(m.x)}" cy="${f(-m.y)}" r="${f(moonR)}" tabindex="-1"/>`);
  const ml = labelAt(m.x, m.y, moonBody.angle + Math.PI / 2, moonR + 0.3);
  out.push(`<text class="label" x="${f(ml.x)}" y="${f(-ml.y)}" dy="0.07" text-anchor="middle">Moon</text>`);
  out.push('</svg>');
  return { svg: out.join(''), longest: ar.longest, exaggeration: oc.exaggeration, arrows: ar.list.length };
}
