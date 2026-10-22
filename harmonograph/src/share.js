// Compact, human-readable encoding of a design for the URL hash, e.g.
//   #x:0.5,2,1.571,0.012;y:0.5,2.005,0,0.012
// Each pendulum is axis:amp,freq,phase,damp. Rotary pendulums use "r".

import { normalizeDesign } from './harmonograph.js';

const AXIS_CODES = { x: 'x', y: 'y', rotary: 'r' };
const CODE_AXES = { x: 'x', y: 'y', r: 'rotary' };

function fmt(value, digits) {
  // Trim trailing zeros so round numbers stay short.
  return String(Number(value.toFixed(digits)));
}

export function encodeDesign(design) {
  return design.pendulums
    .map((p) => `${AXIS_CODES[p.axis]}:${fmt(p.amp, 3)},${fmt(p.freq, 4)},${fmt(p.phase, 3)},${fmt(p.damp, 4)}`)
    .join(';');
}

// Returns a normalized design, or null if the text is not a design at all.
export function decodeDesign(text) {
  if (typeof text !== 'string') return null;
  const body = text.replace(/^#/, '').trim();
  if (!body) return null;
  const pendulums = [];
  for (const part of body.split(';')) {
    const match = /^([xyr]):([^:]+)$/.exec(part.trim());
    if (!match) return null;
    const nums = match[2].split(',').map(Number);
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
    const [amp, freq, phase, damp] = nums;
    pendulums.push({ axis: CODE_AXES[match[1]], amp, freq, phase, damp });
  }
  return normalizeDesign({ pendulums });
}
