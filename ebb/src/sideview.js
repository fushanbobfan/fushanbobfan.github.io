// Two drawings for the tide at a latitude: the Earth cut through its axis with
// the Moon's tilted bulge, and two days of water height at the place.

import { heightFrom } from './latitude.js';
import { calendarDate, jdeToUtc, monthName } from './time.js';

const RAD = Math.PI / 180;
const f2 = (v) => (Math.round(v * 1000) / 1000).toString();
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const cmText = (m) => `${m >= 0 ? '+' : '−'}${Math.abs(Math.round(m * 100))} cm`;

// The meridian plane through the Moon: the axis points up, the Moon is off to
// the right at its declination. `amp` is the Moon's tide amplitude (m).
export function renderSide({ dec, lat, amp }) {
  const k = 0.2 / amp;
  const pts = [];
  for (let i = 0; i < 180; i += 1) {
    const th = (i / 180) * 360;
    // In this plane a point at angle th sits th - dec from the Moon, which is
    // what heightFrom gives for "latitude" th at hour angle zero.
    const r = 1 + k * heightFrom(amp, th, dec, 0);
    pts.push(`${f2(r * Math.cos(th * RAD))},${f2(-r * Math.sin(th * RAD))}`);
  }
  const nearH = heightFrom(amp, lat, dec, 0);
  const farH = heightFrom(amp, lat, dec, 180);
  const rNear = 1 + k * nearH;
  const rFar = 1 + k * farH;
  const y = Math.sin(lat * RAD);
  const x = Math.cos(lat * RAD);
  const near = { x: rNear * x, y: rNear * y };
  const far = { x: -rFar * x, y: rFar * y };
  const mx = 1.95 * Math.cos(dec * RAD);
  const my = 1.95 * Math.sin(dec * RAD);
  const out = [];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.3 -1.6 4.6 3.2" class="side" role="img" aria-labelledby="side-title side-desc">');
  out.push('<title id="side-title">The Earth cut through its axis, with the Moon\'s tilted bulge</title>');
  out.push(`<desc id="side-desc">At latitude ${Math.round(lat)}°, the high water facing the Moon is ${cmText(nearH)} and the one twelve hours later is ${cmText(farH)}.</desc>`);
  out.push(`<polygon class="ocean" points="${pts.join(' ')}"/>`);
  out.push('<circle class="earth" cx="0" cy="0" r="0.86"/>');
  out.push('<line class="axis" x1="0" y1="-1.38" x2="0" y2="1.38"/>');
  out.push('<line class="equator" x1="-1.25" y1="0" x2="1.25" y2="0"/>');
  out.push(`<line class="moon-line" x1="0" y1="0" x2="${f2(mx)}" y2="${f2(-my)}"/>`);
  out.push(`<line class="moon-line" x1="0" y1="0" x2="${f2(-1.3 * Math.cos(dec * RAD))}" y2="${f2(1.3 * Math.sin(dec * RAD))}"/>`);
  out.push(`<circle class="moon" cx="${f2(mx)}" cy="${f2(-my)}" r="0.16"/>`);
  out.push(`<text class="label" x="${f2(mx)}" y="${f2(-my + (my >= 0 ? -0.24 : 0.34))}" text-anchor="middle">Moon</text>`);
  out.push(`<line class="path" x1="${f2(-x)}" y1="${f2(-y)}" x2="${f2(x)}" y2="${f2(-y)}"/>`);
  out.push(`<circle class="place" cx="${f2(near.x)}" cy="${f2(-near.y)}" r="0.055"/>`);
  out.push(`<circle class="place later" cx="${f2(far.x)}" cy="${f2(-far.y)}" r="0.055"/>`);
  out.push(`<text class="label small" x="${f2(near.x + 0.1)}" y="${f2(-near.y + (lat >= 0 ? -0.1 : 0.2))}">${cmText(nearH)}</text>`);
  out.push(`<text class="label small" x="${f2(far.x - 0.1)}" y="${f2(-far.y + (lat >= 0 ? -0.1 : 0.2))}" text-anchor="end">${cmText(farH)}</text>`);
  out.push('<text class="label small" x="0.05" y="-1.42">N</text>');
  out.push('</svg>');
  return { svg: out.join(''), nearH, farH };
}

export const DAY_CHART = { w: 620, h: 220, left: 46, right: 12, top: 26, bottom: 30 };

export function renderDay({ series, highs, lows }) {
  const { w, h, left, right, top, bottom } = DAY_CHART;
  const t0 = series[0].jde;
  const t1 = series[series.length - 1].jde;
  const hs = series.map((p) => p.h);
  const ymax = Math.max(0.3, ...hs) + 0.08;
  const ymin = Math.min(-0.3, ...hs) - 0.04;
  const x = (t) => left + ((t - t0) / (t1 - t0)) * (w - left - right);
  const y = (m) => top + ((ymax - m) / (ymax - ymin)) * (h - top - bottom);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="month day" role="img" aria-label="Water height over two days at the chosen latitude">`);
  for (let cm = Math.ceil((ymin * 100) / 20) * 20; cm <= ymax * 100; cm += 20) {
    out.push(`<line class="grid${cm === 0 ? ' zero' : ''}" x1="${left}" x2="${w - right}" y1="${f1(y(cm / 100))}" y2="${f1(y(cm / 100))}"/>`);
    out.push(`<text class="tick" x="${left - 6}" y="${f1(y(cm / 100) + 4)}" text-anchor="end">${cm}</text>`);
  }
  for (let hr = 0; hr <= (t1 - t0) * 24 + 1e-9; hr += 6) {
    const xx = x(t0 + hr / 24);
    out.push(`<line class="grid" x1="${f1(xx)}" x2="${f1(xx)}" y1="${top}" y2="${h - bottom}"/>`);
    const anchor = xx > w - right - 40 ? 'end' : xx < left + 40 ? 'start' : 'middle';
    out.push(`<text class="tick" x="${f1(xx)}" y="${h - bottom + 16}" text-anchor="${anchor}">${hr % 24 === 0 ? dayLabel(t0 + hr / 24) : `+${hr} h`}</text>`);
  }
  out.push(`<path class="height" d="${series.map((p, i) => `${i ? 'L' : 'M'}${f1(x(p.jde))},${f1(y(p.h))}`).join('')}"/>`);
  for (const p of highs) {
    out.push(`<circle class="hw" cx="${f1(x(p.jde))}" cy="${f1(y(p.h))}" r="3.5"/>`);
    out.push(`<text class="tick hw-label" x="${f1(x(p.jde))}" y="${f1(y(p.h) - 8)}" text-anchor="middle">${Math.round(p.h * 100)}</text>`);
  }
  for (const p of lows) out.push(`<circle class="lw" cx="${f1(x(p.jde))}" cy="${f1(y(p.h))}" r="2.5"/>`);
  out.push('</svg>');
  return out.join('');
}

function dayLabel(jde) {
  const c = calendarDate(jdeToUtc(jde));
  return `${c.day} ${monthName(c.month)} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
}
