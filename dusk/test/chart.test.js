import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartSVG, describeSpectrum, curves, spectralColour, peakAt, x, y, CHART } from '../src/chart.js';
import { makeScene, sunlight, skySpectrum } from '../src/sky.js';
import { describe } from '../src/readout.js';
import { WAVELENGTHS } from '../src/spectrum.js';

const data = (params) => {
  const scene = makeScene(params);
  return { transmission: sunlight(scene).transmission, sky: Array.from(skySpectrum(scene, [0, 0, 1])) };
};

test('the axes span the chart and the wavelength scale runs from 380 to 780 nm', () => {
  assert.equal(x(380), CHART.left);
  assert.equal(x(780), CHART.width - CHART.right);
  assert.equal(y(1), CHART.top);
  assert.equal(y(0), CHART.height - CHART.bottom);
});

test('the spectral strip runs from violet through green to red', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r4, , b4] = rgb(spectralColour(420));
  assert.ok(b4 > r4, 'violet-blue at 420 nm');
  const [r5, g5, b5] = rgb(spectralColour(530));
  assert.ok(g5 > r5 && g5 > b5, 'green at 530 nm');
  const [r6, g6] = rgb(spectralColour(640));
  assert.ok(r6 > g6, 'red at 640 nm');
  for (let nm = 650; nm <= 780; nm += 10) {
    const [r, g, b] = rgb(spectralColour(nm));
    assert.ok(r === 255 && g < 80 && b < 80, `red at ${nm} nm: ${spectralColour(nm)}`);
  }
  const [rv, gv, bv] = rgb(spectralColour(390));
  assert.ok(bv === 255 && rv > gv, `violet at 390 nm: ${spectralColour(390)}`);
});

test('sunlight above the air peaks near 500 nm, and the low sun\'s light has shifted to the red', () => {
  const high = curves(data({ sun: 60, haze: 0.06, height: 0 }));
  assert.equal(Math.max(...high.above), 1);
  assert.ok(Math.abs(peakAt(high.above) - 500) <= 20);
  assert.ok(high.through.every((v, i) => v <= high.above[i] + 1e-12), 'the air only takes light away');
  const low = curves(data({ sun: 1, haze: 0.06, height: 0 }));
  assert.ok(peakAt(low.through) >= 640, String(peakAt(low.through)));
  assert.match(describeSpectrum(data({ sun: 1, haze: 0.06, height: 0 })), /strongest at the red end of the chart/);
});

test('the sky overhead is bluest when the sun is high', () => {
  const sky = curves(data({ sun: 45, haze: 0.06, height: 0 })).skyShape;
  assert.equal(peakAt(sky), WAVELENGTHS[0]);
  assert.match(describeSpectrum(data({ sun: 45, haze: 0.06, height: 0 })), /strongest at the violet end/);
});

test('after sunset the chart says no sunlight reaches you, and the svg has every curve', () => {
  const d = data({ sun: -4, haze: 0.06, height: 0 });
  assert.match(describeSpectrum(d), /^No direct sunlight reaches you/);
  const svg = chartSVG(d);
  for (const cls of ['above', 'through', 'through-fill', 'sky', 'axis']) assert.match(svg, new RegExp(`class="${cls}"`), cls);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('the ozone switch changes what the description says about the twilight sky', () => {
  const base = { sun: -4, height: 0, airMass: Infinity, transmission: Array(21).fill(0), skyRatio: 0.005 };
  assert.match(describe({ ...base, ozone: 1 }), /stays blue/);
  assert.match(describe({ ...base, ozone: 0 }), /orange it would have absorbed stays/);
});
