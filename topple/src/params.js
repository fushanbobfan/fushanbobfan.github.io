// Scene settings, their ranges, and the compact form used in share links.

export const MODES = {
  tower: 'Tower',
  rain: 'Rain',
  identity: 'Identity',
};

export const VIEWS = {
  grains: 'Grains per cell',
  topplings: 'Times toppled',
};

export const SPECS = {
  mode: { key: 'm', values: Object.keys(MODES) },
  power: { key: 'p', min: 6, max: 17, step: 1 },
  size: { key: 's', min: 16, max: 256, step: 1 },
  palette: { key: 'c', values: ['dune', 'tide', 'ember', 'paper'] },
  seed: { key: 'r', min: 1, max: 999999, step: 1 },
  view: { key: 'v', values: Object.keys(VIEWS) },
};

export const DEFAULTS = {
  mode: 'tower', power: 14, size: 128, palette: 'dune', seed: 1, view: 'grains',
};

export function clampParam(name, value) {
  const spec = SPECS[name];
  if (spec.values) return spec.values.includes(value) ? value : DEFAULTS[name];
  const v = typeof value === 'string' ? Number(value) : value;
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULTS[name];
  const stepped = Math.round(v / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, stepped));
}

export function normalize(p) {
  const out = {};
  for (const name of Object.keys(SPECS)) out[name] = clampParam(name, p[name] ?? DEFAULTS[name]);
  return out;
}

export function encodeParams(p) {
  return Object.entries(SPECS).map(([name, spec]) => `${spec.key}=${p[name]}`).join('&');
}

// Returns null when the text carries none of our keys.
export function decodeParams(text) {
  const q = new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
  let seen = false;
  const raw = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    if (q.has(spec.key)) {
      seen = true;
      raw[name] = q.get(spec.key);
    }
  }
  return seen ? normalize(raw) : null;
}

// A tower of n grains settles into a rough disc averaging a little over two
// grains per cell; measured radii stay inside sqrt(n / (2.125 pi)) for every
// tower the page offers. Leave a margin so no grain reaches the edge, and
// keep the side odd so the tower sits on a single centre cell.
export function towerSide(grains) {
  const r = Math.sqrt(grains / (Math.PI * 2.125));
  const side = 2 * Math.ceil(r * 1.08) + 5;
  return side % 2 === 1 ? side : side + 1;
}
