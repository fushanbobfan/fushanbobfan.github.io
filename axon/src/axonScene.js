// The state behind the Axon page: one stretch of fibre as a bare axon and as a
// sheathed one, side by side. No browser code here.

import {
  INTERNODE_PATCHES, advance, fibre, firePulse, makeCable, measureSpeed, stepFor, stripInternode,
} from './cable.js';

export const DIAMETER_LOW = 0.3;
export const DIAMETER_HIGH = 200;

// The diameter slider runs from 0 to 100 on a log scale.
export function diameterFromSlider(position) {
  const value = DIAMETER_LOW * Math.pow(DIAMETER_HIGH / DIAMETER_LOW, position / 100);
  return Math.min(DIAMETER_HIGH, Number(value.toPrecision(2)));
}

export function sliderFromDiameter(diameter) {
  return (Math.log(diameter / DIAMETER_LOW) / Math.log(DIAMETER_HIGH / DIAMETER_LOW)) * 100;
}

export function makeScene(diameter, celsius) {
  const f = fibre(diameter, celsius);
  return {
    diameter,
    celsius,
    length: f.length,
    dt: stepFor(celsius),
    tracks: { bare: makeCable(f.bare), sheathed: makeCable(f.sheathed) },
    stripped: [],
    options: f,
  };
}

// Which patch sits at a fraction of the way along the shared stretch.
export function patchAt(cable, fraction, length) {
  const position = (fraction * length) / cable.dx;
  return Math.max(0, Math.min(cable.count - 1, Math.round(position)));
}

export function fireAt(scene, name, fraction) {
  const cable = scene.tracks[name];
  let centre = patchAt(cable, fraction, scene.length);
  if (cable.nodeEvery) centre = Math.round(centre / cable.nodeEvery) * cable.nodeEvery;
  firePulse(cable, Math.min(centre, cable.count - 1));
}

export function fireEnds(scene, { left = false, right = false }) {
  for (const name of Object.keys(scene.tracks)) {
    if (left) fireAt(scene, name, 0.03);
    if (right) fireAt(scene, name, 0.97);
  }
}

// Strips the next internode of a run that grows from the middle of the fibre.
export function stripNext(scene) {
  const cable = scene.tracks.sheathed;
  const middle = Math.round(cable.count / 2 / INTERNODE_PATCHES) * INTERNODE_PATCHES;
  const first = middle + scene.stripped.length * INTERNODE_PATCHES;
  if (first + INTERNODE_PATCHES >= cable.count) return false;
  stripInternode(cable, first + 1);
  scene.stripped.push(first + 1);
  return true;
}

export function advanceScene(scene, steps) {
  for (const cable of Object.values(scene.tracks)) {
    for (let i = 0; i < steps; i++) advance(cable, scene.dt);
  }
}

// True once nothing is left to watch: no pulses, and voltage close to rest.
export function isQuiet(scene) {
  for (const cable of Object.values(scene.tracks)) {
    if (cable.pulses.length) return false;
    for (const v of cable.v) {
      if (v > -60) return false;
    }
  }
  return true;
}

// Speeds in m/s for a scene's settings and stripped stretches; null means the
// spike does not arrive.
export function sceneSpeeds(scene) {
  const { bare, sheathed } = scene.options;
  const n = sheathed.count;
  const near = (fraction) => Math.round((n * fraction) / INTERNODE_PATCHES) * INTERNODE_PATCHES;
  return {
    bare: measureSpeed(bare, { dt: scene.dt }),
    sheathed: measureSpeed(sheathed, {
      dt: scene.dt,
      from: near(0.2),
      to: near(0.95),
      stripped: scene.stripped,
    }),
  };
}

// Both speeds across the range of diameters, a point at a time.
export const CURVE_DIAMETERS = [0.3, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];

export function* speedCurve(celsius, diameters = CURVE_DIAMETERS) {
  for (const diameter of diameters) {
    yield { diameter, ...sceneSpeeds(makeScene(diameter, celsius)) };
  }
}

// How long the bare axon takes end to end; sets the pace of the page. Falls
// back on the square-root law when the axon does not conduct.
export function crossingTime(scene, bareSpeed) {
  const speed = bareSpeed ?? 18.8 * Math.sqrt(scene.diameter / 476);
  return (scene.length / speed) * 10;
}

// A sentence for the screen and for assistive technology.
export function describeSpeeds({ bare, sheathed }, strippedCount) {
  const name = (speed) => (speed === null ? 'no spike gets through' : `${speed.toFixed(1)} m/s`);
  const parts = [`Bare axon: ${name(bare)}.`, `With myelin: ${name(sheathed)}.`];
  if (bare !== null && sheathed !== null) {
    parts.push(`The sheath makes it ${(sheathed / bare).toFixed(1)} times as fast.`);
  }
  if (strippedCount > 0) {
    const stretches = strippedCount === 1 ? '1 stretch' : `${strippedCount} stretches`;
    parts.push(`${stretches} of myelin stripped.`);
  }
  return parts.join(' ');
}

// Dark at rest, through red, to pale yellow at the peak, for the time charts.
const STOPS = [
  [-90, 12, 22, 40],
  [-65, 20, 42, 62],
  [-40, 120, 45, 70],
  [0, 232, 110, 42],
  [40, 255, 226, 150],
];

export function voltageColour(v) {
  if (v <= STOPS[0][0]) return STOPS[0].slice(1);
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (v - a[0]) / (b[0] - a[0]);
      return [1, 2, 3].map((k) => Math.round(a[k] + f * (b[k] - a[k])));
    }
  }
  return STOPS[STOPS.length - 1].slice(1);
}
