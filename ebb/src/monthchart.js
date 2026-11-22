// Chart of the equilibrium tide through a window of days: the water height at
// one point on the equator, rising and falling twice a day, under a strip of
// new and full moons, quarters, perigees and apogees.

import { moonPosition, sunPosition } from './ephemeris.js';
import { moon, sun, heightFromBody } from './tides.js';
import { calendarDate, monthName, jdeToUtc } from './time.js';
import { events, kingTides } from './month.js';

const AU = 1.495978707e11;
const RAD = Math.PI / 180;

// Angle (degrees) the Greenwich meridian has turned through, measured like an
// ecliptic longitude: mean sidereal time (Meeus 12.4).
export function earthTurn(jd) {
  const t = jd - 2451545.0;
  const T = t / 36525;
  const deg = 280.46061837 + 360.98564736629 * t + 0.000387933 * T * T;
  return ((deg % 360) + 360) % 360;
}

// Height (m) of the equilibrium tide at a point on the equator `lon` degrees
// east of Greenwich, with the Moon and the Sun treated as on the equator.
export function heightOnEquator(jde, lon = 0) {
  const m = moonPosition(jde);
  const s = sunPosition(jde);
  const here = earthTurn(jdeToUtc(jde)) + lon;
  return heightFromBody((here - m.lon) * RAD, moon(0, m.dist * 1000))
    + heightFromBody((here - s.lon) * RAD, sun(0, s.dist * AU));
}

export function heightSeries(start, days, stepHours = 0.5, lon = 0) {
  const out = [];
  const step = stepHours / 24;
  for (let t = 0; t <= days + 1e-9; t += step) out.push({ jde: start + t, h: heightOnEquator(start + t, lon) });
  return out;
}

export const CHART = { w: 860, h: 300, left: 52, right: 14, top: 58, bottom: 34 };

const f1 = (v) => (Math.round(v * 10) / 10).toString();

export function chartScales(start, days, ymin = -0.5, ymax = 0.6) {
  const { w, h, left, right, top, bottom } = CHART;
  const x = (jde) => left + ((jde - start) / days) * (w - left - right);
  const y = (m) => top + ((ymax - m) / (ymax - ymin)) * (h - top - bottom);
  const jdeAt = (px) => start + ((px - left) / (w - left - right)) * days;
  return { x, y, jdeAt, ymin, ymax };
}

const ICON = { new: '●', full: '○', perigee: 'P', apogee: 'A' };

export function renderMonth({ start, days = 59, selected = null, lon = 0 }) {
  const series = heightSeries(start, days, 0.5, lon);
  const top = Math.max(0.6, ...series.map((p) => p.h + 0.05));
  const bot = Math.min(-0.5, ...series.map((p) => p.h - 0.05));
  const sc = chartScales(start, days, bot, top);
  const evts = events(start, start + days);
  const kings = kingTides(evts);
  const { w, h, left, right, top: T, bottom } = CHART;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="month" role="img" aria-labelledby="month-title month-desc">`);
  out.push('<title id="month-title">Tide height at a point on the equator, day by day</title>');
  out.push(`<desc id="month-desc">${describe(evts, kings)}</desc>`);
  for (const k of kings) {
    const x0 = sc.x(Math.min(k.jde, k.perigee.jde) - 1);
    const x1 = sc.x(Math.max(k.jde, k.perigee.jde) + 1);
    out.push(`<rect class="king" x="${f1(Math.max(left, x0))}" y="${T - 4}" width="${f1(Math.min(w - right, x1) - Math.max(left, x0))}" height="${h - T - bottom + 4}"/>`);
  }
  // Gridlines: centimetres and the first of each month.
  for (let cm = Math.ceil(bot * 10) * 10; cm <= top * 100; cm += 20) {
    const y = sc.y(cm / 100);
    out.push(`<line class="grid${cm === 0 ? ' zero' : ''}" x1="${left}" x2="${w - right}" y1="${f1(y)}" y2="${f1(y)}"/>`);
    out.push(`<text class="tick" x="${left - 6}" y="${f1(y + 4)}" text-anchor="end">${cm}</text>`);
  }
  out.push(`<text class="tick" x="${left - 6}" y="${T - 14}" text-anchor="end">cm</text>`);
  for (let d = 0; d <= days; d += 1) {
    const c = calendarDate(jdeToUtc(start + d));
    if (c.day === 1 || d === 0) {
      const x = sc.x(start + d);
      out.push(`<line class="grid" x1="${f1(x)}" x2="${f1(x)}" y1="${T}" y2="${h - bottom}"/>`);
      out.push(`<text class="tick" x="${f1(x + 4)}" y="${h - bottom + 18}">${c.day} ${monthName(c.month)}</text>`);
    }
  }
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${f1(sc.x(p.jde))},${f1(sc.y(p.h))}`).join('');
  out.push(`<path class="height" d="${path}"/>`);
  for (const e of evts) {
    const x = sc.x(e.jde);
    const row = e.kind === 'new' || e.kind === 'full' ? T - 34 : T - 14;
    out.push(`<text class="ev ev-${e.kind}" x="${f1(x)}" y="${row}" text-anchor="middle"><title>${eventLabel(e)}</title>${ICON[e.kind]}</text>`);
  }
  if (selected !== null && selected >= start && selected <= start + days) {
    const x = sc.x(selected);
    out.push(`<line class="cursor" x1="${f1(x)}" x2="${f1(x)}" y1="${T - 4}" y2="${h - bottom}"/>`);
  }
  out.push('</svg>');
  return { svg: out.join(''), events: evts, kings, scales: sc, series };
}

const pad = (n) => String(n).padStart(2, '0');
export function when(jde) {
  const c = calendarDate(jdeToUtc(jde));
  return `${c.day} ${monthName(c.month)} ${c.year}, ${pad(c.hour)}:${pad(c.minute)} UTC`;
}

export function eventLabel(e) {
  if (e.kind === 'new') return `New moon, ${when(e.jde)}`;
  if (e.kind === 'full') return `Full moon, ${when(e.jde)}`;
  const km = Math.round(e.km).toLocaleString('en-US');
  return `${e.kind === 'perigee' ? 'Perigee (Moon nearest)' : 'Apogee (Moon farthest)'}, ${when(e.jde)}, ${km} km`;
}

function describe(evts, kings) {
  const parts = [`${evts.filter((e) => e.kind === 'new' || e.kind === 'full').length} new and full moons`];
  if (kings.length) parts.push(`perigean spring tides near ${kings.map((k) => when(k.jde).split(',')[0]).join(' and ')}`);
  return `${parts.join('; ')}.`;
}
