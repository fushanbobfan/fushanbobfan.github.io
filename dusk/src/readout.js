// Words and numbers for the page, kept apart from the drawing so they can be tested.

import { WAVELENGTHS } from './spectrum.js';

export function sunLabel(deg) {
  if (deg === 0) return 'on the horizon';
  const a = Math.abs(deg);
  const n = Number.isInteger(a) ? String(a) : a.toFixed(1);
  return deg > 0 ? `${n}° above the horizon` : `${n}° below the horizon`;
}

export function hazeLabel(tau) {
  const word = tau < 0.04 ? 'none to speak of' : tau < 0.15 ? 'clear' : tau < 0.35 ? 'a little hazy' : tau < 0.7 ? 'hazy' : 'thick haze';
  return `${tau.toFixed(2)} (${word})`;
}

export function heightLabel(m) {
  if (m < 1) return 'sea level';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function percent(x) {
  if (x >= 0.995) return '100%';
  if (x >= 0.1) return `${Math.round(x * 100)}%`;
  if (x >= 0.001) return `${(x * 100).toFixed(1)}%`;
  if (x > 0) return 'under 0.1%';
  return 'none';
}

// How much air the sunlight crosses, compared with the sun overhead.
export function times(x) {
  if (!Number.isFinite(x)) return 'none: the sun is below your horizon';
  if (x < 1.05) return 'about as much as with the sun overhead';
  return `${x < 10 ? x.toFixed(1) : Math.round(x)} times as much as with the sun overhead`;
}

export function band(transmission, nm) {
  return transmission[WAVELENGTHS.indexOf(nm)];
}

export function brightness(x) {
  if (x >= 1.5) return `${x.toFixed(1)} times as bright as a clear midday sky`;
  if (x >= 0.95) return 'about as bright as a clear midday sky';
  if (x >= 0.1) return `${Math.round(x * 100)}% as bright as a clear midday sky`;
  if (x >= 0.01) return `${(x * 100).toFixed(1)}% as bright as a clear midday sky`;
  if (x > 0) return `1/${Math.round(1 / x).toLocaleString('en-US')} as bright as a clear midday sky`;
  return 'dark';
}

// A few sentences on what the picture shows and why.
// A word for the colour of the sun's disc, from its linear RGB.
export function sunColourWord(rgb) {
  const [r, g, b] = rgb.map((v) => Math.max(0, v));
  const m = Math.max(r, g, b);
  if (!(m > 0)) return 'unseen';
  if (b > 1.15 * r) return 'faintly blue';
  const ratio = b / r;
  if (ratio > 0.8) return 'white';
  if (ratio > 0.45) return 'yellow';
  if (g / r > 0.12) return 'orange';
  return 'red';
}

export function describe({ sun, height, airMass, transmission, skyRatio, fixed, sunRGB = null, ozone = 1 }) {
  const blue = band(transmission, 440);
  const red = band(transmission, 660);
  const parts = [];
  if (!Number.isFinite(airMass)) {
    parts.push(`The sun is ${sunLabel(sun)}, so no sunlight reaches you directly.`);
    parts.push('The air overhead is still in sunlight, and the glow you see is light it scatters down to you; it fades as the Earth\'s shadow climbs the sky.');
    parts.push(ozone
      ? 'That light has skimmed through the ozone layer, which takes out orange, so the sky overhead stays blue.'
      : 'With the ozone layer taken away, nothing takes the orange out of that light, and the sky overhead turns grey-yellow.');
  } else {
    parts.push(airMass < 1.05
      ? 'The sun is high, so its light crosses only the air straight above you.'
      : `On its way to you, the sunlight crosses ${times(airMass).replace(' as much', ' as much air')}.`);
    parts.push(`On the way, ${percent(blue)} of its blue (440 nm) gets through and ${percent(red)} of its red (660 nm).`);
    const word = sunRGB ? sunColourWord(sunRGB) : red > 3 * blue ? 'orange' : red > 1.4 * blue ? 'yellow' : 'white';
    if (word === 'faintly blue') parts.push('Here the ozone has taken more of the green and orange than the air has taken of the blue, so the sun looks faintly blue.');
    else if (word === 'white') parts.push(band(transmission, 540) > 0.6 ? 'Little is lost on so short a path, so the sun stays white.' : 'The colours are dimmed about equally, so the sun stays white.');
    else if (word === 'yellow') parts.push('The beam has lost some of its blue, so the sun looks yellow.');
    else parts.push(`The blue has been scattered out of the beam along the way, so the sun looks ${word}.`);
  }
  if (height >= 15000) parts.push(`At ${heightLabel(height)} most of the air is below you, so there is little left above to scatter light, and the sky overhead turns dark even in daylight.`);
  else if (Number.isFinite(airMass) && sun > 10) parts.push('The blue the beam loses is scattered in all directions; that scattered light is the blue sky.');
  if (fixed) parts.push(`The camera is set for a clear midday, and on average the sky is ${brightness(skyRatio)}.`);
  else parts.push(`On average the sky is ${brightness(skyRatio)}; the camera adjusts to it, as your eyes do.`);
  return parts.join(' ');
}
