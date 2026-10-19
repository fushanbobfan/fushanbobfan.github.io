// Page settings, their limits, presets and the share-link format. A link
// carries only the values that differ from the defaults.

export const DEFAULTS = {
  shape: 'cylinder',
  naca: '2412',
  angle: 0,
  size: 20,
  re: 150,
  speed: 0.1,
  width: 300,
  view: 'curl',
  tracers: true,
  rate: 12,
};

const SHAPES = ['cylinder', 'square', 'plate', 'airfoil', 'none'];
const VIEWS = ['curl', 'speed', 'pressure'];
const WIDTHS = [200, 300, 400];
const NACA = /^\d{4}$/;

const NUMBERS = {
  angle: [-90, 90],
  size: [8, 80],
  re: [10, 2000],
  speed: [0.03, 0.15],
  rate: [1, 40],
};

export function clampSettings(s) {
  const out = { ...DEFAULTS };
  if (SHAPES.includes(s.shape)) out.shape = s.shape;
  if (typeof s.naca === 'string' && NACA.test(s.naca) && Number(s.naca.slice(2)) >= 4) out.naca = s.naca;
  if (VIEWS.includes(s.view)) out.view = s.view;
  if (WIDTHS.includes(Number(s.width))) out.width = Number(s.width);
  if (typeof s.tracers === 'boolean') out.tracers = s.tracers;
  for (const [k, [lo, hi]] of Object.entries(NUMBERS)) {
    const v = Number(s[k]);
    if (s[k] !== undefined && s[k] !== '' && Number.isFinite(v)) out[k] = Math.min(hi, Math.max(lo, v));
  }
  out.size = Math.round(out.size);
  out.rate = Math.round(out.rate);
  return out;
}

// Grid height for a given width: a 5 : 2 tunnel.
export function gridHeight(width) {
  return Math.round(width * 0.4);
}

export function encodeSettings(s) {
  const params = new URLSearchParams();
  for (const k of Object.keys(DEFAULTS)) {
    if (s[k] === DEFAULTS[k]) continue;
    params.set(k, typeof s[k] === 'boolean' ? (s[k] ? '1' : '0') : String(s[k]));
  }
  return params.toString();
}

export function decodeSettings(query) {
  const params = new URLSearchParams(query);
  const raw = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (!params.has(k)) continue;
    const v = params.get(k);
    raw[k] = typeof DEFAULTS[k] === 'boolean' ? v === '1' : v;
  }
  return clampSettings(raw);
}

export const PRESETS = [
  {
    id: 'street',
    label: 'Vortex street',
    note: 'A cylinder at Re 150. The wake swings from side to side and sheds eddies of alternating spin.',
    settings: { shape: 'cylinder', re: 150 },
  },
  {
    id: 'creep',
    label: 'Twin eddies',
    note: 'The same cylinder at Re 30. Two eddies sit still behind it; for a cylinder in open flow shedding begins near Re 47.',
    settings: { shape: 'cylinder', re: 30 },
  },
  {
    id: 'plate',
    label: 'Plate across the flow',
    note: 'A flat plate square to the stream sheds from its sharp edges and leaves a wide wake.',
    settings: { shape: 'plate', angle: 90, size: 24, re: 200 },
  },
  {
    id: 'wing',
    label: 'Wing at 6°',
    note: 'A NACA 2412 section pitched up 6 degrees. The flow follows both surfaces and the wake stays thin.',
    settings: { shape: 'airfoil', naca: '2412', angle: 6, size: 50, width: 400, re: 1000 },
  },
  {
    id: 'stall',
    label: 'Stalled wing',
    note: 'The same wing at 22 degrees. Flow leaves the upper surface and the wake fills with eddies.',
    settings: { shape: 'airfoil', naca: '2412', angle: 22, size: 50, width: 400, re: 1000 },
  },
  {
    id: 'square',
    label: 'Square post',
    note: 'A square at Re 150. Its corners fix where the flow separates.',
    settings: { shape: 'square', re: 150 },
  },
];

export function presetSettings(id) {
  const p = PRESETS.find((q) => q.id === id);
  return p ? clampSettings(p.settings) : clampSettings({});
}
