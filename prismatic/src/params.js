// Editable parameters per element kind, used to build the inspector and to
// keep edited values in range.

import { MATERIALS } from './optics.js';

const wavelength = {
  key: 'wavelength', label: 'Wavelength', min: 380, max: 750, step: 1, unit: 'nm', light: 'mono',
};
const samples = {
  key: 'samples', label: 'Colours sampled', min: 3, max: 30, step: 1, unit: '', light: 'white',
};

export const LIGHTS = { mono: 'Single wavelength', white: 'White light' };

export const PARAMS = {
  prism: [
    { key: 'apex', label: 'Apex angle', min: 10, max: 120, step: 1, unit: '°' },
    { key: 'side', label: 'Side', min: 40, max: 320, step: 1, unit: 'px' },
  ],
  block: [
    { key: 'width', label: 'Width', min: 10, max: 500, step: 1, unit: 'px' },
    { key: 'height', label: 'Height', min: 10, max: 400, step: 1, unit: 'px' },
  ],
  convexLens: [
    { key: 'radius', label: 'Surface radius', min: 60, max: 1000, step: 1, unit: 'px' },
    { key: 'aperture', label: 'Half-height', min: 10, max: 160, step: 1, unit: 'px' },
  ],
  concaveLens: [
    { key: 'radius', label: 'Surface radius', min: 60, max: 1000, step: 1, unit: 'px' },
    { key: 'aperture', label: 'Half-height', min: 10, max: 160, step: 1, unit: 'px' },
  ],
  ball: [{ key: 'radius', label: 'Radius', min: 10, max: 200, step: 1, unit: 'px' }],
  mirror: [{ key: 'length', label: 'Length', min: 10, max: 500, step: 1, unit: 'px' }],
  blocker: [{ key: 'length', label: 'Length', min: 10, max: 500, step: 1, unit: 'px' }],
  curvedMirror: [
    { key: 'radius', label: 'Radius of curvature', min: 60, max: 1200, step: 1, unit: 'px' },
    { key: 'aperture', label: 'Half-height', min: 10, max: 200, step: 1, unit: 'px' },
  ],
  laser: [wavelength, samples],
  beam: [
    { key: 'width', label: 'Width', min: 0, max: 400, step: 1, unit: 'px' },
    { key: 'count', label: 'Rays', min: 1, max: 60, step: 1, unit: '' },
    wavelength,
    samples,
  ],
  point: [
    { key: 'count', label: 'Rays', min: 1, max: 180, step: 1, unit: '' },
    { key: 'spread', label: 'Spread', min: 1, max: 360, step: 1, unit: '°' },
    wavelength,
    samples,
  ],
};

export const LABELS = {
  prism: 'Prism',
  block: 'Glass block',
  convexLens: 'Convex lens',
  concaveLens: 'Concave lens',
  ball: 'Glass ball',
  mirror: 'Mirror',
  curvedMirror: 'Curved mirror',
  blocker: 'Blocker',
  laser: 'Laser',
  beam: 'Beam',
  point: 'Point source',
};

export const hasMaterial = (el) => typeof el.material === 'string';

// Parameters that apply to the element as it is now: a white source has no
// single wavelength, and a single-wavelength source samples no colours.
export function visibleParams(el) {
  return (PARAMS[el.kind] || []).filter((p) => !p.light || p.light === (el.light || 'mono'));
}

// Apply one edit, clamped to the parameter's range. Curved surfaces must stay
// wider than they are tall, so radius and half-height limit each other.
export function applyParam(el, key, raw) {
  const value = Number(raw);
  if (key === 'material') {
    if (MATERIALS[raw]) el.material = raw;
    return el;
  }
  if (key === 'light') {
    if (LIGHTS[raw] && 'light' in el) el.light = raw;
    return el;
  }
  if (key === 'angle') {
    if (Number.isFinite(value)) el.angle = (value * Math.PI) / 180;
    return el;
  }
  const spec = (PARAMS[el.kind] || []).find((p) => p.key === key);
  if (!spec || !Number.isFinite(value)) return el;
  el[key] = Math.min(spec.max, Math.max(spec.min, value));
  if ('radius' in el && 'aperture' in el) {
    if (key === 'aperture' && el.radius <= el.aperture) el.radius = el.aperture + 1;
    if (key === 'radius' && el.aperture >= el.radius) el.aperture = el.radius - 1;
  }
  return el;
}
