// Calendar dates and Julian days (Meeus chapter 7), Gregorian calendar only.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

export function calendarDate(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const A = z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFrac = B - D - Math.floor(30.6001 * E) + f;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const day = Math.floor(dayFrac);
  let minutes = Math.round((dayFrac - day) * 1440);
  if (minutes === 1440) return calendarDate(Math.ceil(jd * 1440) / 1440 + 1e-9);
  const hour = Math.floor(minutes / 60);
  minutes -= hour * 60;
  return { year, month, day, hour, minute: minutes };
}

// Terrestrial time runs a little over a minute ahead of clock time in the
// 2020s. The Espenak-Meeus polynomial covers 2005-2050 and is held flat beyond;
// the error that leaves only matters to the minute.
export function deltaT(year) {
  const y = Math.min(2050, Math.max(2005, year));
  const t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

export function utcToJde(jd) {
  const { year } = calendarDate(jd);
  return jd + deltaT(year) / 86400;
}

export function jdeToUtc(jde) {
  const { year } = calendarDate(jde);
  return jde - deltaT(year) / 86400;
}

const pad = (n) => String(n).padStart(2, '0');

export function formatDate(jd) {
  const c = calendarDate(jd);
  return `${c.day} ${MONTHS[c.month - 1]} ${c.year}`;
}

export function formatDateTime(jd) {
  const c = calendarDate(jd);
  return `${c.day} ${MONTHS[c.month - 1]} ${c.year}, ${pad(c.hour)}:${pad(c.minute)} UTC`;
}

export function monthName(m) {
  return MONTHS[m - 1];
}
