// Numbers beside the picture, as plain text rows.

import {
  moon, sun, profile, tideAmplitude, EARTH_RADIUS, MOON_MEAN_DISTANCE, MOON_PERIGEE, MOON_APOGEE,
} from './tides.js';

export const cm = (m) => `${(m * 100).toFixed(m * 100 < 10 ? 1 : 0)} cm`;

export function sci(v) {
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / 10 ** e;
  return `${mant.toFixed(2)} × 10${superscript(e)}`;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const superscript = (n) => String(n).split('').map((c) => SUP[c]).join('');

export const radii = (d) => d / EARTH_RADIUS;

export function distanceLabel(d) {
  const r = radii(d);
  const km = Math.round(d / 1000).toLocaleString('en-US');
  let note = '';
  if (Math.abs(d - MOON_PERIGEE) < 2e5) note = ', its nearest';
  else if (Math.abs(d - MOON_APOGEE) < 2e5) note = ', its farthest';
  else if (Math.abs(d - MOON_MEAN_DISTANCE) < 2e5) note = ', its average';
  return `${r.toFixed(1)} Earth radii (${km} km${note})`;
}

export function rows({ moonBody, sunBody, longest, exaggeration, mode }) {
  const lunarAlone = profile([moonBody]);
  const out = [
    ['Tide from the Moon', `${cm(lunarAlone.high)} up under it and opposite, ${cm(-lunarAlone.low)} down at the sides: ${cm(lunarAlone.range)} from low to high water`],
  ];
  if (sunBody) {
    const solar = profile([sunBody]);
    const both = profile([moonBody, sunBody]);
    const kind = tideKind(moonBody.angle, sunBody.angle);
    out.push(['Tide from the Sun', `${cm(solar.range)} from low to high water, ${Math.round((100 * solar.range) / lunarAlone.range)}% of the Moon's`]);
    out.push(['Both together', `${cm(both.range)} from low to high water${kind ? ` (${kind})` : ''}`]);
  }
  const ratio = tideAmplitude(moonBody) / tideAmplitude(moon());
  if (Math.abs(ratio - 1) > 0.005) {
    out.push(['Against the average Moon', `${ratio.toFixed(2)} times the tide`]);
  }
  out.push([mode === 'pull' ? 'Longest arrow (full pull)' : 'Longest arrow (leftover)', `${sci(longest)} m/s², ${gFraction(longest)}`]);
  out.push(['Ocean drawn', `${times(exaggeration)} higher than the real tide`]);
  return out;
}

export function times(x) {
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)} million times`;
  return `${Math.round(x).toLocaleString('en-US')} times`;
}

export function gFraction(a) {
  const inv = 9.81 / a;
  const digits = Math.floor(Math.log10(inv)) - 1;
  const rounded = Math.round(inv / 10 ** digits) * 10 ** digits;
  return `about 1/${rounded.toLocaleString('en-US')} of the Earth's own gravity`;
}

// Spring tide when the Sun and the Moon line up (new or full moon), neap tide
// when they are at right angles (quarter moons).
export function tideKind(moonAngle, sunAngle) {
  const sep = Math.abs(Math.cos(moonAngle - sunAngle));
  if (sep > 0.966) return 'a spring tide: Sun and Moon in line';
  if (sep < 0.259) return 'a neap tide: Sun and Moon at right angles';
  return '';
}

export function liveText({ moonBody, sunBody }) {
  const both = profile(sunBody ? [moonBody, sunBody] : [moonBody]);
  return `High water ${cm(both.high)}, low water ${cm(-both.low)} below the mean.`;
}

export { moon, sun };
