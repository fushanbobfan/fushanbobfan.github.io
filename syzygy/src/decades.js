// Many years side by side: the eclipse seasons slide about 19 days earlier each
// year, and every eclipse returns, nearly the same, one saros later.

import { buildYear } from './year.js';
import { SYNODIC_MONTH } from './eclipses.js';
import { formatDate, jdeToUtc, calendarDate } from './time.js';
import { eclipseLabel } from './story.js';

export const SAROS = 223 * SYNODIC_MONTH; // days, about 18 years 11 days
export const SPAN = 37; // rows: two saros cycles

export function windowYears(center, min, max, span = SPAN) {
  const half = Math.floor(span / 2);
  let first = Math.max(min, center - half);
  first = Math.min(first, Math.max(min, max - span + 1));
  const years = [];
  for (let y = first; y < first + span && y <= max; y++) years.push(y);
  return years;
}

export function eclipseId(e) {
  return `${e.kind}-${e.greatest.toFixed(4)}`;
}

// Rows for the grid, reusing years already built.
export function decadeRows(years, tilt, cache = new Map()) {
  return years.map((year) => {
    const key = `${year}:${tilt}`;
    if (!cache.has(key)) {
      const y = buildYear(year, tilt, { step: 1 });
      cache.set(key, { year, start: y.start, end: y.end, seasons: y.seasons, eclipses: y.eclipses });
    }
    return cache.get(key);
  });
}

// The eclipses of the same kind that fall a whole number of saros cycles from
// `target`, with that number. A saros member returns within a few hours.
export function sarosFamily(target, rows) {
  const out = [];
  for (const row of rows) {
    for (const e of row.eclipses) {
      if (e.kind !== target.kind) continue;
      const cycles = (e.greatest - target.greatest) / SAROS;
      const n = Math.round(cycles);
      if (Math.abs(cycles - n) * SAROS < 0.5) out.push({ e, n });
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

export function findEclipse(rows, id) {
  for (const row of rows) {
    const hit = row.eclipses.find((e) => eclipseId(e) === id);
    if (hit) return hit;
  }
  return null;
}

const W = 900;
const ROW = 14;
const TOP = 26;
const LEFT = 52;
const RIGHT = 12;

export function gridSize(rows) {
  return { width: W, height: TOP + rows.length * ROW + 8 };
}

export function renderDecades(rows, { currentYear, selectedId } = {}) {
  const { height } = gridSize(rows);
  const plotW = W - LEFT - RIGHT;
  const x = (row, jde) => LEFT + ((jde - row.start) / (row.end - row.start)) * plotW;
  const yMid = (i) => TOP + i * ROW + ROW / 2;
  const selected = selectedId ? findEclipse(rows, selectedId) : null;
  const family = selected ? sarosFamily(selected, rows) : [];
  const familyIds = new Set(family.map((f) => eclipseId(f.e)));

  let body = '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  months.forEach((m, k) => {
    const xm = LEFT + (k / 12) * plotW;
    body += `<line class="grid" x1="${xm.toFixed(1)}" y1="${TOP - 4}" x2="${xm.toFixed(1)}" y2="${height - 8}"/>`;
    body += `<text class="tick" x="${(xm + 3).toFixed(1)}" y="${TOP - 10}">${m}</text>`;
  });
  rows.forEach((row, i) => {
    const y0 = TOP + i * ROW;
    if (row.year === currentYear) {
      body += `<rect class="current-row" x="0" y="${y0}" width="${W}" height="${ROW}"/>`;
    }
    body += `<text class="year${row.year === currentYear ? ' current' : ''}" x="${LEFT - 8}" y="${(y0 + ROW - 3).toFixed(1)}" text-anchor="end">${row.year}</text>`;
    for (const s of row.seasons) {
      const x0 = x(row, s.start);
      body += `<rect class="season" x="${x0.toFixed(1)}" y="${y0 + 2}" width="${(x(row, s.end) - x0).toFixed(1)}" height="${ROW - 4}"/>`;
    }
  });
  if (family.length > 1) {
    const pts = family.map(({ e }) => {
      const i = rows.findIndex((r) => e.greatest >= r.start && e.greatest < r.end);
      return `${x(rows[i], e.greatest).toFixed(1)},${yMid(i).toFixed(1)}`;
    });
    body += `<polyline class="saros-line" points="${pts.join(' ')}"/>`;
  }
  rows.forEach((row, i) => {
    for (const e of row.eclipses) {
      const id = eclipseId(e);
      const cls = ['mark', e.kind];
      if (id === selectedId) cls.push('selected');
      else if (familyIds.has(id)) cls.push('family');
      const label = `${eclipseLabel(e)} eclipse, ${formatDate(jdeToUtc(e.greatest))}`;
      const cx = x(row, e.greatest).toFixed(1);
      const cy = yMid(i).toFixed(1);
      body += `<g class="${cls.join(' ')}" data-id="${id}" role="button" tabindex="0" aria-pressed="${id === selectedId}" aria-label="${label}">`
        + `<title>${label}</title><circle cx="${cx}" cy="${cy}" r="${e.kind === 'new' ? 4 : 3.6}"/></g>`;
    }
  });

  const label = `Eclipse seasons and eclipses from ${rows[0].year} to ${rows[rows.length - 1].year}, one row per year.`;
  return `<svg viewBox="0 0 ${W} ${height}" class="decades" role="group" aria-label="${label}">${body}</svg>`;
}

function yearsAndDays(days) {
  const c = calendarDate(2451545 + days);
  return { years: c.year - 2000, days: Math.round(days - 365.25 * (c.year - 2000)) };
}

// A sentence about the selected eclipse and its saros relatives in view.
export function sarosText(target, rows) {
  if (!target) return '';
  const family = sarosFamily(target, rows);
  const name = `The ${eclipseLabel(target).toLowerCase()} eclipse of ${formatDate(jdeToUtc(target.greatest))}`;
  const others = family.filter((f) => f.n !== 0)
    .map(({ e, n }) => `${formatDate(jdeToUtc(e.greatest))} (${n > 0 ? '+' : ''}${n}, ${e.eclipse})`);
  const gap = yearsAndDays(SAROS);
  const lead = `${name} repeats after one saros, 223 new moons or ${gap.years} years ${gap.days} days, when the Sun, the Moon and the line of nodes stand almost as they did.`;
  if (!others.length) return `${lead} No other member of its series falls in these years.`;
  return `${lead} Members of its series in view: ${others.join(', ')}.`;
}
