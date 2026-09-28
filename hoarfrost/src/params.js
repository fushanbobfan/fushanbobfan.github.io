// Model parameters: their ranges, clamping, slider scales, and a compact form
// for share links (#a=1&b=0.4&g=0.001&n=150).

const fixed = (digits) => (v) => Number(v.toFixed(digits));

export const SPECS = {
  alpha: {
    key: 'a', label: 'Diffusion α', min: 0.2, max: 2.4, step: 0.01, round: fixed(2),
  },
  beta: {
    key: 'b', label: 'Background vapour β', min: 0.05, max: 0.95, step: 0.005, round: fixed(3),
  },
  // gamma matters from 1e-5 up to tenths, so its slider is logarithmic, with
  // the far left end meaning exactly zero.
  gamma: {
    key: 'g', label: 'Vapour added γ', min: 0, max: 0.4, floor: 1e-5, log: true, round: (v) => Number(v.toPrecision(2)),
  },
  radius: {
    key: 'n', label: 'Grid radius', min: 40, max: 240, step: 10, round: (v) => Math.round(v / 10) * 10,
  },
};

export const DEFAULTS = {
  alpha: 1, beta: 0.4, gamma: 0.0001, radius: 150,
};

const LOG_STEPS = 1000;

export function clampParam(name, value) {
  const spec = SPECS[name];
  const v = Number(value);
  if (!spec || !Number.isFinite(v)) return DEFAULTS[name];
  return spec.round(Math.min(spec.max, Math.max(spec.min, v)));
}

// Range input settings for a parameter.
export function sliderRange(name) {
  const spec = SPECS[name];
  return spec.log ? { min: 0, max: LOG_STEPS, step: 1 } : { min: spec.min, max: spec.max, step: spec.step };
}

export function toSlider(name, value) {
  const spec = SPECS[name];
  if (!spec.log) return value;
  if (value < spec.floor) return 0;
  return Math.round((LOG_STEPS * Math.log(value / spec.floor)) / Math.log(spec.max / spec.floor));
}

export function fromSlider(name, position) {
  const spec = SPECS[name];
  const x = Number(position);
  if (!spec.log) return clampParam(name, x);
  if (x <= 0) return 0;
  return clampParam(name, spec.floor * (spec.max / spec.floor) ** (x / LOG_STEPS));
}

export function normalize(params = {}) {
  const out = {};
  for (const name of Object.keys(SPECS)) {
    out[name] = name in params ? clampParam(name, params[name]) : DEFAULTS[name];
  }
  return out;
}

export function encodeParams(params) {
  const p = normalize(params);
  return Object.entries(SPECS).map(([name, spec]) => `${spec.key}=${p[name]}`).join('&');
}

// Read parameters from a hash or query string. Unknown or broken entries
// fall back to the defaults; returns null if nothing recognisable is present.
export function decodeParams(text) {
  const search = new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
  const found = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    if (search.has(spec.key)) found[name] = search.get(spec.key);
  }
  return Object.keys(found).length ? normalize(found) : null;
}
