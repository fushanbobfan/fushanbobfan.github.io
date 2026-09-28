// Model parameters: their ranges, clamping, and a compact form for share
// links (#a=1&b=0.4&g=0.001&n=150).

export const SPECS = {
  alpha: {
    key: 'a', label: 'Diffusion α', min: 0.2, max: 2.4, step: 0.01, digits: 2,
  },
  beta: {
    key: 'b', label: 'Background vapour β', min: 0.05, max: 0.95, step: 0.005, digits: 3,
  },
  gamma: {
    key: 'g', label: 'Vapour added γ', min: 0, max: 0.02, step: 0.0001, digits: 4,
  },
  radius: {
    key: 'n', label: 'Grid radius', min: 40, max: 240, step: 10, digits: 0,
  },
};

export const DEFAULTS = {
  alpha: 1, beta: 0.4, gamma: 0.0001, radius: 150,
};

export function clampParam(name, value) {
  const spec = SPECS[name];
  const v = Number(value);
  if (!spec || !Number.isFinite(v)) return DEFAULTS[name];
  const clamped = Math.min(spec.max, Math.max(spec.min, v));
  const rounded = Number(clamped.toFixed(spec.digits));
  return name === 'radius' ? Math.round(rounded / spec.step) * spec.step : rounded;
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
