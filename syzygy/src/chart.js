// The year at a glance: the Moon's height above the Sun's path, every new and
// full moon on it, and the window each must fall inside to be an eclipse.

import { calendarDate, monthName, formatDate, jdeToUtc } from './time.js';
import { eclipseLabel } from './story.js';

export const W = 900;
export const H = 330;
const M = { l: 58, r: 18, t: 46, b: 34 };

const f1 = (x) => x.toFixed(1);

export function yRange(tilt) {
  return Math.max(2.5, Math.ceil(tilt + 0.6));
}

export function scales(data) {
  const ymax = yRange(data.tilt);
  const x = (jde) => M.l + ((jde - data.start) / (data.end - data.start)) * (W - M.l - M.r);
  const y = (lat) => M.t + ((ymax - lat) / (2 * ymax)) * (H - M.t - M.b);
  return { x, y, ymax };
}

function monthTicks(data, x) {
  let out = '';
  for (let m = 1; m <= 12; m++) {
    const jd = data.start + daysBefore(data.year, m);
    const xm = x(jd);
    out += `<line class="grid" x1="${f1(xm)}" y1="${M.t}" x2="${f1(xm)}" y2="${H - M.b}"/>`;
    out += `<text class="tick" x="${f1(xm + 4)}" y="${H - M.b + 18}">${monthName(m)}</text>`;
  }
  return out;
}

function daysBefore(year, month) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const len = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return len.slice(0, month - 1).reduce((a, b) => a + b, 0);
}

function latitudeTicks(ymax, y) {
  let out = '';
  const step = ymax > 6 ? 2 : 1;
  for (let v = -ymax; v <= ymax; v += step) {
    out += `<text class="tick" x="${M.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end">${v > 0 ? '+' : ''}${v}°</text>`;
  }
  return out;
}

export function curvePath(data, x, y) {
  return data.samples
    .map((s, i) => `${i ? 'L' : 'M'}${f1(x(s.jde))} ${f1(y(s.lat))}`)
    .join('');
}

function windowLimit(e) {
  return e.kind === 'new' ? e.limits.solarPartial : e.limits.lunarPenumbral;
}

function eventMark(e, x, y) {
  const xe = x(e.jde);
  const lim = windowLimit(e);
  const sign = e.lat < 0 ? -1 : 1;
  const ye = y(sign * e.gap);
  const date = formatDate(jdeToUtc(e.greatest));
  const what = e.kind === 'new' ? 'New moon' : 'Full moon';
  const verdict = e.eclipse ? eclipseLabel(e) : 'no eclipse';
  const title = `${what}, ${date}: ${e.gap.toFixed(2)}° from the ${e.kind === 'new' ? 'Sun' : "shadow's centre"} (eclipse within ${lim.toFixed(2)}°), ${verdict}`;
  return `<g class="event ${e.kind}${e.eclipse ? ' hit' : ''}">`
    + `<title>${title}</title>`
    + `<line class="window" x1="${f1(xe)}" y1="${f1(y(lim))}" x2="${f1(xe)}" y2="${f1(y(-lim))}"/>`
    + `<circle class="dot" cx="${f1(xe)}" cy="${f1(ye)}" r="${e.eclipse ? 6 : 4.5}"/>`
    + '</g>';
}

// Labels above the plot, nudged apart when two eclipses fall close together.
function eclipseLabels(data, x) {
  let out = '';
  let lastX = -Infinity;
  let row = 0;
  for (const e of data.eclipses) {
    const xe = x(e.jde);
    row = xe - lastX < 120 ? (row + 1) % 2 : 0;
    lastX = xe;
    const c = calendarDate(jdeToUtc(e.greatest));
    const ty = 16 + row * 15;
    const anchor = xe > W - 90 ? 'end' : xe < M.l + 60 ? 'start' : 'middle';
    out += `<text class="label ${e.kind}" x="${f1(xe)}" y="${ty}" text-anchor="${anchor}">${eclipseLabel(e)} · ${c.day} ${monthName(c.month)}</text>`;
    out += `<line class="leader" x1="${f1(xe)}" y1="${ty + 4}" x2="${f1(xe)}" y2="${M.t}"/>`;
  }
  return out;
}

export function renderChart(data, cursorJde) {
  const { x, y, ymax } = scales(data);
  const seasons = data.seasons.map((s) => {
    const x0 = x(s.start);
    const x1 = x(s.end);
    return `<rect class="season" x="${f1(x0)}" y="${M.t}" width="${f1(x1 - x0)}" height="${H - M.t - M.b}"/>`;
  }).join('');
  const total = data.solarCount + data.lunarCount;
  const label = `The Moon's height above the Sun's path through ${data.year}. `
    + `${data.events.length} new and full moons, ${total} of them eclipses: `
    + `${data.solarCount} solar and ${data.lunarCount} lunar.`;
  const cx = cursorJde == null ? null : x(cursorJde);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" class="chart">`
    + `<g class="seasons">${seasons}</g>`
    + monthTicks(data, x)
    + latitudeTicks(ymax, y)
    + `<line class="ecliptic" x1="${M.l}" y1="${f1(y(0))}" x2="${W - M.r}" y2="${f1(y(0))}"/>`
    + `<text class="axis-note" x="${W - M.r - 4}" y="${f1(y(0) - 6)}" text-anchor="end">the Sun's path</text>`
    + `<path class="moon-curve" d="${curvePath(data, x, y)}"/>`
    + data.events.map((e) => eventMark(e, x, y)).join('')
    + eclipseLabels(data, x)
    + (cx == null ? '' : `<line id="cursor" class="cursor" x1="${f1(cx)}" y1="${M.t}" x2="${f1(cx)}" y2="${H - M.b}"/>`)
    + `<text class="axis-title" x="14" y="${f1((M.t + H - M.b) / 2)}" transform="rotate(-90 14 ${f1((M.t + H - M.b) / 2)})" text-anchor="middle">Moon above or below</text>`
    + '</svg>';
}

// Turn a click on the chart into a date.
export function jdeAt(data, svgX) {
  const t = data.start + ((svgX - M.l) / (W - M.l - M.r)) * (data.end - data.start);
  return Math.min(data.end - 1e-6, Math.max(data.start, t));
}
