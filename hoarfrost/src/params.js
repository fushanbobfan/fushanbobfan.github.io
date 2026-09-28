// Model parameters: their ranges, clamping, slider scales, and a compact form
// for share links (#a=1&b=0.4&g=0.001&n=150). A second growth stage adds
// its own beta and gamma and the switch point (&b2=0.4&g2=0.3&at=0.5).

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

export const AT_SPEC = {
  key: 'at', label: 'Switch at', min: 0.1, max: 0.9, step: 0.05, round: (v) => Number(v.toFixed(2)),
};

export const STAGE_DEFAULTS = { beta: 0.4, gamma: 0.3, at: 0.5 };

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

// A second stage changes beta and gamma; alpha and the grid stay put.
export function normalizeStage(stage) {
  if (!stage) return null;
  const at = Number(stage.at);
  return {
    beta: 'beta' in stage ? clampParam('beta', stage.beta) : STAGE_DEFAULTS.beta,
    gamma: 'gamma' in stage ? clampParam('gamma', stage.gamma) : STAGE_DEFAULTS.gamma,
    at: Number.isFinite(at) ? AT_SPEC.round(Math.min(AT_SPEC.max, Math.max(AT_SPEC.min, at))) : STAGE_DEFAULTS.at,
  };
}

export function encodeParams(params, stage = null) {
  const p = normalize(params);
  const parts = Object.entries(SPECS).map(([name, spec]) => `${spec.key}=${p[name]}`);
  const st = normalizeStage(stage);
  if (st) parts.push(`b2=${st.beta}`, `g2=${st.gamma}`, `at=${st.at}`);
  return parts.join('&');
}

// The second stage in a link, or null if the link has none.
export function decodeStage(text) {
  const search = new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
  if (!search.has('b2') && !search.has('g2')) return null;
  const stage = {};
  if (search.has('b2')) stage.beta = search.get('b2');
  if (search.has('g2')) stage.gamma = search.get('g2');
  if (search.has('at')) stage.at = search.get('at');
  return normalizeStage(stage);
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
