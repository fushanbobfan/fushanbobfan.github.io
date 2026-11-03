import { julianDay, dateOf } from './orbits.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Dates are shown in UTC, which is what the elements are reckoned in.
export function day(jd) {
  const d = dateOf(jd + 1e-6);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function isoDay(jd) {
  return dateOf(jd + 1e-6).toISOString().slice(0, 10);
}

export function fromIsoDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : julianDay(d);
}

export function days(n) {
  const r = Math.round(Math.abs(n));
  return `${r} day${r === 1 ? '' : 's'}`;
}

export function degrees(d, places = 1) {
  return `${d.toFixed(places)}°`;
}

// Arcminutes for small daily motions, degrees for larger ones.
export function motion(perDay) {
  const a = Math.abs(perDay);
  const dir = perDay < 0 ? 'west' : 'east';
  if (a < 1 / 60 * 0.5) return 'standing still';
  if (a < 1) return `${(a * 60).toFixed(1)}′ a day ${dir}`;
  return `${a.toFixed(2)}° a day ${dir}`;
}

// The first of each month between jd0 and jd1, labelled sparsely enough to
// stay legible: every month in a short window, every third in a long one.
export function monthTicks(jd0, jd1) {
  const start = dateOf(jd0);
  let y = start.getUTCFullYear(), m = start.getUTCMonth();
  const out = [];
  for (;;) {
    if (m > 11) { m = 0; y++; }
    const jd = julianDay(new Date(Date.UTC(y, m, 1)));
    if (jd > jd1) break;
    if (jd >= jd0) out.push({ jd, month: m, year: y });
    m++;
  }
  const every = out.length <= 8 ? 1 : out.length <= 16 ? 2 : 3;
  for (const t of out) {
    t.label = t.month % every === 0 ? (t.month === 0 ? `${MONTHS[0]} ${t.year}` : MONTHS[t.month]) : '';
  }
  return out;
}
