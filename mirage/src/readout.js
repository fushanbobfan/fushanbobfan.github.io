// Words and numbers shown beside the pictures.

import { temperature, index } from './air.js';
import { BOARD_HEIGHT } from './view.js';

const DEG = 180 / Math.PI;

export function tempLabel(c) {
  return `${Math.round(c)} °C`;
}

export function layerLabel(m) {
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(1)} m`;
}

export function heightLabel(m) {
  return `${m.toFixed(1)} m`;
}

export function distanceLabel(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
  if (m >= 100) return `${Math.round(m / 5) * 5} m`;
  return `${Math.round(m)} m`;
}

export function indexLabel(n) {
  return n.toFixed(6);
}

export function degreesLabel(rad) {
  const d = Math.abs(rad) * DEG;
  return d < 0.1 ? `${d.toFixed(3)}°` : `${d.toFixed(2)}°`;
}

export function vanishLabel(d) {
  if (d === undefined) return 'working it out…';
  if (d === null) return 'it never appears between 50 m and 1.5 km';
  if (d <= 50) return 'it stays even at 50 m';
  return `about ${distanceLabel(d)}`;
}

export function rows(air, scene, { critical, shine, top, bottom, stretch, vanish }) {
  return [
    ['Air at the road surface', `${tempLabel(air.surface)}, refractive index ${indexLabel(index(air, 0))}`],
    [`Air at eye level (${heightLabel(scene.eye)})`, `${tempLabel(temperature(air, scene.eye))}, refractive index ${indexLabel(index(air, scene.eye))}`],
    ['Rays bend back up if aimed within', critical === null ? 'none do' : `${degreesLabel(critical)} below eye level`],
    ['The shine starts', shine === null ? 'nowhere' : `about ${distanceLabel(shine)} ahead`],
    ["The board's upside-down copy vanishes nearer than", vanishLabel(vanish)],
    ['Height of the view', `${degreesLabel(top - bottom)} (the full Moon is about 0.5° across)`],
    ['Side view', `heights stretched ${Math.round(stretch)} times`],
  ];
}

export function verdict(air, scene, { critical, shine, view }) {
  if (critical === null) {
    if (air.surface < air.air) {
      return 'The road is cooler than the air, so the air just above it bends light downwards and every ray aimed below eye level still ends on the road. Nothing shines.';
    }
    return 'With the road no warmer than the air, every ray aimed below eye level ends on the road: no shine, and only one board.';
  }
  if (shine === null) {
    return 'The road is only slightly warmer than the air, so rays bend back up only far beyond the board: the shine starts more than 5 km ahead.';
  }
  let text = `The road seems to shine from about ${distanceLabel(shine)} ahead. Rays aimed at it within ${degreesLabel(critical)} below eye level curve back up through the hot air before they touch it, so you see the sky there, like light off a puddle.`;
  // The lowest few centimetres are always out of reach near the fold; only a
  // missing strip of 10 cm or more is worth a sentence.
  const hidden = view.lowestSeen !== null && view.lowestSeen >= 0.1 ? view.lowestSeen : 0;
  if (view.invertedRows > 0) {
    const reachesTop = view.invertedTop >= BOARD_HEIGHT - 0.05;
    const part = reachesTop && !hidden ? 'the whole board'
      : reachesTop ? `the board above its lowest ${layerLabel(hidden)}`
        : !hidden ? `its lowest ${layerLabel(view.invertedTop)}`
          : `the part between ${layerLabel(hidden)} and ${layerLabel(view.invertedTop)} up`;
    text += ` Under the board hangs an upside-down copy of ${part}.`;
  }
  if (hidden) {
    text += ` The bottom ${layerLabel(hidden)} of the board is missing from both: light from there curves upwards and passes over your head, so the board seems to stand in water.`;
  }
  if (view.lowestSeen === null && shine <= scene.distance) {
    text += ' The board has vanished: light from every part of it curves upwards and passes over your head.';
  } else if (view.invertedRows === 0 && shine > scene.distance) {
    text += ' The board stands nearer than the shine, so it has no copy.';
  }
  return text;
}
