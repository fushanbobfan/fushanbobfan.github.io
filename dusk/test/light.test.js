import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVELENGTHS, SUN, cmf, toXYZ, spectrumToRGB, toDisplay, hue, hex, planck, brightnessY } from '../src/spectrum.js';
import { airIndex, rayleighCoefficient, hazeCoefficient, rayleighPhase, hazePhase, RAYLEIGH_HEIGHT, coefficients, HAZE_ALBEDO } from '../src/air.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('the colour matching fit peaks where the eye is most sensitive', () => {
  let best = 0, at = 0;
  for (let nm = 400; nm <= 700; nm++) {
    const y = cmf(nm)[1];
    if (y > best) { best = y; at = nm; }
  }
  close(best, 1, 0.03, 'peak of y-bar');
  close(at, 557, 6, 'wavelength of the peak');
});

test('light with equal energy at every wavelength sits at the white point of XYZ', () => {
  const xyz = toXYZ(WAVELENGTHS.map(() => 1));
  const sum = xyz[0] + xyz[1] + xyz[2];
  close(xyz[0] / sum, 1 / 3, 0.01, 'x');
  close(xyz[1] / sum, 1 / 3, 0.01, 'y');
});

test('sunlight above the air is drawn white and keeps its brightness', () => {
  const [r, g, b] = spectrumToRGB(SUN);
  close(r, 1, 1e-9, 'r');
  close(g, 1, 1e-9, 'g');
  close(b, 1, 1e-9, 'b');
});

test('the 5778 K sun peaks in the blue-green, near 500 nm', () => {
  let best = 0, at = 0;
  for (let nm = 300; nm <= 900; nm += 1) {
    const p = planck(nm, 5778);
    if (p > best) { best = p; at = nm; }
  }
  close(at, 2.897771955e6 / 5778, 1, 'Wien peak');
});

test('the refractive index of air is 1.000278 at 550 nm', () => {
  close((airIndex(550) - 1) * 1e6, 277.8, 0.5, '(n - 1) x 1e6');
  assert.ok(airIndex(400) > airIndex(700));
});

test('air molecules scatter about 1.2e-5 of the light per metre at 550 nm and an optical depth near 0.1', () => {
  const b = rayleighCoefficient(550);
  close(b * 1e5, 1.16, 0.05, 'beta x 1e5');
  // Bucholtz (1995) gives a vertical Rayleigh optical depth of about 0.097 at 550 nm.
  close(b * RAYLEIGH_HEIGHT, 0.097, 0.005, 'vertical optical depth');
});

test('blue is scattered about five times as strongly as red', () => {
  const ratio = rayleighCoefficient(450) / rayleighCoefficient(700);
  // (700/450)^4 = 5.85, a little more because air bends blue light more.
  assert.ok(ratio > 5.85 && ratio < 6.3, String(ratio));
});

test('haze has the requested optical depth and scatters colours more evenly', () => {
  close(hazeCoefficient(550, 0.2) * 1.2e3, 0.2, 1e-12, 'tau at 550 nm');
  const c = coefficients(0.2);
  const i = WAVELENGTHS.indexOf(540);
  close(c.haze[i] / c.hazeExtinction[i], HAZE_ALBEDO, 1e-12, 'scattered share of the extinction');
  const ratio = hazeCoefficient(450, 0.2) / hazeCoefficient(700, 0.2);
  assert.ok(ratio > 1.5 && ratio < 2, String(ratio));
});

test('both phase functions spread exactly all the scattered light over the sphere', () => {
  for (const f of [rayleighPhase, (mu) => hazePhase(mu, 0.76), (mu) => hazePhase(mu, 0)]) {
    let total = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const mu = -1 + (2 * (i + 0.5)) / n;
      total += f(mu) * 2 * Math.PI * (2 / n);
    }
    close(total, 1, 1e-4, 'integral over the sphere');
  }
  assert.ok(hazePhase(1) > 50 * hazePhase(-1), 'haze throws light forwards');
  close(rayleighPhase(1), 2 * rayleighPhase(0), 1e-12, 'Rayleigh: twice as much forwards as sideways');
});

test('display colours stay inside 0-255 and the hue of a dim colour is its brightest version', () => {
  for (const c of toDisplay([5, 0.2, -1], 3)) assert.ok(c >= 0 && c <= 255);
  assert.deepEqual(hue([0.5, 0.25, 0]), hue([1, 0.5, 0]));
  assert.equal(hex([255, 0, 16]), '#ff0010');
  assert.deepEqual(hue([0, 0, 0]), [0, 0, 0]);
});

test('brightness is the photometric Y, untouched by the white balance', () => {
  close(brightnessY(SUN), 1, 1e-12, 'sunlight above the air');
  const line = (nm) => WAVELENGTHS.map((w) => (w === nm ? 1 : 0));
  for (const nm of [440, 560, 660]) {
    close(brightnessY(line(nm)), (toXYZ(line(nm))[1]) / toXYZ(SUN)[1], 1e-12, `${nm} nm`);
  }
});
