import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS, RAYLEIGH_HEIGHT, HAZE_HEIGHT, density, ozoneDensity } from '../src/air.js';
import { column, exitDistance, direction, eyePosition, makeScene, skySpectrum, sunlight, sunRGB, skyRGB, renderDome, renderView, exposureFor, meanBrightness, DEG } from '../src/sky.js';
import { WAVELENGTHS, SUN } from '../src/spectrum.js';
import { OZONE_PEAK, DOBSON, ozoneCrossSection } from '../src/air.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b}`);

// Brute-force column with very fine uniform steps, with its own ray-sphere geometry.
function reference(p, d) {
  const b = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
  const pp = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
  const top = EARTH_RADIUS + 100e3;
  const len = -b + Math.sqrt(b * b - (pp - top * top));
  const n = 200000;
  let cr = 0, cm = 0, co = 0, lowest = Infinity;
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * len;
    const h = Math.hypot(p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]) - EARTH_RADIUS;
    lowest = Math.min(lowest, h);
    cr += density(h, RAYLEIGH_HEIGHT) * (len / n);
    cm += density(h, HAZE_HEIGHT) * (len / n);
    co += ozoneDensity(h) * (len / n);
  }
  return { col: [cr, cm, co], lowest };
}

test('straight up from sea level crosses one scale height of air', () => {
  const [cr, cm, co] = column(eyePosition(0), [0, 0, 1], 400);
  rel(cr, RAYLEIGH_HEIGHT, 1e-3, 'molecules');
  rel(cm, HAZE_HEIGHT, 1e-3, 'haze');
  rel(co, 15000, 1e-3, 'ozone, 15 km at peak density');
});

test('the short columns used for the picture agree with a brute-force sum', () => {
  const cases = [
    [0, 90], [0, 30], [0, 5], [0, 0.5], [0, 0],
    [2000, 0], [8000, -1], [20000, -3], [40000, -5], [5000, 10],
  ];
  for (const [h, el] of cases) {
    const p = eyePosition(h), d = direction(el * DEG, 0);
    const { col: [r0, m0, o0], lowest } = reference(p, d);
    assert.ok(lowest > 0, `the ray at ${h} m, ${el} deg clears the ground`);
    const [r, m, o] = column(p, d, 10);
    rel(o, o0, 1e-3, `ozone at ${h} m, ${el} deg`);
    rel(r, r0, 0.01, `molecules at ${h} m, ${el} deg`);
    rel(m, m0, 0.02, `haze at ${h} m, ${el} deg`);
  }
});

test('a ray aimed below the horizon from a height meets the ground', () => {
  assert.equal(exitDistance(eyePosition(10000), direction(-10 * DEG, 0)), -1);
  assert.ok(exitDistance(eyePosition(10000), direction(-1 * DEG, 0)) > 0, 'grazes over the curve of the Earth');
  assert.deepEqual(column(eyePosition(0), direction(-1 * DEG, 0)), [Infinity, Infinity, Infinity]);
});

test('the setting sun crosses about 35 times as much air as the sun overhead', () => {
  const s = sunlight(makeScene({ sun: 0, haze: 0, height: 0 }));
  // A spherical exponential atmosphere with an 8.4 km scale height gives sqrt(pi R / 2H) = 34.5.
  rel(s.airMass, Math.sqrt((Math.PI * EARTH_RADIUS) / (2 * RAYLEIGH_HEIGHT)), 0.02, 'air mass at the horizon');
  const high = sunlight(makeScene({ sun: 30, haze: 0, height: 0 }));
  rel(high.airMass, 2, 0.01, 'air mass with the sun 30 degrees up');
});

test('the setting sun loses blue light far faster than red', () => {
  const s = sunlight(makeScene({ sun: 1, haze: 0.1, height: 0 }));
  const blue = s.transmission[WAVELENGTHS.indexOf(440)];
  const red = s.transmission[WAVELENGTHS.indexOf(660)];
  assert.ok(red > 5 * blue, `${red} vs ${blue}`);
  const [r, g, b] = sunRGB(makeScene({ sun: 1, haze: 0.1, height: 0 }));
  assert.ok(r > g && g > b, 'the low sun is orange-red');
  const [r2, , b2] = sunRGB(makeScene({ sun: 70, haze: 0.05, height: 0 }));
  assert.ok(b2 / r2 > 0.75, 'the high sun is nearly white');
});

test('the clear daytime sky is blue overhead and paler near the horizon', () => {
  const scene = makeScene({ sun: 45, haze: 0.05, height: 0 });
  const zen = skyRGB(scene, 90 * DEG, 0);
  assert.ok(zen[2] > zen[1] && zen[1] > zen[0], `zenith ${zen}`);
  const low = skyRGB(scene, 2 * DEG, 180 * DEG);
  const sat = (c) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  assert.ok(sat(low) < sat(zen), 'the horizon sky is whiter');
});

test('the sky light is brightest around the sun when there is haze', () => {
  const scene = makeScene({ sun: 20, haze: 0.3, height: 0 });
  const near = skyRGB(scene, 25 * DEG, 0)[1];
  const away = skyRGB(scene, 25 * DEG, 180 * DEG)[1];
  assert.ok(near > 3 * away, `${near} vs ${away}`);
});

test('high above the air the sky grows dark', () => {
  const ground = skyRGB(makeScene({ sun: 45, haze: 0.05, height: 0 }), 90 * DEG, 0);
  const balloon = skyRGB(makeScene({ sun: 45, haze: 0.05, height: 30000 }), 90 * DEG, 0);
  assert.ok(balloon[1] < 0.05 * ground[1], `${balloon[1]} vs ${ground[1]}`);
});

test('after sunset the sky over the eye is still lit, more faintly, and the sun gives no direct light', () => {
  const noon = skyRGB(makeScene({ sun: 30, haze: 0.05, height: 0 }), 90 * DEG, 0);
  const dusk = makeScene({ sun: -4, haze: 0.05, height: 0 });
  const zen = skyRGB(dusk, 90 * DEG, 0);
  assert.ok(zen[1] > 0 && zen[1] < 0.05 * noon[1], `${zen[1]} vs ${noon[1]}`);
  assert.ok(sunlight(dusk).transmission.every((t) => t === 0));
});

test('the sky light grows with the air it crosses the way the theory says for thin air', () => {
  // With the sun overhead and no haze, the zenith sky for a thin atmosphere is close to
  // beta * H * phase(180 deg) at each wavelength.
  const scene = makeScene({ sun: 90, haze: 0, height: 0 });
  const spec = skySpectrum(scene, [0, 0, 1], undefined, 200, 50);
  const l = WAVELENGTHS.indexOf(700);
  const b = scene.coef.rayleigh[l];
  const thin = b * RAYLEIGH_HEIGHT * (3 / (16 * Math.PI)) * 2;
  // Down to the scattering point and on down to the eye, the light crosses the whole column once.
  rel(spec[l], SUN[l] * thin * Math.exp(-b * RAYLEIGH_HEIGHT), 0.01, 'zenith radiance at 700 nm');
});

test('the dome is symmetric about the sun and covers a disc, and the view is mirrored too', () => {
  const scene = makeScene({ sun: 10, haze: 0.1, height: 0 });
  const dome = renderDome(scene, 24, 8, 6);
  let skyCount = 0;
  for (let j = 0; j < 24; j++) {
    for (let i = 0; i < 24; i++) {
      const o = j * 24 + i, m = j * 24 + 23 - i;
      skyCount += dome.sky[o];
      assert.equal(dome.sky[o], dome.sky[m]);
      assert.equal(dome.rgb[3 * o], dome.rgb[3 * m]);
    }
  }
  close(skyCount / (24 * 24), Math.PI / 4, 0.05, 'share of pixels inside the disc');
  const view = renderView(scene, 12, 4, undefined, undefined, 8, 6);
  assert.equal(view.rgb[0], view.rgb[3 * 11]);
  const k = exposureFor(dome.rgb, dome.sky);
  assert.ok(Number.isFinite(k) && k > 0);
});

test('the ozone layer holds 300 Dobson units and absorbs a few per cent of orange light overhead', () => {
  const [, , co] = column(eyePosition(0), [0, 0, 1], 400);
  rel((co * OZONE_PEAK) / DOBSON, 300, 1e-3, 'Dobson units');
  const tau600 = co * OZONE_PEAK * ozoneCrossSection(600);
  assert.ok(tau600 > 0.03 && tau600 < 0.045, `vertical optical depth at 600 nm: ${tau600}`);
  assert.ok(ozoneCrossSection(600) > 10 * ozoneCrossSection(440), 'the Chappuis band sits in the orange');
});

test('after sunset the ozone keeps the sky overhead blue; without it the sky turns grey-yellow', () => {
  const ratio = (c) => c[2] / c[0];
  const withO = skyRGB(makeScene({ sun: -3, haze: 0.05, height: 0, ozone: 1 }), 90 * DEG, 0);
  const without = skyRGB(makeScene({ sun: -3, haze: 0.05, height: 0, ozone: 0 }), 90 * DEG, 0);
  assert.ok(ratio(withO) > 1.3, `blue / red with ozone ${ratio(withO)}`);
  assert.ok(ratio(without) < 1.1, `blue / red without ozone ${ratio(without)}`);
});

test('a sun below the horizon gives no direct light even with no haze and no ozone', () => {
  for (const scene of [makeScene({ sun: -4, haze: 0, height: 0 }), makeScene({ sun: -4, haze: 0.1, height: 0, ozone: 0 })]) {
    const { transmission } = sunlight(scene);
    assert.ok(transmission.every((t) => t === 0), String(transmission));
    assert.ok(sunRGB(scene).every((c) => c === 0));
  }
});

test('vertical haze transmission is exp(-tau) at 550 nm', () => {
  const clear = sunlight(makeScene({ sun: 90, haze: 0, height: 0, ozone: 0 })).transmission;
  const hazy = sunlight(makeScene({ sun: 90, haze: 0.2, height: 0, ozone: 0 })).transmission;
  // 540 and 560 nm bracket 550 nm; tau scales as wavelength^-1.3.
  const i = WAVELENGTHS.indexOf(540);
  rel(hazy[i] / clear[i], Math.exp(-0.2 * (540 / 550) ** -1.3), 2e-3, 'haze-only transmission at 540 nm');
});

test('the sky average weights each fisheye pixel by the solid angle it covers', () => {
  // A sky whose brightness is the cosine of the zenith angle averages 1/2 over the hemisphere.
  const size = 200;
  const dome = renderDome(makeScene({ sun: 30, haze: 0, height: 0 }), 8, 2, 2);
  const sky = new Uint8Array(size * size), lum = new Float32Array(size * size), area = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5 - size / 2) / (size / 2), y = (j + 0.5 - size / 2) / (size / 2);
    const r = Math.hypot(x, y);
    if (r > 1) continue;
    const theta = (Math.PI / 2) * r;
    const o = j * size + i;
    sky[o] = 1;
    lum[o] = Math.cos(theta);
    area[o] = theta > 0 ? Math.sin(theta) / theta : 1;
  }
  close(meanBrightness({ sky, lum, area }), 0.5, 0.005, 'mean of cos(theta)');
  assert.ok(dome.area.every((a, o) => !dome.sky[o] || (a > 0 && a <= 1)));
});
