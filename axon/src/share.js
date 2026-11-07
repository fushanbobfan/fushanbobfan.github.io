// Membrane settings in a link. Anything missing or out of range falls back to
// the default, so an edited link can never break the page.

import { DEFAULTS } from './presets.js';

const FIELDS = {
  amplitude: { key: 'a', min: -40, max: 60 },
  width: { key: 'w', min: 0.1, max: 200 },
  secondAmplitude: { key: 'b', min: -40, max: 60 },
  gap: { key: 'g', min: 2, max: 40 },
  length: { key: 'l', min: 20, max: 200 },
  celsius: { key: 't', min: 0, max: 35 },
  na: { key: 'na', min: 0, max: 100 },
  k: { key: 'k', min: 0, max: 100 },
};

export function encodeMembrane(settings) {
  const params = new URLSearchParams();
  for (const [name, { key }] of Object.entries(FIELDS)) {
    if (settings[name] !== DEFAULTS[name]) params.set(key, String(settings[name]));
  }
  if (settings.second) params.set('two', '1');
  return params;
}

export function decodeMembrane(params) {
  const settings = { ...DEFAULTS };
  for (const [name, { key, min, max }] of Object.entries(FIELDS)) {
    if (!params.has(key)) continue;
    const value = Number(params.get(key));
    if (Number.isFinite(value) && value >= min && value <= max) settings[name] = value;
  }
  settings.second = params.get('two') === '1';
  return settings;
}

// A link with no membrane field should open on the default preset.
export function hasMembraneFields(params) {
  return params.has('two') || Object.values(FIELDS).some(({ key }) => params.has(key));
}
